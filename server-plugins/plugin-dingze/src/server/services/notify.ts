import type { Context } from '@nocobase/actions';

import { type ArtifactDef, type LifecycleAction, PROJECT_ROLE_LABELS, type ProjectRole, getArtifactDef } from '../../shared';
import { type ProjectContext, currentUserId, userSpaceNames } from './access';

// In-app notifications (spec 二(二)5): project name, artifact, action and a direct link.
// Email goes out too when an email channel named `dingze-email` has been configured in
// NocoBase's notification manager; without it only the in-app inbox is used.

export const EMAIL_CHANNEL = 'dingze-email';

export interface NotificationInput {
  projectId: number;
  spaceName: string;
  userIds: number[];
  kind: string;
  title: string;
  content: string;
  link: string;
  code?: string;
}

function actorName(ctx: Context): string {
  const user: any = ctx.auth?.user;
  return user?.nickname || user?.username || '有人';
}

export async function notify(ctx: Context, input: NotificationInput, transaction?: any) {
  const self = ctx.auth?.user?.id;
  const userIds = [...new Set(input.userIds)].filter((id) => id && id !== self);
  if (userIds.length === 0) return;
  const { userIds: _ignored, ...values } = input;
  for (const userId of userIds) {
    await ctx.db.getRepository('dz_notifications').create({
      values: { ...values, userId, createdById: self, updatedById: self },
      transaction,
    });
  }
  sendEmail(ctx, userIds, input, transaction);
}

function sendEmail(ctx: Context, userIds: number[], input: NotificationInput, transaction?: any) {
  const manager: any = ctx.app.pm.get('notification-manager');
  if (!manager?.send) return;
  const run = async () => {
    const channel = await ctx.db.getRepository('notificationChannels').findOne({ filter: { name: EMAIL_CHANNEL } });
    if (!channel) return;
    const users = await ctx.db.getRepository('users').find({ filter: { id: { $in: userIds } }, fields: ['id', 'email'] });
    const to = users.map((u: any) => u.get('email')).filter(Boolean);
    if (to.length === 0) return;
    const origin = (ctx.get?.('origin') as string) || '';
    await manager.send({
      channelName: EMAIL_CHANNEL,
      triggerFrom: 'dingze',
      message: { to, subject: `【定三责】${input.title}`, contentType: 'text', content: `${input.content}\n\n${origin}/x/dingze${input.link}` },
    });
  };
  const safe = () => run().catch((error) => ctx.app.logger.warn(`dingze email failed: ${error?.message ?? error}`));
  if (transaction?.afterCommit) transaction.afterCommit(safe);
  else void safe();
}

/** Project members with one of `roles` (all members when omitted). */
export async function projectMemberIds(ctx: Context, projectId: number, roles?: ProjectRole[], transaction?: any): Promise<number[]> {
  const rows = await ctx.db.getRepository('dz_project_members').find({
    filter: roles ? { projectId, projectRole: { $in: roles } } : { projectId },
    fields: ['userId'],
    transaction,
  });
  return rows.map((r: any) => r.get('userId'));
}

const RECIPIENTS: Partial<Record<LifecycleAction, { roles?: ProjectRole[]; kind: string; title: (name: string) => string; verb: string }>> = {
  stepDone: { roles: ['lead_consultant', 'co_consultant'], kind: 'step_done', title: (n) => `《${n}》本步完成，待提交复核`, verb: '标记了本步完成' },
  submitReview: { roles: ['lead_consultant'], kind: 'review', title: (n) => `《${n}》待复核`, verb: '提交了复核' },
  approve: { roles: ['ent_lead'], kind: 'confirm', title: (n) => `《${n}》复核通过，待企业确认`, verb: '复核通过' },
  returnToEdit: { roles: ['ent_lead', 'dept_head', 'lead_consultant'], kind: 'returned', title: (n) => `《${n}》被退回修改`, verb: '退回修改' },
  confirm: { kind: 'locked', title: (n) => `《${n}》已定版`, verb: '确认定版' },
  forceLock: { kind: 'locked', title: (n) => `《${n}》已定版`, verb: '强制定版' },
  reopen: { kind: 'reopened', title: (n) => `《${n}》已解锁重开`, verb: '解锁重开' },
  forceReturn: { kind: 'reopened', title: (n) => `《${n}》已退回重做`, verb: '强制退回' },
  selfReview: { roles: ['dept_head'], kind: 'confirm', title: (n) => `《${n}》自查复核完成，待定版`, verb: '完成了自查复核' },
};

/** 自助项目没有咨询师：本步完成后通知企业项目负责人去自查复核。 */
const SELF_RECIPIENTS: typeof RECIPIENTS = {
  stepDone: { roles: ['ent_lead'], kind: 'step_done', title: (n) => `《${n}》本步完成，待自查复核`, verb: '标记了本步完成' },
};

