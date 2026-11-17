import type { Context } from '@nocobase/actions';

import {
  ASSIGNABLE_PROJECT_ROLES,
  type MemberTier,
  type ProjectRole,
  accountKind,
  assignableRoles,
  lastLeadRemoved,
  memberChangeBlocked,
  memberManagerTier,
  normalizeProjectRole,
  roleFitsAccount,
  roleMismatchReason,
} from '../../shared';
import { HttpError, SYSTEM_ROLES, currentUserId, loadProjectContext, requireOps, systemAccess, userSpaceNames } from './access';
import { accountFactsOf, patchAccount, setAccountDepartment } from './accounts';
import { notify, notifyAssignment, projectMemberIds } from './notify';
import {
  type CreateUserInput,
  DZ_SYSTEM_ROLES,
  ENTERPRISE_SIDE_ROLES,
  NEUTRAL_SYSTEM_ROLES,
  PRIVILEGED_SYSTEM_ROLES,
  addUsersToSpace,
  audit,
  creator,
  insertUser,
  loadEnterpriseScope,
  positiveId,
  publicUser,
} from './ops';

// 加人和项目成员（2026-11-17 统一）：
// - 一个加人模型：账号 + 企业 + 可选的项目、部门。开通账号时可以顺手加进项目，进项目一律是项目成员。
// - 项目成员三级管理：运营 / 咨询管理员 › 本企业管理员 › 企业项目负责人。
// - 部门归到人：记在账号上，项目成员上的那一份跟着改。

export interface MemberInput {
  userId: number;
  projectRole: ProjectRole;
  /** 给了就同时把这个人的部门改成它（对本企业所有项目生效）；不给就用这个人已有的部门。 */
  orgUnitId?: number;
}

export function parseMembers(value: unknown): MemberInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, '成员格式不正确');
  const byUser = new Map<number, MemberInput>();
  for (const m of value as any[]) {
    const userId = Number(m?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, '成员缺少用户');
    // 旧版门户还可能传旧角色：部门负责人按项目成员，主 / 协作咨询师按咨询师。
    const projectRole = normalizeProjectRole(m?.projectRole);
    if (!projectRole || !ASSIGNABLE_PROJECT_ROLES.includes(projectRole)) throw new HttpError(400, '项目角色不正确');
    byUser.set(userId, { userId, projectRole, orgUnitId: m.orgUnitId ? Number(m.orgUnitId) : undefined });
  }
  return [...byUser.values()];
}

const roleNames = (user: any): string[] => ((user?.get('roles') ?? []) as any[]).map((r) => r.get('name') as string);
const displayName = (user: any): string => user?.get('nickname') || user?.get('username') || '这个账号';

/**
 * 把一批人加进项目或改他们的角色。调用方已经核对过“谁能改”；这里核对“改成什么是对的”：
 * 角色和账号类型匹配、企业侧账号是本企业的、停用的账号不能新加。部门跟着人走。
 */
