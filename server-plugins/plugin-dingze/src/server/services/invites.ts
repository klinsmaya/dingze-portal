import crypto from 'crypto';

import type { Context } from '@nocobase/actions';

import { PROJECT_ROLE_LABELS, type ProjectRole } from '../../shared';
import { HttpError, SYSTEM_ROLES } from './access';
import { notify } from './notify';
import { audit, creator, insertUser, loadEnterpriseScope } from './ops';

// 邀请码注册（审核制，闭环第三批）。公开注册保持关闭：只有拿到邀请码的人能提交申请，申请不建账号，
// 企业管理员或运营审核通过后才开通（企业成员 + 企业空间 + 码上绑定的项目、角色和部门）。

const ENTERPRISE_ROLES: ProjectRole[] = ['ent_lead', 'dept_head', 'member', 'readonly'];
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const USERNAME = /^[A-Za-z0-9_.@-]{3,50}$/;

// ── 限流：公开接口按来源 IP 和邀请码计数（进程内，够挡住撞码和刷注册）。训练营现场几十人常共用一个
// 出口 IP，所以按 IP 的上限放得比较宽；码本身 8 位、约 8.5×10¹¹ 种，撞码靠的是查询上限。 ──
const hits = new Map<string, number[]>();
function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new HttpError(429, '操作太频繁，请稍后再试');
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}
const ip = (ctx: Context) => String((ctx as any).request?.ip ?? (ctx as any).ip ?? 'unknown');

function newCode(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const normCode = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

async function usedCount(ctx: Context, inviteId: number) {
  return ctx.db.getRepository('dz_registrations').count({ filter: { inviteId, status: { $in: ['pending', 'approved'] } } });
}

/** A usable invite, or a plain reason why not (same message for unknown and disabled codes). */
async function usableInvite(ctx: Context, code: string) {
  const invite = code ? await ctx.db.getRepository('dz_invites').findOne({ filter: { code }, appends: ['enterprise', 'project', 'orgUnit'] }) : null;
  if (!invite || invite.get('status') !== 'active' || invite.get('enterprise')?.get('status') !== 'active') throw new HttpError(404, '邀请码无效，请向发码人确认');
  const expiresAt = invite.get('expiresAt');
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) throw new HttpError(410, '邀请码已过期，请向发码人要新的');
  if ((await usedCount(ctx, invite.get('id'))) >= Number(invite.get('maxUses') ?? 0)) throw new HttpError(410, '这个邀请码的名额已用完，请向发码人要新的');
  return invite;
}

function describe(invite: any) {
  const role = invite.get('projectRole') as ProjectRole | null;
  return {
    enterprise: invite.get('enterprise')?.get('shortName') || invite.get('enterprise')?.get('name'),
    project: invite.get('project')?.get('name') ?? null,
    role: role ? PROJECT_ROLE_LABELS[role] : null,
    dept: invite.get('orgUnit')?.get('name') ?? null,
  };
}

// ── 公开接口 ─────────────────────────────────────────────────────────

export async function checkInvite(ctx: Context, params: { code?: unknown }) {
  limit(`check:${ip(ctx)}`, 120, 10 * 60_000);
  return describe(await usableInvite(ctx, normCode(params.code)));
}

export async function registerWithInvite(
  ctx: Context,
  input: { code?: unknown; nickname?: unknown; username?: unknown; password?: unknown; phone?: unknown; email?: unknown; remark?: unknown },
) {
  limit(`register:${ip(ctx)}`, 60, 10 * 60_000);
  const code = normCode(input.code);
  limit(`register-code:${code}`, 200, 60 * 60_000);
  const invite = await usableInvite(ctx, code);

  const nickname = String(input.nickname ?? '').trim().slice(0, 50);
  const username = String(input.username ?? '').trim();
  const password = String(input.password ?? '');
  const phone = String(input.phone ?? '').trim().slice(0, 20) || null;
  const email = String(input.email ?? '').trim().slice(0, 100) || null;
  if (!nickname) throw new HttpError(400, '请填写姓名');
  if (!USERNAME.test(username)) throw new HttpError(400, '登录名只能用字母、数字和 _ . @ -，3～50 位');
  if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new HttpError(400, '密码至少 8 位，并同时包含字母和数字');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, '邮箱格式不正确');

  const users = ctx.db.getRepository('users');
  const regs = ctx.db.getRepository('dz_registrations');
  const taken = async (field: string, value: string | null) =>
    !!value && (!!(await users.findOne({ filter: { [field]: value } })) || !!(await regs.findOne({ filter: { [field]: value, status: 'pending' } })));
  if (await taken('username', username)) throw new HttpError(409, `登录名 ${username} 已被使用，请换一个`);
  if (await taken('email', email)) throw new HttpError(409, '这个邮箱已被使用');
  if (await taken('phone', phone)) throw new HttpError(409, '这个手机号已被使用');

  const passwordHash = await (ctx.db.getCollection('users').getField('password') as any).hash(password);
  const spaceName = invite.get('spaceName') ?? invite.get('enterprise')?.get('spaceName');
  const reg = await regs.create({
    values: {
      inviteId: invite.get('id'),
      enterpriseId: invite.get('enterpriseId'),
      nickname,
      username,
      phone,
      email,
      passwordHash,
      remark: String(input.remark ?? '').trim().slice(0, 100) || null,
      status: 'pending',
      spaceName,
    },
  });

  // 通知本企业的企业管理员（没有企业管理员时通知空间里的运营）。
  const members = await ctx.db.getRepository('spaces.users', spaceName).find({ appends: ['roles'] });
  const has = (u: any, role: string) => (u.get('roles') ?? []).some((r: any) => r.get('name') === role);
  const admins = members.filter((u: any) => has(u, SYSTEM_ROLES.entAdmin));
  const reviewers = admins.length
    ? { userIds: admins.map((u: any) => u.get('id')), link: '/enterprise?tab=invites' }
    : {
        userIds: members.filter((u: any) => has(u, SYSTEM_ROLES.ops) || has(u, SYSTEM_ROLES.consultAdmin)).map((u: any) => u.get('id')),
        link: `/ops/enterprises/${invite.get('enterpriseId')}?tab=invites`,
      };
  const scope = describe(invite);
  await notify(ctx, {
    projectId: (invite.get('projectId') ?? null) as number,
    spaceName,
    userIds: reviewers.userIds,
    kind: 'registration',
    title: `${nickname} 凭邀请码申请加入，待审核`,
    content: [`登录名 ${username}`, scope.project && `项目 ${scope.project}`, scope.role, scope.dept, reg.get('remark') && `自述：${reg.get('remark')}`].filter(Boolean).join(' · '),
    link: reviewers.link,
  });
  return { status: 'pending', enterprise: scope.enterprise };
}

