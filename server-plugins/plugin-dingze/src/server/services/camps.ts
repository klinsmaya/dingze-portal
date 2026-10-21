import type { Context } from '@nocobase/actions';

import { ARTIFACTS, type ProjectRole, STAGES, isArtifactCode, stageGateCodes, startupChecklist } from '../../shared';
import { HttpError, SYSTEM_ROLES, requireOps, systemAccess, userSpaceNames } from './access';
import { openCommentCounts } from './comments';
import { createProject, provisionEnterprise, setProjectMembers } from './enterprises';
import { notify } from './notify';
import { createUser, creator } from './ops';
import { usageByProject } from './usage';

// 训练营批次 (闭环第三批): everything ops needs around one camp — enrol enterprises in bulk, hand out
// accounts in bulk, watch who is ready (营前准备) and who is stuck on site (现场看板), and close the
// camp by turning projects into 企业内训 (陪跑 or 自助). The enterprise side never sees the camp.

const CAMP_STATUS = ['planning', 'running', 'closed'];
const ENTERPRISE_ROLES: ProjectRole[] = ['ent_lead', 'dept_head', 'member', 'readonly'];

function name(value: unknown, label: string, max = 60) {
  const s = String(value ?? '').trim();
  if (!s) throw new HttpError(400, `请填写${label}`);
  return s.slice(0, max);
}

async function loadCamp(ctx: Context, campId: unknown) {
  requireOps(await systemAccess(ctx));
  const camp = await ctx.db.getRepository('dz_camps').findOne({ filterByTk: Number(campId) });
  if (!camp) throw new HttpError(404, '批次不存在');
  return camp;
}

/** Camp projects the current ops user can see (their spaces). */
async function campProjects(ctx: Context, campId: number) {
  const spaces = await userSpaceNames(ctx);
  return ctx.db.getRepository('dz_projects').find({
    filter: { campId, spaceName: { $in: spaces } },
    appends: ['enterprise', 'members', 'members.user'],
    sort: ['id'],
  });
}

export async function listCamps(ctx: Context) {
  requireOps(await systemAccess(ctx));
  const camps = await ctx.db.getRepository('dz_camps').find({ sort: ['-startDate', '-id'] });
  const spaces = await userSpaceNames(ctx);
  const projects = await ctx.db.getRepository('dz_projects').find({ filter: { campId: { $ne: null }, spaceName: { $in: spaces } }, fields: ['id', 'campId'] });
  return camps.map((c: any) => ({ ...c.toJSON(), projectCount: projects.filter((p: any) => p.get('campId') === c.get('id')).length }));
}

export async function saveCamp(
  ctx: Context,
  input: { id?: number; name: string; startDate?: string; endDate?: string; location?: string; status?: string; focusCodes?: string[]; note?: string },
) {
  requireOps(await systemAccess(ctx));
  const values: Record<string, unknown> = {
    name: name(input.name, '批次名称'),
    startDate: String(input.startDate ?? '').slice(0, 10) || null,
    endDate: String(input.endDate ?? '').slice(0, 10) || null,
    location: String(input.location ?? '').trim().slice(0, 60) || null,
    status: CAMP_STATUS.includes(String(input.status)) ? input.status : 'planning',
    focusCodes: (Array.isArray(input.focusCodes) ? input.focusCodes : []).filter((c) => isArtifactCode(String(c))).slice(0, 8),
    note: String(input.note ?? '').trim().slice(0, 1000) || null,
  };
  const repo = ctx.db.getRepository('dz_camps');
  if (input.id) {
    const camp = await loadCamp(ctx, input.id);
    await camp.update(values);
    return camp.toJSON();
  }
  return (await repo.create({ values: { ...values, ...creator(ctx) } })).toJSON();
}