export async function upsertMembers(ctx: Context, projectId: number, spaceName: string, list: MemberInput[], transaction: any, actorId?: number) {
  if (!list.length) return;
  const repo = ctx.db.getRepository('dz_project_members');
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: projectId, transaction });
  const enterpriseId = project.get('enterpriseId') as number;
  const by = creator(ctx, actorId);
  const userIds = list.map((m) => m.userId);
  const users = await ctx.db.getRepository('users').find({ filter: { id: { $in: userIds } }, appends: ['roles'], transaction });
  const userById = new Map<number, any>(users.map((u: any) => [u.get('id') as number, u]));
  const inSpace = new Set<number>((await ctx.db.getRepository('spaces.users', spaceName).find({ filter: { id: { $in: userIds } }, fields: ['id'], transaction })).map((u: any) => u.get('id') as number));
  const accounts = await accountFactsOf(ctx.db, userIds, transaction);
  const unitIds = new Set<number>((await ctx.db.getRepository('dz_org_units').find({ filter: { enterpriseId }, fields: ['id'], transaction })).map((u: any) => u.get('id') as number));

  const added: { userId: number; projectRole: ProjectRole; isNew: boolean }[] = [];
  for (const m of list) {
    const user = userById.get(m.userId);
    if (!user) throw new HttpError(400, '成员里有不存在的账号');
    const roles = roleNames(user);
    if (!roleFitsAccount(m.projectRole, roles)) throw new HttpError(400, roleMismatchReason(m.projectRole, displayName(user)));
    const account = accounts.get(m.userId)!;
    const enterpriseSide = m.projectRole !== 'consultant';
    if (enterpriseSide) {
      // 一个企业账号只属于一家企业：必须已经在这家企业里。
      if (!inSpace.has(m.userId) || (account.enterpriseId && account.enterpriseId !== enterpriseId)) {
        throw new HttpError(400, `${displayName(user)} 不是本企业的账号`);
      }
      if (m.orgUnitId && !unitIds.has(m.orgUnitId)) throw new HttpError(400, '部门不属于本企业');
    }
    const existing = await repo.findOne({ filter: { projectId, userId: m.userId }, transaction });
    if (!existing && account.disabled) throw new HttpError(400, `${displayName(user)} 的账号已停用，恢复后才能加进项目`);

    let orgUnitId: number | null = null;
    if (enterpriseSide) {
      orgUnitId = account.orgUnitId && unitIds.has(account.orgUnitId) ? account.orgUnitId : null;
      if (m.orgUnitId && m.orgUnitId !== orgUnitId) {
        orgUnitId = m.orgUnitId;
        await setAccountDepartment(ctx.db, enterpriseId, m.userId, orgUnitId, by.updatedById, transaction);
      } else if (account.enterpriseId !== enterpriseId) {
        await patchAccount(ctx.db, m.userId, { enterpriseId }, by.updatedById, transaction);
      }
    }
    added.push({ userId: m.userId, projectRole: m.projectRole, isNew: !existing });
    if (existing) {
      await existing.update({ projectRole: m.projectRole, orgUnitId, updatedById: by.updatedById }, { transaction });
    } else {
      await repo.create({ values: { projectId, userId: m.userId, projectRole: m.projectRole, orgUnitId, spaceName, ...by }, transaction });
    }
  }
  await addUsersToSpace(ctx, spaceName, userIds, transaction);
  await notifyAssignment(ctx, project, added, transaction);
}

// ── 项目成员三级管理 ─────────────────────────────────────────────────

interface MemberScope {
  project: any;
  spaceName: string;
  tier: MemberTier;
}

/** 当前登录的人在这个项目的成员管理里是哪一级；哪一级都不是就不能管。 */
async function loadMemberScope(ctx: Context, projectId: unknown): Promise<MemberScope> {
  const access = await systemAccess(ctx);
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: positiveId(projectId, '项目') });
  if (!project) throw new HttpError(404, '项目不存在');
  const spaceName = project.get('spaceName') as string;
  if (!(await userSpaceNames(ctx)).includes(spaceName)) throw new HttpError(404, '项目不存在');
  const membership = await ctx.db.getRepository('dz_project_members').findOne({ filter: { projectId: project.get('id'), userId: currentUserId(ctx) } });
  // 一家企业一个空间：上面核对过空间，所以这里的企业管理员就是本企业的。
  const tier = memberManagerTier({ isOps: access.isOps, isEntAdmin: access.isEntAdmin, projectRole: normalizeProjectRole(membership?.get('projectRole')) });
  if (!tier) throw new HttpError(403, '只有运营管理员、本企业管理员或企业项目负责人可以管理项目成员');
  if (!access.isOps) {
    const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: project.get('enterpriseId') });
    if (enterprise?.get('status') === 'suspended') throw new HttpError(403, '该企业已停用，请联系咨询机构', 'ENTERPRISE_SUSPENDED');
  }
  return { project, spaceName, tier };
}

interface CurrentMember {
  row: any;
  userId: number;
  projectRole: ProjectRole;
}

async function currentMembers(ctx: Context, projectId: number, transaction?: any): Promise<CurrentMember[]> {
  const rows: any[] = await ctx.db.getRepository('dz_project_members').find({ filter: { projectId }, transaction });
  const out: CurrentMember[] = [];
  for (const row of rows) {
    const projectRole = normalizeProjectRole(row.get('projectRole'));
    if (projectRole) out.push({ row, userId: row.get('userId') as number, projectRole });
  }
  return out;
}

