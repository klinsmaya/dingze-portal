import type { Context } from '@nocobase/actions';

import type { ArtifactDef } from '../../shared';
import { HttpError, type ProjectContext, currentUserId } from './access';
import { notify, projectMemberIds } from './notify';

// 批注: threads anchored to a row or field of an artifact (or the whole table), with replies,
// @mentions and resolve. Any project member except read-only members may comment.

const MAX_LENGTH = 2000;
const who = (user: any) => (user ? user.get('nickname') || user.get('username') || '' : '');

// Design 10 §4: every project member may comment, read-only members included (they cannot
// change content); comments stay possible after 定版.
function requireCommenter(pc: ProjectContext) {
  if (pc.access.isConsultAdmin || pc.access.isOps) return;
  if (!pc.projectRole) throw new HttpError(403, '不是项目成员，不能批注');
}

export async function listComments(ctx: Context, pc: ProjectContext, def: ArtifactDef) {
  const rows = await ctx.db.getRepository('dz_comments').find({
    filter: { projectId: pc.project.get('id'), code: def.code },
    appends: ['createdBy'],
    sort: ['createdAt'],
  });
  const all = rows.map((c: any) => ({
    id: Number(c.get('id')),
    parentId: c.get('parentId') ? Number(c.get('parentId')) : null,
    anchor: c.get('anchor') ?? null,
    anchors: (c.get('anchors') ?? []) as string[],
    anchorLabel: c.get('anchorLabel') ?? '',
    content: c.get('content'),
    mentions: (c.get('mentions') ?? []) as number[],
    rev: c.get('rev') ?? null,
    resolved: !!c.get('resolved'),
    resolvedAt: c.get('resolvedAt') ?? null,
    authorId: c.get('createdById'),
    author: who(c.get('createdBy')),
    at: c.get('createdAt'),
  }));
  return all
    .filter((c) => !c.parentId)
    .map((root) => ({ ...root, replies: all.filter((c) => c.parentId === root.id) }));
}

export async function addComment(
  ctx: Context,
  pc: ProjectContext,
  def: ArtifactDef,
  input: { anchor?: unknown; anchors?: unknown; anchorLabel?: unknown; content?: unknown; parentId?: unknown; mentions?: unknown },
) {
  requireCommenter(pc);
  const content = String(input.content ?? '').trim();
  if (!content) throw new HttpError(400, '批注内容不能为空');
  if (content.length > MAX_LENGTH) throw new HttpError(400, `批注不能超过 ${MAX_LENGTH} 字`);
  const projectId = pc.project.get('id');
  const repo = ctx.db.getRepository('dz_comments');

  let root: any = null;
  if (input.parentId) {
    root = await repo.findOne({ filter: { id: Number(input.parentId), projectId, code: def.code } });
    if (!root) throw new HttpError(404, '要回复的批注不存在');
    if (root.get('parentId')) root = await repo.findOne({ filter: { id: root.get('parentId'), projectId } });
  }
  const members = await projectMemberIds(ctx, projectId);
  const mentions = (Array.isArray(input.mentions) ? input.mentions.map(Number) : []).filter((id) => members.includes(id));
  const artifact = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code: def.code } });

  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const comment = await repo.create({
      values: {
        projectId,
        code: def.code,
        anchor: root ? root.get('anchor') : input.anchor ? String(input.anchor).slice(0, 200) : null,
        anchors: root ? root.get('anchors') ?? [] : Array.isArray(input.anchors) ? input.anchors.slice(0, 50).map((a) => String(a).slice(0, 200)) : [],
        anchorLabel: root ? root.get('anchorLabel') : String(input.anchorLabel ?? '').slice(0, 200),
        content,
        parentId: root ? root.get('id') : null,
        mentions,
        rev: artifact?.get('currentRev') ?? 0,
        spaceName: pc.spaceName,
      },
      context: ctx,
      transaction,
    });
    if (root?.get('resolved')) await root.update({ resolved: false, resolvedById: null, resolvedAt: null }, { transaction });

    const author = (ctx.auth?.user as any)?.nickname || (ctx.auth?.user as any)?.username || '有人';
    const where = comment.get('anchorLabel') ? `「${comment.get('anchorLabel')}」` : '整张表';
    const excerpt = content.length > 60 ? `${content.slice(0, 60)}…` : content;
    const link = `/projects/${projectId}/workspace/${def.code}?comment=${root ? root.get('id') : comment.get('id')}`;
    const base = { projectId, spaceName: pc.spaceName, code: def.code, link };
    if (mentions.length) {
      await notify(ctx, { ...base, userIds: mentions, kind: 'mention', title: `${author}在《${def.name}》里提到了你`, content: `${where}：${excerpt}` }, transaction);
    }
    let others: number[];
    if (root) {
      const thread = await repo.find({ filter: { $or: [{ id: root.get('id') }, { parentId: root.get('id') }] }, fields: ['createdById'], transaction });
      others = thread.map((c: any) => c.get('createdById'));
    } else {
      others = await projectMemberIds(ctx, projectId, ['ent_lead', 'lead_consultant'], transaction);
    }
    others = others.filter((id) => !mentions.includes(id));
    if (others.length) {
      await notify(
        ctx,
        { ...base, userIds: others, kind: 'comment', title: root ? `${author}回复了《${def.name}》的批注` : `${author}批注了《${def.name}》`, content: `${where}：${excerpt}` },
        transaction,
      );
    }
    return { id: Number(comment.get('id')) };
  });
}

export async function resolveComment(ctx: Context, pc: ProjectContext, input: { id?: unknown; resolved?: unknown }) {
  requireCommenter(pc);
  const repo = ctx.db.getRepository('dz_comments');
  const comment = await repo.findOne({ filter: { id: Number(input.id), projectId: pc.project.get('id') } });
  if (!comment) throw new HttpError(404, '批注不存在');
  if (comment.get('parentId')) throw new HttpError(400, '请在批注主题上标记解决');
  const userId = currentUserId(ctx);
  const allowed = pc.access.isConsultAdmin || comment.get('createdById') === userId || ['ent_lead', 'lead_consultant'].includes(pc.projectRole ?? '');
  if (!allowed) throw new HttpError(403, '只有批注人、企业项目负责人或主咨询师可以标记解决');
  const resolved = input.resolved !== false;
  await comment.update({ resolved, resolvedById: resolved ? userId : null, resolvedAt: resolved ? new Date() : null });
  return { resolved };
}

/** Unresolved threads per artifact code, for the step bar and the registry. */
export async function openCommentCounts(ctx: Context, projectId: number): Promise<Record<string, number>> {
  const rows = await ctx.db.getRepository('dz_comments').find({
    filter: { projectId, parentId: { $empty: true }, resolved: { $ne: true } },
    fields: ['code'],
  });
  const out: Record<string, number> = {};
  for (const r of rows as any[]) out[r.get('code')] = (out[r.get('code')] ?? 0) + 1;
  return out;
}
