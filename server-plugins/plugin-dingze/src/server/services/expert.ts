import type { Context } from '@nocobase/actions';

import {
  ARTIFACTS,
  EXPERT_STATUSES,
  EXPERT_TEXT_LIMIT,
  EXPERT_TOPICS,
  type ExpertAction,
  type ExpertActor,
  type ExpertStatus,
  type ProjectRole,
  canExpertAct,
  canRequestExpert,
  getArtifactDef,
} from '../../shared';
import { HttpError, type ProjectContext, SYSTEM_ROLES, currentUserId, systemAccess, userSpaceNames } from './access';
import { notify, projectMemberIds } from './notify';

// 专家咨询. Requests live in the enterprise's space; the expert must belong to that space
// (consultants join it when the enterprise is provisioned or added as members), and reads
// only the locked versions the applicant cited when filing.

type Ref = { code: string; versionId: number; rev: number };

const EXPERT_ROLES = [SYSTEM_ROLES.consultant, SYSTEM_ROLES.consultAdmin];
const who = (user: any) => (user ? user.get('nickname') || user.get('username') || '' : '');

function text(value: unknown, label: string, { required = false, max = EXPERT_TEXT_LIMIT } = {}): string {
  const s = String(value ?? '').trim();
  if (required && !s) throw new HttpError(400, `请填写${label}`);
  if (s.length > max) throw new HttpError(400, `${label}不能超过 ${max} 字`);
  return s;
}

async function spaceUsersWithRoles(ctx: Context, spaceName: string, roles: string[]): Promise<{ id: number; name: string }[]> {
  const users = await ctx.db.getRepository('spaces.users', spaceName).find({ appends: ['roles'], sort: ['id'] });
  return (users as any[])
    .filter((u) => (u.get('roles') ?? []).some((r: any) => roles.includes(r.get('name'))))
    .map((u) => ({ id: Number(u.get('id')), name: who(u) }));
}

interface RequestScope {
  request: any;
  project: any;
  actor: ExpertActor;
}

/** Load a request the caller may see: admins of its space, the assigned expert, or project members. */
async function loadRequest(ctx: Context, id: unknown): Promise<RequestScope> {
  const request: any = await ctx.db.getRepository('dz_expert_requests').findOne({ filterByTk: Number(id), appends: ['project', 'createdBy', 'expert'] });
  if (!request) throw new HttpError(404, '咨询申请不存在或无权访问');
  const spaces = await userSpaceNames(ctx);
  if (!spaces.includes(request.get('spaceName'))) throw new HttpError(404, '咨询申请不存在或无权访问');
  const userId = currentUserId(ctx);
  const access = await systemAccess(ctx);
  const membership = await ctx.db.getRepository('dz_project_members').findOne({ filter: { projectId: request.get('projectId'), userId } });
  const actor: ExpertActor = {
    isAdmin: access.isOps,
    isApplicant: Number(request.get('createdById')) === userId,
    isExpert: Number(request.get('expertId')) === userId,
    projectRole: (membership?.get('projectRole') as ProjectRole | undefined) ?? null,
  };
  if (!actor.isAdmin && !actor.isExpert && !actor.projectRole) throw new HttpError(404, '咨询申请不存在或无权访问');
  return { request, project: request.get('project'), actor };
}

function requireStep(scope: RequestScope, action: ExpertAction) {
  const status = scope.request.get('status') as ExpertStatus;
  if (!canExpertAct(action, status, scope.actor)) {
    throw new HttpError(403, `当前状态「${EXPERT_STATUSES[status]}」下你不能执行这个操作`);
  }
}

function summary(r: any, enterprises: Map<number, string>) {
  const project = r.get('project');
  return {
    id: Number(r.get('id')),
    projectId: Number(r.get('projectId')),
    projectName: project?.get('name') ?? '',
    enterprise: project ? enterprises.get(Number(project.get('enterpriseId'))) ?? '' : '',
    topic: r.get('topic'),
    title: r.get('title'),
    status: r.get('status') as ExpertStatus,
    applicant: who(r.get('createdBy')),
    expert: who(r.get('expert')),
    scheduledAt: r.get('scheduledAt') ?? null,
    refs: ((r.get('refs') ?? []) as Ref[]).map((x) => x.code),
    at: r.get('createdAt'),
  };
}

async function enterpriseNames(ctx: Context, rows: any[]): Promise<Map<number, string>> {
  const ids = [...new Set(rows.map((r) => Number(r.get('project')?.get('enterpriseId'))).filter(Boolean))];
  if (!ids.length) return new Map();
  const found = await ctx.db.getRepository('dz_enterprises').find({ filter: { id: { $in: ids } } });
  return new Map((found as any[]).map((e) => [Number(e.get('id')), e.get('shortName') || e.get('name')]));
}