/** 企业项目负责人换了人：告诉项目里的咨询师（他们的复核、定版都对着负责人）。 */
async function notifyLeadChange(ctx: Context, project: any, before: { userId: number; projectRole: ProjectRole }[], after: { userId: number; projectRole: ProjectRole }[]) {
  const leads = (rows: { userId: number; projectRole: ProjectRole }[]) => rows.filter((m) => m.projectRole === 'ent_lead').map((m) => m.userId).sort((a, b) => a - b);
  const now = leads(after);
  if (leads(before).join(',') === now.join(',')) return;
  const projectId = project.get('id') as number;
  const users = now.length ? await ctx.db.getRepository('users').find({ filter: { id: { $in: now } }, fields: ['id', 'nickname', 'username'] }) : [];
  const names = users.map((u: any) => u.get('nickname') || u.get('username')).join('、') || '暂时没有';
  await notify(ctx, {
    projectId,
    spaceName: project.get('spaceName'),
    userIds: await projectMemberIds(ctx, projectId, ['consultant']),
    kind: 'lead_changed',
    title: `项目「${project.get('name')}」的企业项目负责人有变动`,
    content: `现在的企业项目负责人：${names}。定版、提交复核由企业项目负责人操作。`,
    link: `/projects/${projectId}/overview`,
  }).catch((error: any) => ctx.app.logger.warn(`dingze: notifying the lead change of project ${projectId} failed: ${error?.message ?? error}`));
}

/** 加入项目或改角色。三级里每一级只能动自己管得着的角色；不能把最后一位企业项目负责人改没了。 */
export async function setProjectMembers(ctx: Context, projectId: unknown, input: unknown) {
  const { project, spaceName, tier } = await loadMemberScope(ctx, projectId);
  const id = project.get('id') as number;
  const list = parseMembers(input);
  if (!list.length) return { ok: true };
  const before = await currentMembers(ctx, id);
  const roleOf = new Map(before.map((m) => [m.userId, m.projectRole]));
  for (const m of list) {
    const blocked = memberChangeBlocked(tier, roleOf.get(m.userId) ?? null, m.projectRole);
    if (blocked) throw new HttpError(403, blocked);
  }
  const changed = new Map(list.map((m) => [m.userId, m.projectRole]));
  const after = [
    ...before.filter((m) => !changed.has(m.userId)).map((m) => ({ userId: m.userId, projectRole: m.projectRole })),
    ...list.map((m) => ({ userId: m.userId, projectRole: m.projectRole })),
  ];
  if (lastLeadRemoved(before, after)) throw new HttpError(409, '项目至少要有一位企业项目负责人，请先指定新的负责人');
  await ctx.db.sequelize.transaction(async (transaction: any) => {
    await upsertMembers(ctx, id, spaceName, list, transaction);
    await audit(ctx, spaceName, 'project.setMembers', { projectId: id, tier, members: list.map((m) => ({ userId: m.userId, projectRole: m.projectRole })) }, transaction);
  });
  await notifyLeadChange(ctx, project, before, after);
  return { ok: true };
}

export async function removeProjectMember(ctx: Context, input: { projectId: number; userId: number }) {
  const { project, spaceName, tier } = await loadMemberScope(ctx, input.projectId);
  const id = project.get('id') as number;
  const userId = positiveId(input.userId, '用户');
  const before = await currentMembers(ctx, id);
  const member = before.find((m) => m.userId === userId);
  if (!member) {
    // 旧数据里的只读成员等：不算项目角色，谁能管成员谁就能清掉。
    const stale = await ctx.db.getRepository('dz_project_members').findOne({ filter: { projectId: id, userId } });
    if (!stale) throw new HttpError(404, '该账号不是项目成员');
    await stale.destroy();
    return { ok: true };
  }
  const blocked = memberChangeBlocked(tier, member.projectRole, null);
  if (blocked) throw new HttpError(403, blocked);
  const after = before.filter((m) => m.userId !== userId);
  if (lastLeadRemoved(before, after)) throw new HttpError(409, '项目至少要有一位企业项目负责人，请先指定新的负责人');
  if (member.projectRole === 'consultant' && project.get('service') !== 'self' && !after.some((m) => m.projectRole === 'consultant')) {
    throw new HttpError(409, '陪跑项目至少需要一位咨询师：先分派新的咨询师，或把服务方式改为自助');
  }
  await member.row.destroy();
  await audit(ctx, spaceName, 'project.removeMember', { projectId: id, userId, tier });
  await notifyLeadChange(ctx, project, before, after);
  return { ok: true };
}