/** “DZ测试燃气 · 2026 年度战略落地”: consultants follow several enterprises at once. */
async function projectLabel(ctx: Context, project: any, transaction?: any): Promise<string> {
  const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: project.get('enterpriseId'), transaction });
  const short = enterprise?.get('shortName') || enterprise?.get('name');
  return short ? `${short} · ${project.get('name')}` : project.get('name');
}

export async function notifyTransition(
  ctx: Context,
  pc: ProjectContext,
  def: ArtifactDef,
  action: LifecycleAction,
  extra: { reason?: string; rev?: number; stale: string[]; bundled?: string[] },
  transaction: any,
) {
  const projectId = pc.project.get('id');
  const project = await projectLabel(ctx, pc.project, transaction);
  const rule = (pc.actor.service === 'self' ? SELF_RECIPIENTS[action] : undefined) ?? RECIPIENTS[action];
  if (rule) {
    const names = [def, ...(extra.bundled ?? []).map((c) => getArtifactDef(c))].map((d) => `${d.specId} ${d.name}`).join('、');
    const parts = [`${project} · ${names}：${actorName(ctx)}${rule.verb}`];
    if (action === 'confirm' || action === 'forceLock') parts.push(`版本 v${extra.rev}`);
    if (extra.reason) parts.push(`原因：${extra.reason}`);
    await notify(
      ctx,
      {
        projectId,
        spaceName: pc.spaceName,
        userIds: await projectMemberIds(ctx, projectId, rule.roles, transaction),
        kind: rule.kind,
        code: def.code,
        title: rule.title(def.name),
        content: parts.join('；'),
        link: `/projects/${projectId}/workspace/${def.code}`,
      },
      transaction,
    );
  }
  if (extra.stale.length) {
    const owners = await projectMemberIds(ctx, projectId, ['ent_lead', 'lead_consultant'], transaction);
    for (const code of extra.stale) {
      const target = getArtifactDef(code);
      await notify(
        ctx,
        {
          projectId,
          spaceName: pc.spaceName,
          userIds: owners,
          kind: 'stale',
          code,
          title: `《${target.name}》上游已变更`,
          content: `${project} · ${target.specId} ${target.name}：上游 ${def.specId} ${def.name}${action === 'reopen' || action === 'forceReturn' ? '已解锁重开' : '有新版本'}，请核对后保存一次`,
          link: `/projects/${projectId}/workspace/${code}`,
        },
        transaction,
      );
    }
  }
}

export async function notifyAssignment(
  ctx: Context,
  project: any,
  members: { userId: number; projectRole: ProjectRole; isNew: boolean }[],
  transaction: any,
) {
  for (const m of members.filter((x) => x.isNew)) {
    await notify(
      ctx,
      {
        projectId: project.get('id'),
        spaceName: project.get('spaceName'),
        userIds: [m.userId],
        kind: 'assigned',
        title: `你已加入项目「${project.get('name')}」`,
        content: `${actorName(ctx)}把你加入了项目「${await projectLabel(ctx, project, transaction)}」，项目角色：${PROJECT_ROLE_LABELS[m.projectRole] ?? m.projectRole}`,
        link: `/projects/${project.get('id')}/overview`,
      },
      transaction,
    );
  }
}

/** The current user's notifications in the spaces they still belong to. */
export async function myNotifications(ctx: Context, params: { limit?: unknown; unread?: unknown }) {
  const spaces = await userSpaceNames(ctx);
  if (spaces.length === 0) return { items: [], unread: 0 };
  const filter: Record<string, unknown> = { userId: currentUserId(ctx), spaceName: { $in: spaces } };
  const repo = ctx.db.getRepository('dz_notifications');
  const limit = Math.min(Math.max(Number(params.limit) || 30, 1), 100);
  const [items, unread] = await Promise.all([
    repo.find({
      filter: params.unread === 'true' || params.unread === true ? { ...filter, readAt: { $empty: true } } : filter,
      sort: ['-createdAt'],
      limit,
      appends: ['project'],
    }),
    repo.count({ filter: { ...filter, readAt: { $empty: true } } }),
  ]);
  return {
    unread,
    items: items.map((n: any) => ({
      id: n.get('id'),
      kind: n.get('kind'),
      code: n.get('code') ?? null,
      title: n.get('title'),
      content: n.get('content'),
      link: n.get('link'),
      projectId: n.get('projectId'),
      projectName: n.get('project')?.get('name') ?? '',
      createdAt: n.get('createdAt'),
      readAt: n.get('readAt') ?? null,
    })),
  };
}

export async function markNotificationsRead(ctx: Context, input: { ids?: unknown; all?: unknown }) {
  const filter: Record<string, unknown> = { userId: currentUserId(ctx), readAt: { $empty: true } };
  if (input.all !== true) {
    const ids = Array.isArray(input.ids) ? input.ids.map(Number).filter(Number.isInteger) : [];
    if (ids.length === 0) return { updated: 0 };
    filter.id = { $in: ids };
  }
  const updated = await ctx.db.getRepository('dz_notifications').update({ filter, values: { readAt: new Date() } });
  return { updated: Array.isArray(updated) ? updated.length : updated };
}