/** 营前准备 + 现场看板 + 结营小结 in one read. */
export async function campDetail(ctx: Context, campId: unknown) {
  const camp = await loadCamp(ctx, campId);
  const projects = await campProjects(ctx, camp.get('id'));
  const ids = projects.map((p: any) => p.get('id'));
  const enterpriseIds = [...new Set(projects.map((p: any) => p.get('enterpriseId')))];
  const [artifacts, units, materials, profiles, exportsRows, usage] = await Promise.all([
    ids.length ? ctx.db.getRepository('dz_artifacts').find({ filter: { projectId: { $in: ids } }, fields: ['projectId', 'code', 'status', 'stale', 'updatedAt'] }) : [],
    enterpriseIds.length ? ctx.db.getRepository('dz_org_units').find({ filter: { enterpriseId: { $in: enterpriseIds } } }) : [],
    ids.length ? ctx.db.getRepository('dz_materials').find({ filter: { projectId: { $in: ids } }, fields: ['id', 'projectId'] }) : [],
    ids.length ? ctx.db.getRepository('dz_profiles').find({ filter: { projectId: { $in: ids } } }) : [],
    ids.length ? ctx.db.getRepository('dz_exports').find({ filter: { projectId: { $in: ids }, draft: { $ne: true } }, fields: ['projectId', 'code'] }) : [],
    usageByProject(ctx),
  ]);
  const focus = ((camp.get('focusCodes') as string[]) ?? []).filter(isArtifactCode);
  const rows = [];
  for (const p of projects as any[]) {
    const id = p.get('id') as number;
    const own = (artifacts as any[]).filter((a) => a.get('projectId') === id);
    const status = (code: string) => (own.find((a) => a.get('code') === code)?.get('status') as string) ?? 'not_started';
    const members = (p.get('members') ?? []).map((m: any) => ({
      userId: m.get('userId'),
      nickname: m.get('user')?.get('nickname') || m.get('user')?.get('username') || '',
      projectRole: m.get('projectRole') as ProjectRole,
      orgUnitId: m.get('orgUnitId') ?? null,
    }));
    const startup = startupChecklist({
      orgUnits: (units as any[]).filter((u) => u.get('enterpriseId') === p.get('enterpriseId')).map((u) => ({ name: u.get('name'), kind: u.get('kind'), headId: u.get('headId'), headName: u.get('headName') })),
      team: members,
      materialCount: (materials as any[]).filter((m) => m.get('projectId') === id).length,
      profileItems: ((profiles as any[]).find((r) => r.get('projectId') === id)?.get('items') as { status: 'draft' | 'reviewed' | 'confirmed' }[]) ?? [],
    });
    const lastAt = own.reduce<string | null>((latest, a) => {
      const at = a.get('updatedAt') ? new Date(a.get('updatedAt')).toISOString() : null;
      return at && (!latest || at > latest) ? at : latest;
    }, null);
    const comments = Object.values(await openCommentCounts(ctx, id)).reduce((a, b) => a + b, 0);
    rows.push({
      id,
      name: p.get('name'),
      year: p.get('year'),
      scene: p.get('scene'),
      service: p.get('service') ?? 'guided',
      enterprise: { id: p.get('enterpriseId'), name: p.get('enterprise')?.get('name'), shortName: p.get('enterprise')?.get('shortName') },
      members: members.map((m: any) => ({ userId: m.userId, nickname: m.nickname, projectRole: m.projectRole })),
      enterpriseMembers: members.filter((m: any) => ENTERPRISE_ROLES.includes(m.projectRole)).length,
      startup: startup.map((s) => ({ key: s.key, title: s.title, state: s.state, detail: s.detail, problems: s.problems })),
      stages: STAGES.map((s) => {
        const gate = stageGateCodes(s.key);
        return { key: s.key, name: s.name, locked: gate.filter((c) => status(c) === 'locked').length, total: gate.length };
      }),
      focus: focus.map((code) => ({ code, status: status(code) })),
      stuck: {
        stepDone: own.filter((a) => a.get('status') === 'step_done').length,
        inReview: own.filter((a) => a.get('status') === 'in_review').length,
        pendingConfirm: own.filter((a) => a.get('status') === 'pending_confirm').length,
        stale: own.filter((a) => a.get('stale')).length,
        comments,
      },
      exports: (exportsRows as any[]).filter((e) => e.get('projectId') === id).length,
      lockedTotal: own.filter((a) => a.get('status') === 'locked' && ARTIFACTS.find((d) => d.code === a.get('code'))?.priority !== 'method').length,
      lastActivityAt: lastAt,
      usage: usage.get(id) ?? null,
    });
  }
  return { camp: camp.toJSON(), projects: rows };
}