/**
 * 项目里的“成员”：现在有谁，当前登录的人是哪一级、能分派什么角色、还能加谁。
 * 看得到项目的人都能看成员；不能管的人 `tier` 为 null，候选人为空。
 */
export async function projectMembers(ctx: Context, projectId: unknown) {
  const pc = await loadProjectContext(ctx, projectId);
  const id = pc.project.get('id') as number;
  const enterpriseId = pc.project.get('enterpriseId') as number;
  const tier = memberManagerTier({ isOps: pc.access.isOps, isEntAdmin: pc.access.isEntAdmin, projectRole: pc.joined ? pc.projectRole : null });
  const rows = await ctx.db.getRepository('dz_project_members').find({ filter: { projectId: id }, appends: ['user', 'user.roles'], sort: ['id'] });
  const members = rows
    .map((r: any) => ({
      userId: r.get('userId') as number,
      projectRole: normalizeProjectRole(r.get('projectRole')),
      orgUnitId: (r.get('orgUnitId') as number | null) ?? null,
      nickname: (r.get('user')?.get('nickname') || r.get('user')?.get('username') || '') as string,
      username: (r.get('user')?.get('username') ?? '') as string,
    }))
    .filter((m: any) => m.projectRole);
  const memberIds = new Set(members.map((m: any) => m.userId));
  let candidates: { id: number; nickname: string; username: string; kind: string; orgUnitId: number | null }[] = [];
  if (tier) {
    const people: any[] = await ctx.db.getRepository('spaces.users', pc.spaceName).find({ appends: ['roles'], sort: ['id'] });
    const accounts = await accountFactsOf(ctx.db, people.map((u: any) => u.get('id') as number));
    const kinds = tier === 'ops' ? ['enterprise', 'consulting'] : ['enterprise'];
    candidates = people
      .map((u: any) => ({
        id: u.get('id') as number,
        nickname: (u.get('nickname') || u.get('username')) as string,
        username: u.get('username') as string,
        kind: accountKind(roleNames(u)),
        orgUnitId: accounts.get(u.get('id'))?.orgUnitId ?? null,
        disabled: !!accounts.get(u.get('id'))?.disabled,
        foreign: (accounts.get(u.get('id'))?.enterpriseId ?? enterpriseId) !== enterpriseId,
      }))
      .filter((u) => kinds.includes(u.kind) && !u.disabled && !memberIds.has(u.id) && !(u.kind === 'enterprise' && u.foreign))
      .map(({ disabled: _d, foreign: _f, ...u }) => u);
  }
  const units = await ctx.db.getRepository('dz_org_units').find({ filter: { enterpriseId }, fields: ['id', 'name', 'parentId'], sort: ['sort', 'id'] });
  return {
    projectId: id,
    enterpriseId,
    projectName: pc.project.get('name') as string,
    service: pc.project.get('service') === 'self' ? 'self' : 'guided',
    tier,
    assignable: assignableRoles(tier),
    members,
    candidates,
    orgUnits: units.map((u: any) => ({ id: u.get('id') as number, name: u.get('name') as string, parentId: (u.get('parentId') as number | null) ?? null })),
  };
}

// ── 开通账号 ─────────────────────────────────────────────────────────

export interface OpenAccountInput extends CreateUserInput {
  /** 开通后直接加进这些项目（本企业、进行中的），角色一律是项目成员。只对企业侧账号有用。 */
  projectIds?: number[];
  orgUnitId?: number | null;
  /** 部门名称（批量名单里用）；和 orgUnitId 只用其一。 */
  dept?: string;
}