/** 门户登录前用它告诉申请人“还在审核 / 没通过”。只回状态，不回其他信息；账号已存在时回 none。 */
export async function registrationStatus(ctx: Context, params: { account?: unknown }) {
  limit(`status:${ip(ctx)}`, 120, 10 * 60_000);
  const account = String(params.account ?? '').trim();
  if (!account) return { status: 'none' };
  // 已有这个账号就照常登录，不拿旧申请挡人。
  if (await ctx.db.getRepository('users').findOne({ filter: { $or: [{ username: account }, { email: account }] } })) return { status: 'none' };
  const reg = await ctx.db.getRepository('dz_registrations').findOne({
    filter: { $or: [{ username: account }, { email: account }] },
    sort: ['-createdAt'],
  });
  if (!reg || reg.get('status') === 'approved') return { status: 'none' };
  return { status: reg.get('status') as 'pending' | 'rejected' };
}

// ── 企业管理员 / 运营 ───────────────────────────────────────────────

export async function listInvites(ctx: Context, enterpriseId: unknown) {
  const scope = await loadEnterpriseScope(ctx, enterpriseId, true);
  const id = scope.enterprise.get('id');
  const [invites, registrations] = await Promise.all([
    ctx.db.getRepository('dz_invites').find({ filter: { enterpriseId: id }, appends: ['project', 'orgUnit', 'createdBy'], sort: ['-createdAt'] }),
    ctx.db.getRepository('dz_registrations').find({ filter: { enterpriseId: id }, appends: ['reviewedBy'], sort: ['-createdAt'], limit: 200 }),
  ]);
  return {
    invites: invites.map((i: any) => ({
      id: i.get('id'),
      code: i.get('code'),
      projectId: i.get('projectId') ?? null,
      projectName: i.get('project')?.get('name') ?? null,
      projectRole: i.get('projectRole') ?? null,
      orgUnitId: i.get('orgUnitId') ?? null,
      orgUnitName: i.get('orgUnit')?.get('name') ?? null,
      maxUses: i.get('maxUses'),
      used: registrations.filter((r: any) => r.get('inviteId') === i.get('id') && r.get('status') !== 'rejected').length,
      expiresAt: i.get('expiresAt'),
      status: i.get('status'),
      note: i.get('note'),
      createdBy: i.get('createdBy')?.get('nickname') ?? null,
      createdAt: i.get('createdAt'),
    })),
    registrations: registrations.map((r: any) => ({
      id: r.get('id'),
      inviteId: r.get('inviteId'),
      nickname: r.get('nickname'),
      username: r.get('username'),
      phone: r.get('phone'),
      email: r.get('email'),
      remark: r.get('remark'),
      status: r.get('status'),
      reason: r.get('reason'),
      reviewedBy: r.get('reviewedBy')?.get('nickname') ?? null,
      reviewedAt: r.get('reviewedAt'),
      createdAt: r.get('createdAt'),
    })),
  };
}