/**
 * 批量加企业：each row opens an enterprise (space + 企业管理员账号) and its camp project with the
 * camp's consultants. Rows that fail are reported and the others still go through.
 */
export async function campEnroll(
  ctx: Context,
  input: {
    campId: number;
    year?: number;
    projectName?: string;
    leadConsultantId?: number;
    coConsultantIds?: number[];
    rows: { name: string; shortName: string; size?: string; adminUsername: string; adminNickname: string; adminPhone?: string }[];
  },
) {
  const camp = await loadCamp(ctx, input.campId);
  const rows = Array.isArray(input.rows) ? input.rows.slice(0, 50) : [];
  if (!rows.length) throw new HttpError(400, '没有要开通的企业');
  const lead = input.leadConsultantId ? Number(input.leadConsultantId) : null;
  const cos = (Array.isArray(input.coConsultantIds) ? input.coConsultantIds : []).map(Number).filter((x) => x && x !== lead);
  const year = Number(input.year) || new Date().getFullYear();
  const results = [];
  for (const row of rows) {
    try {
      const opened = await provisionEnterprise(ctx, {
        name: row.name,
        shortName: row.shortName,
        size: row.size === 'large' ? 'large' : 'sme',
        consultantIds: [lead, ...cos].filter(Boolean) as number[],
        admin: { username: row.adminUsername, nickname: row.adminNickname, phone: row.adminPhone },
      } as any);
      const adminId = opened.admin?.user?.id;
      const project = await createProject(ctx, {
        enterpriseId: opened.enterprise.id,
        name: String(input.projectName ?? '').trim() || `${year} 年度战略落地`,
        year,
        scene: 'camp',
        service: 'guided',
        campId: camp.get('id'),
        members: [
          ...(adminId ? [{ userId: adminId, projectRole: 'ent_lead' as ProjectRole }] : []),
          ...(lead ? [{ userId: lead, projectRole: 'lead_consultant' as ProjectRole }] : []),
          ...cos.map((userId) => ({ userId, projectRole: 'co_consultant' as ProjectRole })),
        ],
      });
      results.push({ ok: true, enterprise: row.shortName, projectId: project.id, username: row.adminUsername, initialPassword: opened.admin?.initialPassword ?? null });
    } catch (error: any) {
      results.push({ ok: false, enterprise: row.shortName || row.name, error: error?.message ?? String(error) });
    }
  }
  return { results };
}

/** 把已有项目编入 / 移出批次。 */
export async function campAttach(ctx: Context, input: { campId: number | null; projectIds: number[] }) {
  requireOps(await systemAccess(ctx));
  const campId = input.campId ? (await loadCamp(ctx, input.campId)).get('id') : null;
  const spaces = await userSpaceNames(ctx);
  const projects = await ctx.db.getRepository('dz_projects').find({ filter: { id: { $in: (input.projectIds ?? []).map(Number) }, spaceName: { $in: spaces } } });
  for (const p of projects) await p.update({ campId, ...(campId ? { scene: 'camp' } : {}) });
  return { updated: projects.length };
}

/**
 * 批量发账号：rows of 姓名 / 登录名 / 手机 / 邮箱 / 项目角色 / 部门 for one camp project. New accounts are
 * created as 企业成员 of the enterprise, then added to the project with role and department; the
 * initial passwords come back once, for ops to hand out.
 */