async function resolveUnit(ctx: Context, enterpriseId: number, input: { orgUnitId?: number | null; dept?: string }, transaction?: any): Promise<number | null> {
  if (input.orgUnitId) {
    const unit = await ctx.db.getRepository('dz_org_units').findOne({ filter: { id: Number(input.orgUnitId), enterpriseId }, transaction });
    if (!unit) throw new HttpError(400, '部门不属于本企业');
    return unit.get('id') as number;
  }
  const name = String(input.dept ?? '').trim();
  if (!name) return null;
  const unit = await ctx.db.getRepository('dz_org_units').findOne({ filter: { name, enterpriseId }, transaction });
  if (!unit) throw new HttpError(400, `组织里没有部门「${name}」，先在项目“资料 › 组织与职责”里建好，或把这一格留空`);
  return unit.get('id') as number;
}

async function joinableProjects(ctx: Context, enterpriseId: number, projectIds: unknown, transaction?: any): Promise<any[]> {
  const ids = Array.isArray(projectIds) ? [...new Set(projectIds.map(Number))].filter((n) => Number.isInteger(n) && n > 0) : [];
  if (!ids.length) return [];
  const projects = await ctx.db.getRepository('dz_projects').find({ filter: { id: { $in: ids }, enterpriseId }, transaction });
  if (projects.length !== ids.length) throw new HttpError(400, '选的项目里有不属于这家企业的');
  if (projects.some((p: any) => p.get('status') === 'archived')) throw new HttpError(400, '已归档的项目不能加人，先恢复项目');
  return projects;
}

/**
 * 开通一个账号。带 enterpriseId 时是这家企业的账号（企业管理员只能开企业成员），可以顺手归到部门、
 * 加进项目；不带时是咨询方或运营的账号（只有运营能开，运营管理员、咨询管理员只有咨询管理员能开）。
 */
export async function createUser(ctx: Context, input: OpenAccountInput, transaction?: any) {
  const systemRole = String(input.systemRole ?? '');
  if (!DZ_SYSTEM_ROLES.includes(systemRole)) throw new HttpError(400, '系统角色不正确');
  const enterpriseSide = ENTERPRISE_SIDE_ROLES.includes(systemRole);

  const scope = input.enterpriseId ? await loadEnterpriseScope(ctx, input.enterpriseId, true) : null;
  const access = scope?.access ?? (await systemAccess(ctx));
  if (!scope) requireOps(access);
  if (scope?.asEntAdmin && systemRole !== SYSTEM_ROLES.entMember) throw new HttpError(403, '企业管理员只能为本企业开通企业成员账号');
  if (enterpriseSide && !scope) throw new HttpError(400, '企业管理员、企业成员的账号要在企业里开通');
  if (PRIVILEGED_SYSTEM_ROLES.includes(systemRole) && !access.isConsultAdmin) {
    throw new HttpError(403, '只有咨询管理员可以开通运营管理员或咨询管理员');
  }

  const enterpriseId = scope ? (scope.enterprise.get('id') as number) : null;
  const run = async (tx: any) => {
    const orgUnitId = enterpriseSide && enterpriseId ? await resolveUnit(ctx, enterpriseId, input, tx) : null;
    const projects = enterpriseSide && enterpriseId ? await joinableProjects(ctx, enterpriseId, input.projectIds, tx) : [];
    const created = await insertUser(ctx, { ...input, systemRole }, scope?.spaceName ?? null, tx, { enterpriseId, orgUnitId });
    for (const project of projects) {
      await upsertMembers(ctx, project.get('id') as number, scope!.spaceName, [{ userId: created.user.id, projectRole: 'member' }], tx);
    }
    return { ...created, projectIds: projects.map((p: any) => p.get('id') as number) };
  };
  return transaction ? run(transaction) : ctx.db.sequelize.transaction(run);
}

export interface AccountRow {
  nickname: string;
  username: string;
  phone?: string;
  email?: string;
  dept?: string;
}