export async function listExpertRequests(ctx: Context, params: { projectId?: unknown }) {
  const spaces = await userSpaceNames(ctx);
  if (!spaces.length) return [];
  const userId = currentUserId(ctx);
  const access = await systemAccess(ctx);
  const filter: any = { spaceName: { $in: spaces } };
  if (!access.isOps) {
    const memberships = await ctx.db.getRepository('dz_project_members').find({ filter: { userId, spaceName: { $in: spaces } }, fields: ['projectId'] });
    filter.$or = [{ projectId: { $in: memberships.map((m: any) => m.get('projectId')) } }, { expertId: userId }];
  }
  if (params.projectId) filter.projectId = Number(params.projectId);
  const rows = await ctx.db.getRepository('dz_expert_requests').find({ filter, appends: ['project', 'createdBy', 'expert'], sort: ['-createdAt'], limit: 200 });
  const enterprises = await enterpriseNames(ctx, rows as any[]);
  return (rows as any[]).map((r) => summary(r, enterprises));
}

export async function expertRequestDetail(ctx: Context, id: unknown) {
  const scope = await loadRequest(ctx, id);
  const r = scope.request;
  const refs = (r.get('refs') ?? []) as Ref[];
  // The cited locked versions, plus the locked upstream tables they are read with.
  const versions = refs.length
    ? await ctx.db.getRepository('dz_artifact_versions').find({ filter: { id: { $in: refs.map((x) => x.versionId) }, projectId: r.get('projectId') } })
    : [];
  const payloads: Record<string, unknown> = {};
  for (const v of versions as any[]) payloads[v.get('code')] = v.get('payload');
  const deps = [...new Set(refs.flatMap((x) => getArtifactDef(x.code)?.dependsOn ?? []))].filter((c) => !(c in payloads));
  const upstream: Record<string, unknown> = {};
  if (deps.length) {
    const rows = await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId: r.get('projectId'), code: { $in: deps }, status: 'locked' }, appends: ['lockedVersion'] });
    for (const a of rows as any[]) if (a.get('lockedVersion')) upstream[a.get('code')] = a.get('lockedVersion').get('payload');
  }
  const enterprises = await enterpriseNames(ctx, [r]);
  const can = Object.fromEntries((['assign', 'schedule', 'answer', 'close', 'cancel'] as ExpertAction[]).map((a) => [a, canExpertAct(a, r.get('status'), scope.actor)]));
  return {
    ...summary(r, enterprises),
    question: r.get('question') ?? '',
    channel: r.get('channel') ?? '',
    minutes: r.get('minutes') ?? '',
    opinion: r.get('opinion') ?? '',
    answeredAt: r.get('answeredAt') ?? null,
    closeNote: r.get('closeNote') ?? '',
    closedAt: r.get('closedAt') ?? null,
    expertId: r.get('expertId') ? Number(r.get('expertId')) : null,
    citations: refs.map((x) => ({ ...x, name: getArtifactDef(x.code)?.name ?? x.code, payload: payloads[x.code] ?? null })),
    upstream: { ...upstream, ...payloads },
    can,
    candidates: can.assign ? await spaceUsersWithRoles(ctx, r.get('spaceName'), EXPERT_ROLES) : [],
  };
}

export async function createExpertRequest(
  ctx: Context,
  pc: ProjectContext,
  input: { topic?: unknown; title?: unknown; question?: unknown; refs?: unknown },
) {
  if (!canRequestExpert(pc.projectRole, pc.access.isConsultAdmin)) throw new HttpError(403, '只读成员不能申请专家咨询');
  const topic = String(input.topic ?? 'other');
  if (!(topic in EXPERT_TOPICS)) throw new HttpError(400, '咨询议题类型不正确');
  const title = text(input.title, '议题', { required: true, max: 100 });
  const question = text(input.question, '问题描述', { required: true });
  const projectId = pc.project.get('id');

  const codes = [...new Set(Array.isArray(input.refs) ? input.refs.map(String) : [])].filter((c) => ARTIFACTS.some((a) => a.code === c));
  const refs: Ref[] = [];
  if (codes.length) {
    const rows = await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId, code: { $in: codes } }, appends: ['lockedVersion'] });
    for (const code of codes) {
      const a: any = (rows as any[]).find((x) => x.get('code') === code);
      if (!a || a.get('status') !== 'locked' || !a.get('lockedVersion')) throw new HttpError(400, `${code} 还没有定版，只能引用已定版成果`);
      refs.push({ code, versionId: Number(a.get('lockedVersionId')), rev: Number(a.get('lockedVersion').get('rev')) });
    }
  }

  const row: any = await ctx.db.getRepository('dz_expert_requests').create({
    values: { projectId, topic, title, question, refs, status: 'submitted', spaceName: pc.spaceName },
    context: ctx,
  });
  const admins = await spaceUsersWithRoles(ctx, pc.spaceName, [SYSTEM_ROLES.consultAdmin]);
  await notify(ctx, {
    projectId,
    spaceName: pc.spaceName,
    userIds: [...admins.map((u) => u.id), ...(await projectMemberIds(ctx, projectId, ['lead_consultant']))],
    kind: 'expert',
    title: `新的专家咨询申请：${title}`,
    content: `${EXPERT_TOPICS[topic as keyof typeof EXPERT_TOPICS]}｜${question.slice(0, 80)}`,
    link: `/expert/${row.get('id')}`,
  });
  return { id: Number(row.get('id')) };
}