export async function saveInvite(
  ctx: Context,
  input: { enterpriseId: number; id?: number; projectId?: number | null; projectRole?: string | null; orgUnitId?: number | null; maxUses?: number; expiresAt?: string | null; status?: string; note?: string },
) {
  const scope = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const enterpriseId = scope.enterprise.get('id');
  let projectId: number | null = null;
  if (input.projectId) {
    const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: Number(input.projectId) });
    if (!project || project.get('enterpriseId') !== enterpriseId) throw new HttpError(400, '项目不属于这家企业');
    projectId = project.get('id');
  }
  const projectRole = input.projectRole && (ENTERPRISE_ROLES as string[]).includes(input.projectRole) ? input.projectRole : null;
  if (projectId && !projectRole) throw new HttpError(400, '绑定项目时请选项目角色');
  // 企业管理员发的码不能直接给“企业项目负责人”：这个角色要由运营指定。
  if (projectRole === 'ent_lead' && scope.asEntAdmin) throw new HttpError(403, '企业项目负责人由运营指定，邀请码不能直接给这个角色');
  let orgUnitId: number | null = null;
  if (input.orgUnitId) {
    const unit = await ctx.db.getRepository('dz_org_units').findOne({ filterByTk: Number(input.orgUnitId) });
    if (!unit || unit.get('enterpriseId') !== enterpriseId) throw new HttpError(400, '部门不属于这家企业');
    orgUnitId = unit.get('id');
  }
  const maxUses = Math.min(Math.max(Math.round(Number(input.maxUses) || 20), 1), 500);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new HttpError(400, '有效期格式不正确');
  const values = {
    projectId,
    projectRole: projectId ? projectRole : null,
    orgUnitId,
    maxUses,
    expiresAt,
    status: input.status === 'disabled' ? 'disabled' : 'active',
    note: String(input.note ?? '').trim().slice(0, 100) || null,
  };
  const repo = ctx.db.getRepository('dz_invites');
  if (input.id) {
    const invite = await repo.findOne({ filterByTk: Number(input.id) });
    if (!invite || invite.get('enterpriseId') !== enterpriseId) throw new HttpError(404, '邀请码不存在');
    await invite.update(values);
    await audit(ctx, scope.spaceName, 'invite.update', { inviteId: invite.get('id'), status: values.status });
    return invite.toJSON();
  }
  let code = newCode();
  while (await repo.findOne({ filter: { code } })) code = newCode();
  const invite = await repo.create({ values: { ...values, code, enterpriseId, spaceName: scope.spaceName, ...creator(ctx) } });
  await audit(ctx, scope.spaceName, 'invite.create', { inviteId: invite.get('id'), projectId, projectRole: values.projectRole, maxUses });
  return invite.toJSON();
}

export async function reviewRegistration(ctx: Context, input: { enterpriseId: number; id: number; approve: boolean; reason?: string }) {
  const scope = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const reg = await ctx.db.getRepository('dz_registrations').findOne({ filterByTk: Number(input.id), appends: ['invite'] });
  if (!reg || reg.get('enterpriseId') !== scope.enterprise.get('id')) throw new HttpError(404, '申请不存在');
  if (reg.get('status') !== 'pending') throw new HttpError(409, '这条申请已经审核过了');
  const reviewer = { reviewedById: ctx.auth?.user?.id, reviewedAt: new Date() };

  if (!input.approve) {
    const reason = String(input.reason ?? '').trim().slice(0, 200);
    if (!reason) throw new HttpError(400, '请写明不通过的原因');
    await reg.update({ status: 'rejected', reason, passwordHash: null, ...reviewer });
    await audit(ctx, scope.spaceName, 'registration.reject', { registrationId: reg.get('id'), username: reg.get('username'), reason });
    return { status: 'rejected' };
  }

  const userId = await ctx.db.sequelize.transaction(async (transaction: any) => {
    const created = await insertUser(
      ctx,
      { username: reg.get('username'), nickname: reg.get('nickname'), email: reg.get('email') ?? undefined, phone: reg.get('phone') ?? undefined, systemRole: SYSTEM_ROLES.entMember },
      scope.spaceName,
      transaction,
    );
    // 账号用申请人自己设的密码：写入注册时存的哈希，跳过密码字段的二次哈希。
    await ctx.db.getRepository('users').model.update({ password: reg.get('passwordHash') }, { where: { id: created.user.id }, hooks: false, transaction });
    await reg.update({ status: 'approved', userId: created.user.id, passwordHash: null, ...reviewer }, { transaction });
    await audit(ctx, scope.spaceName, 'registration.approve', { registrationId: reg.get('id'), userId: created.user.id, username: reg.get('username') }, transaction);
    return created.user.id;
  });
  const invite = reg.get('invite');
  if (invite?.get('projectId')) {
    const projectId = invite.get('projectId') as number;
    const projectRole = (invite.get('projectRole') ?? 'member') as ProjectRole;
    const repo = ctx.db.getRepository('dz_project_members');
    if (!(await repo.findOne({ filter: { projectId, userId } })))
      await repo.create({ values: { projectId, userId, projectRole, orgUnitId: invite.get('orgUnitId') ?? null, spaceName: scope.spaceName, ...creator(ctx) } });
    await notify(ctx, { projectId, spaceName: scope.spaceName, userIds: [userId], kind: 'assigned', title: '你已加入项目', content: `角色：${PROJECT_ROLE_LABELS[projectRole]}`, link: `/projects/${projectId}` });
  }
  return { status: 'approved', userId };
}