/**
 * 批量开通：一份名单（姓名 / 登录名 / 手机 / 邮箱 / 部门），开通为企业成员，并加进选中的项目（项目成员）。
 * 登录名已经是本企业的账号时不新开，只把它加进项目。一行失败不影响其他行；初始密码只在这里返回一次。
 */
export async function createUsers(ctx: Context, input: { enterpriseId: number; projectIds?: number[]; rows: AccountRow[] }) {
  const scope = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const enterpriseId = scope.enterprise.get('id') as number;
  const projects = await joinableProjects(ctx, enterpriseId, input.projectIds);
  const projectIds = projects.map((p: any) => p.get('id') as number);
  const rows = Array.isArray(input.rows) ? input.rows.slice(0, 100) : [];
  if (!rows.length) throw new HttpError(400, '名单是空的');
  const results = [];
  for (const row of rows) {
    const username = String(row?.username ?? '').trim();
    try {
      const existing = username ? await ctx.db.getRepository('users').findOne({ filter: { username }, appends: ['roles'] }) : null;
      if (!existing) {
        const created = await createUser(ctx, { username, nickname: row.nickname, phone: row.phone, email: row.email, dept: row.dept, systemRole: SYSTEM_ROLES.entMember, enterpriseId, projectIds });
        results.push({ ok: true, nickname: row.nickname, username, role: 'member' as ProjectRole, initialPassword: created.initialPassword, existed: false });
        continue;
      }
      const userId = existing.get('id') as number;
      const inSpace = await ctx.db.getRepository('spaces.users', scope.spaceName).findOne({ filterByTk: userId });
      if (!inSpace || accountKind(roleNames(existing)) !== 'enterprise') throw new HttpError(409, `登录名 ${username} 已被别的账号使用`);
      const orgUnitId = await resolveUnit(ctx, enterpriseId, { dept: row.dept });
      await ctx.db.sequelize.transaction(async (transaction: any) => {
        if (orgUnitId) await setAccountDepartment(ctx.db, enterpriseId, userId, orgUnitId, currentUserId(ctx), transaction);
        for (const projectId of projectIds) {
          const already = await ctx.db.getRepository('dz_project_members').findOne({ filter: { projectId, userId }, transaction });
          if (!already) await upsertMembers(ctx, projectId, scope.spaceName, [{ userId, projectRole: 'member' }], transaction);
        }
      });
      results.push({ ok: true, nickname: existing.get('nickname') || row.nickname, username, role: 'member' as ProjectRole, initialPassword: null, existed: true });
    } catch (error: any) {
      results.push({ ok: false, nickname: row?.nickname, username, error: error?.message ?? String(error) });
    }
  }
  await audit(ctx, scope.spaceName, 'user.createBatch', { enterpriseId, projectIds, total: rows.length, failed: results.filter((r) => !r.ok).length });
  return { results };
}

// ── 企业成员管理 ─────────────────────────────────────────────────────

async function loadEnterpriseMember(ctx: Context, spaceName: string, userId: number) {
  const user = await ctx.db.getRepository('users').findOne({ filterByTk: userId, appends: ['roles'] });
  if (!user || !(await ctx.db.getRepository('spaces.users', spaceName).findOne({ filterByTk: userId }))) throw new HttpError(404, '该账号不在本企业');
  return { user, roles: roleNames(user) };
}

async function activeAdminIds(ctx: Context, spaceName: string): Promise<number[]> {
  const people: any[] = await ctx.db.getRepository('spaces.users', spaceName).find({ appends: ['roles'] });
  const admins: number[] = people.filter((u: any) => roleNames(u).includes(SYSTEM_ROLES.entAdmin)).map((u: any) => u.get('id') as number);
  const accounts = await accountFactsOf(ctx.db, admins);
  return admins.filter((id) => !accounts.get(id)?.disabled);
}