async function update(ctx: Context, scope: RequestScope, values: Record<string, unknown>) {
  await ctx.db.getRepository('dz_expert_requests').update({ filterByTk: scope.request.get('id'), values: { ...values, updatedById: currentUserId(ctx) } });
}

async function tell(ctx: Context, scope: RequestScope, userIds: (number | null | undefined)[], title: string, content: string) {
  const r = scope.request;
  await notify(ctx, {
    projectId: Number(r.get('projectId')),
    spaceName: r.get('spaceName'),
    userIds: userIds.filter((x): x is number => !!x).map(Number),
    kind: 'expert',
    title,
    content,
    link: `/expert/${r.get('id')}`,
  });
}

export async function actOnExpertRequest(ctx: Context, input: Record<string, unknown>) {
  const scope = await loadRequest(ctx, input.id);
  const r = scope.request;
  const action = String(input.action) as ExpertAction;
  if (!['assign', 'schedule', 'answer', 'close', 'cancel'].includes(action)) throw new HttpError(400, '未知的操作');
  requireStep(scope, action);
  const title = r.get('title');
  const applicant = Number(r.get('createdById'));
  const expertId = r.get('expertId') ? Number(r.get('expertId')) : null;

  if (action === 'assign') {
    const target = Number(input.expertId);
    const candidates = await spaceUsersWithRoles(ctx, r.get('spaceName'), EXPERT_ROLES);
    const expert = candidates.find((c) => c.id === target);
    if (!expert) throw new HttpError(400, '请选择本企业空间里的咨询师');
    await update(ctx, scope, { expertId: target, status: 'accepted' });
    await tell(ctx, scope, [target], `请你承接专家咨询：${title}`, `申请人已授权你查阅所引用的定版成果。`);
    await tell(ctx, scope, [applicant], `专家咨询已受理：${title}`, `由 ${expert.name} 承接，稍后会和你预约沟通时间。`);
  } else if (action === 'schedule') {
    const at = new Date(String(input.scheduledAt ?? ''));
    if (Number.isNaN(at.getTime())) throw new HttpError(400, '请选择沟通时间');
    const channel = text(input.channel, '沟通方式', { max: 200 });
    await update(ctx, scope, { scheduledAt: at, channel, status: 'scheduled' });
    await tell(ctx, scope, [applicant, scope.actor.isExpert ? null : expertId], `专家咨询已预约：${title}`, `${at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}${channel ? `｜${channel}` : ''}`);
  } else if (action === 'answer') {
    const opinion = text(input.opinion, '专家意见', { required: true });
    const minutes = text(input.minutes, '会议纪要');
    await update(ctx, scope, { opinion, minutes, status: 'answered', answeredAt: new Date() });
    const leads = await projectMemberIds(ctx, Number(r.get('projectId')), ['ent_lead']);
    await tell(ctx, scope, [applicant, ...leads], `专家意见已给出：${title}`, opinion.slice(0, 120));
  } else if (action === 'close') {
    await update(ctx, scope, { status: 'closed', closeNote: text(input.closeNote, '关闭说明', { max: 1000 }), closedAt: new Date() });
    await tell(ctx, scope, [expertId], `专家咨询已关闭：${title}`, text(input.closeNote, '关闭说明', { max: 1000 }) || '申请方已确认收到意见。');
  } else {
    const reason = text(input.closeNote, '撤回原因', { max: 1000 });
    await update(ctx, scope, { status: 'cancelled', closeNote: reason, closedAt: new Date() });
    await tell(ctx, scope, [expertId, scope.actor.isApplicant ? null : applicant], `专家咨询已撤回：${title}`, reason || '—');
  }
  return { id: Number(r.get('id')) };
}