export async function campAccounts(
  ctx: Context,
  input: { projectId: number; rows: { nickname: string; username: string; phone?: string; email?: string; role?: string; dept?: string }[] },
) {
  requireOps(await systemAccess(ctx));
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: Number(input.projectId) });
  if (!project || !(await userSpaceNames(ctx)).includes(project.get('spaceName'))) throw new HttpError(404, '项目不存在');
  const enterpriseId = project.get('enterpriseId') as number;
  const units = await ctx.db.getRepository('dz_org_units').find({ filter: { enterpriseId } });
  const rows = Array.isArray(input.rows) ? input.rows.slice(0, 50) : [];
  const results = [];
  for (const row of rows) {
    try {
      const role = (ENTERPRISE_ROLES as string[]).includes(String(row.role)) ? (row.role as ProjectRole) : 'member';
      const dept = row.dept ? units.find((u: any) => u.get('name') === String(row.dept).trim()) : null;
      if (row.dept && !dept) throw new Error(`组织里没有部门「${row.dept}」`);
      const username = String(row.username ?? '').trim();
      const existing = await ctx.db.getRepository('users').findOne({ filter: { username } });
      let userId: number;
      let initialPassword: string | null = null;
      if (existing) userId = existing.get('id');
      else {
        const created = await createUser(ctx, { username, nickname: row.nickname, phone: row.phone, email: row.email, systemRole: SYSTEM_ROLES.entMember, enterpriseId });
        userId = created.user.id;
        initialPassword = created.initialPassword;
      }
      // setProjectMembers adds the account to the enterprise space and notifies the new member.
      await setProjectMembers(ctx, project.get('id'), [{ userId, projectRole: role, orgUnitId: dept?.get('id') ?? undefined }]);
      results.push({ ok: true, nickname: row.nickname, username: String(row.username ?? '').trim(), role, initialPassword, existed: !!existing });
    } catch (error: any) {
      results.push({ ok: false, nickname: row.nickname, username: row.username, error: error?.message ?? String(error) });
    }
  }
  return { results };
}

/** 营前提醒：给还没准备好的项目的企业项目负责人发一条写明缺什么的通知。 */
export async function campRemind(ctx: Context, input: { campId: number; projectIds?: number[] }) {
  const detail = await campDetail(ctx, input.campId);
  const only = Array.isArray(input.projectIds) && input.projectIds.length ? new Set(input.projectIds.map(Number)) : null;
  let sent = 0;
  for (const p of detail.projects) {
    if (only && !only.has(p.id)) continue;
    const missing = p.startup.filter((s) => s.state !== 'done');
    if (!missing.length) continue;
    const leads = p.members.filter((m: any) => m.projectRole === 'ent_lead').map((m: any) => m.userId);
    if (!leads.length) continue;
    const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: p.id });
    await notify(ctx, {
      projectId: p.id,
      spaceName: project.get('spaceName'),
      userIds: leads,
      kind: 'startup',
      title: '开营前请把项目启动的几件事准备好',
      content: missing.map((s) => `${s.title}：${s.problems.join('；')}`).join('\n'),
      link: `/projects/${p.id}/overview`,
    });
    sent++;
  }
  return { sent };
}

/** 结营：每个项目转为企业内训，并选陪跑或自助；批次标为已结营。 */
export async function campClose(ctx: Context, input: { campId: number; projects: { projectId: number; service: 'guided' | 'self' }[] }) {
  const camp = await loadCamp(ctx, input.campId);
  const own = new Set((await campProjects(ctx, camp.get('id'))).map((p: any) => p.get('id')));
  let updated = 0;
  for (const item of Array.isArray(input.projects) ? input.projects : []) {
    if (!own.has(Number(item.projectId))) continue;
    await ctx.db.getRepository('dz_projects').update({ filterByTk: Number(item.projectId), values: { scene: 'inhouse', service: item.service === 'self' ? 'self' : 'guided' } });
    updated++;
  }
  await camp.update({ status: 'closed' });
  return { updated };
}