/** 分派咨询师：把咨询方账号（咨询师、咨询管理员）加进这家企业，之后才能分派到项目。企业账号只属于一家企业，不能这样加。 */
export async function addEnterpriseMembers(ctx: Context, input: { enterpriseId: number; userIds: number[] }) {
  const { spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, false);
  const userIds = [...new Set((input.userIds ?? []).map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (userIds.length === 0) throw new HttpError(400, '请选择咨询师');
  const users = await ctx.db.getRepository('users').find({ filter: { id: { $in: userIds } }, appends: ['roles'] });
  if (users.length !== userIds.length) throw new HttpError(400, '选的账号里有不存在的');
  const wrong = users.find((u: any) => accountKind(roleNames(u)) !== 'consulting');
  if (wrong) throw new HttpError(400, `${displayName(wrong)} 不是咨询方账号。企业的账号只属于一家企业，请在企业里直接开通`);
  await addUsersToSpace(ctx, spaceName, userIds);
  await audit(ctx, spaceName, 'enterprise.addMembers', { userIds });
  return { ok: true };
}

/**
 * 移出企业（只有运营）：连同本企业各项目里的成员记录一起移出。还是某个项目唯一的企业项目负责人时先拦下。
 * 运营管理员、咨询管理员自动在所有企业里，只取消他们在本企业项目里的咨询师分派。
 */
export async function removeEnterpriseMember(ctx: Context, input: { enterpriseId: number; userId: number }) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, false);
  const enterpriseId = enterprise.get('id') as number;
  const userId = positiveId(input.userId, '用户');
  if (userId === currentUserId(ctx)) throw new HttpError(400, '不能把自己移出企业');
  const { roles } = await loadEnterpriseMember(ctx, spaceName, userId);
  const projects = await ctx.db.getRepository('dz_projects').find({ filter: { enterpriseId } });
  const memberships = projects.length
    ? await ctx.db.getRepository('dz_project_members').find({ filter: { userId, projectId: { $in: projects.map((p: any) => p.get('id')) } } })
    : [];
  for (const m of memberships) {
    if (normalizeProjectRole(m.get('projectRole')) !== 'ent_lead') continue;
    const others = await ctx.db.getRepository('dz_project_members').count({ filter: { projectId: m.get('projectId'), projectRole: 'ent_lead', userId: { $ne: userId } } });
    if (!others) {
      const project = projects.find((p: any) => p.get('id') === m.get('projectId'));
      throw new HttpError(409, `请先给项目「${project?.get('name')}」换一位企业项目负责人`);
    }
  }
  const staff = roles.some((r) => PRIVILEGED_SYSTEM_ROLES.includes(r));
  await ctx.db.sequelize.transaction(async (transaction: any) => {
    for (const m of memberships) await m.destroy({ transaction });
    if (!staff) await ctx.db.getRepository('spaces.users', spaceName).remove({ tk: [userId], transaction });
    if (accountKind(roles) === 'enterprise') await patchAccount(ctx.db, userId, { enterpriseId: null, orgUnitId: null }, currentUserId(ctx), transaction);
    await audit(ctx, spaceName, 'enterprise.removeMember', { userId, projects: memberships.length }, transaction);
  });
  return { ok: true, projects: memberships.length };
}

/** 设为 / 取消企业管理员（只有运营）。企业至少要留一位能用的企业管理员。 */
export async function setEnterpriseAdmin(ctx: Context, input: { enterpriseId: number; userId: number; admin: boolean }) {
  const { spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, false);
  const userId = positiveId(input.userId, '用户');
  const { user, roles } = await loadEnterpriseMember(ctx, spaceName, userId);
  if (accountKind(roles) !== 'enterprise') throw new HttpError(400, `${displayName(user)} 不是本企业的账号，不能设为企业管理员`);
  const admin = input.admin === true;
  const isAdmin = roles.includes(SYSTEM_ROLES.entAdmin);
  if (admin === isAdmin) return { ok: true };
  if (!admin) {
    const rest = (await activeAdminIds(ctx, spaceName)).filter((id) => id !== userId);
    if (!rest.length) throw new HttpError(409, '企业至少要有一位企业管理员，请先把另一位成员设为企业管理员');
  }
  await ctx.db.sequelize.transaction(async (transaction: any) => {
    const repo = ctx.db.getRepository('users.roles', userId);
    await repo.add({ tk: [admin ? SYSTEM_ROLES.entAdmin : SYSTEM_ROLES.entMember], transaction });
    await repo.remove({ tk: [admin ? SYSTEM_ROLES.entMember : SYSTEM_ROLES.entAdmin], transaction });
    await audit(ctx, spaceName, admin ? 'enterprise.grantAdmin' : 'enterprise.revokeAdmin', { userId }, transaction);
  });
  return { ok: true };
}

/** 成员所属部门：记在人身上，对本企业所有项目生效。企业管理员和运营都能设。 */
export async function setMemberDepartment(ctx: Context, input: { enterpriseId: number; userId: number; orgUnitId: number | null }) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const enterpriseId = enterprise.get('id') as number;
  const userId = positiveId(input.userId, '成员');
  const { user, roles } = await loadEnterpriseMember(ctx, spaceName, userId);
  if (accountKind(roles) !== 'enterprise') throw new HttpError(400, `${displayName(user)} 不是本企业的账号，没有所属部门`);
  const orgUnitId = input.orgUnitId ? await resolveUnit(ctx, enterpriseId, { orgUnitId: input.orgUnitId }) : null;
  const updated = await ctx.db.sequelize.transaction(async (transaction: any) => {
    const count = await setAccountDepartment(ctx.db, enterpriseId, userId, orgUnitId, currentUserId(ctx), transaction);
    await audit(ctx, spaceName, 'member.setDepartment', { userId, orgUnitId, projects: count }, transaction);
    return count;
  });
  return { updated };
}

/**
 * 停用 / 恢复账号。停用后不能登录，也用不了任何功能；数据、项目成员身份都留着，恢复后照旧。
 * 带 enterpriseId：运营，和本企业管理员（只能停用、恢复企业成员）。不带：运营管咨询方账号。
 */
export async function setAccountDisabled(ctx: Context, input: { enterpriseId?: number; userId: number; disabled: boolean }) {
  const userId = positiveId(input.userId, '用户');
  const disabled = input.disabled === true;
  if (userId === currentUserId(ctx)) throw new HttpError(400, '不能停用自己的账号');
  let spaceName: string | null = null;
  let roles: string[];
  if (input.enterpriseId) {
    const scope = await loadEnterpriseScope(ctx, input.enterpriseId, true);
    spaceName = scope.spaceName;
    roles = (await loadEnterpriseMember(ctx, spaceName, userId)).roles;
    if (scope.asEntAdmin && roles.some((name) => name !== SYSTEM_ROLES.entMember && !NEUTRAL_SYSTEM_ROLES.includes(name))) {
      throw new HttpError(403, '企业管理员只能停用、恢复企业成员的账号');
    }
    if (roles.some((name) => PRIVILEGED_SYSTEM_ROLES.includes(name)) && !scope.access.isConsultAdmin) throw new HttpError(403, '只有咨询管理员可以停用管理员的账号');
    if (disabled && roles.includes(SYSTEM_ROLES.entAdmin)) {
      const rest = (await activeAdminIds(ctx, spaceName)).filter((id) => id !== userId);
      if (!rest.length) throw new HttpError(409, '企业至少要有一位能用的企业管理员，请先把另一位成员设为企业管理员');
    }
  } else {
    const access = await systemAccess(ctx);
    requireOps(access);
    const user = await ctx.db.getRepository('users').findOne({ filterByTk: userId, appends: ['roles'] });
    if (!user) throw new HttpError(404, '用户不存在');
    roles = roleNames(user);
    if (roles.some((name) => PRIVILEGED_SYSTEM_ROLES.includes(name)) && !access.isConsultAdmin) throw new HttpError(403, '只有咨询管理员可以停用管理员的账号');
  }
  if (roles.some((name) => !DZ_SYSTEM_ROLES.includes(name) && !NEUTRAL_SYSTEM_ROLES.includes(name))) {
    throw new HttpError(403, '这个账号不是定责平台账号，请到系统管理里处理');
  }
  await patchAccount(ctx.db, userId, { disabledAt: disabled ? new Date() : null, disabledById: disabled ? currentUserId(ctx) : null }, currentUserId(ctx));
  await audit(ctx, spaceName, disabled ? 'user.disable' : 'user.enable', { userId });
  return { ok: true, disabled };
}
