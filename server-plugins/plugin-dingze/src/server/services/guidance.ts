import type { Context } from '@nocobase/actions';

import { type ArtifactDef, GAP_CATEGORIES, GAP_STATUSES, GAP_TEXT_LIMIT, type GapStatus, canMoveGap } from '../../shared';
import { HttpError, type ProjectContext, currentUserId, requireOps, systemAccess, userSpaceNames } from './access';
import { notify } from './notify';

const who = (user: any) => (user ? user.get('nickname') || user.get('username') || '' : '');

function text(value: unknown, label: string, required = false): string {
  const s = String(value ?? '').trim();
  if (required && !s) throw new HttpError(400, `${label}不能为空`);
  if (s.length > GAP_TEXT_LIMIT) throw new HttpError(400, `${label}不能超过 ${GAP_TEXT_LIMIT} 字`);
  return s;
}

/** Consultants on the project (and consulting admins) record gaps; enterprise members do not. */
export async function addGuidanceGap(
  ctx: Context,
  pc: ProjectContext,
  def: ArtifactDef,
  input: { category?: unknown; description?: unknown; expected?: unknown; excerpt?: unknown },
  pluginVersion: string,
) {
  const consultant = pc.projectRole === 'lead_consultant' || pc.projectRole === 'co_consultant';
  if (!consultant && !pc.access.isConsultAdmin) throw new HttpError(403, '只有咨询团队可以记录引导缺口');
  const category = String(input.category ?? 'missing');
  if (!(category in GAP_CATEGORIES)) throw new HttpError(400, '缺口类别不正确');
  const row = await ctx.db.getRepository('dz_guidance_gaps').create({
    values: {
      projectId: pc.project.get('id'),
      code: def.code,
      stage: def.stage,
      category,
      description: text(input.description, '缺口描述', true),
      expected: text(input.expected, '期望的引导'),
      excerpt: text(input.excerpt, '对话摘录'),
      pluginVersion,
      status: 'open',
    },
    context: ctx,
  });
  return { id: Number(row.get('id')) };
}

function serialize(g: any, projects: Map<number, { name: string; enterprise: string }>) {
  const projectId = g.get('projectId') ? Number(g.get('projectId')) : null;
  return {
    id: Number(g.get('id')),
    projectId,
    project: projectId ? projects.get(projectId) ?? null : null,
    code: g.get('code'),
    stage: g.get('stage'),
    category: g.get('category'),
    description: g.get('description') ?? '',
    expected: g.get('expected') ?? '',
    excerpt: g.get('excerpt') ?? '',
    pluginVersion: g.get('pluginVersion') ?? '',
    status: g.get('status') as GapStatus,
    reviewNote: g.get('reviewNote') ?? '',
    shippedVersion: g.get('shippedVersion') ?? '',
    author: who(g.get('createdBy')),
    reviewer: who(g.get('reviewedBy')),
    reviewedAt: g.get('reviewedAt') ?? null,
    at: g.get('createdAt'),
  };
}

/** Ops / consulting admins see every gap; project names only for projects in their spaces. */
export async function listGuidanceGaps(ctx: Context) {
  requireOps(await systemAccess(ctx));
  const rows = await ctx.db.getRepository('dz_guidance_gaps').find({ appends: ['createdBy', 'reviewedBy'], sort: ['-createdAt'] });
  const spaces = await userSpaceNames(ctx);
  const ids = [...new Set(rows.map((g: any) => Number(g.get('projectId'))).filter(Boolean))];
  const projects = new Map<number, { name: string; enterprise: string }>();
  if (ids.length && spaces.length) {
    const found = await ctx.db.getRepository('dz_projects').find({ filter: { id: { $in: ids }, spaceName: { $in: spaces } }, appends: ['enterprise'] });
    for (const p of found as any[]) {
      const e = p.get('enterprise');
      projects.set(Number(p.get('id')), { name: p.get('name'), enterprise: e ? e.get('shortName') || e.get('name') : '' });
    }
  }
  return rows.map((g: any) => serialize(g, projects));
}

export async function reviewGuidanceGap(ctx: Context, input: { id?: unknown; status?: unknown; reviewNote?: unknown; shippedVersion?: unknown }) {
  requireOps(await systemAccess(ctx));
  const repo = ctx.db.getRepository('dz_guidance_gaps');
  const gap: any = await repo.findOne({ filterByTk: Number(input.id) });
  if (!gap) throw new HttpError(404, '引导缺口不存在');
  const to = String(input.status ?? '') as GapStatus;
  if (!(to in GAP_STATUSES)) throw new HttpError(400, '评审状态不正确');
  const from = gap.get('status') as GapStatus;
  if (!canMoveGap(from, to)) throw new HttpError(409, `不能从「${GAP_STATUSES[from]}」改为「${GAP_STATUSES[to]}」`);
  const reviewNote = text(input.reviewNote, '评审意见');
  if (to === 'rejected' && !reviewNote) throw new HttpError(400, '不采纳时请写明理由');
  const shippedVersion = text(input.shippedVersion, '发布版本');
  if (to === 'shipped' && !shippedVersion) throw new HttpError(400, '请填写包含这条改进的插件版本');
  const userId = currentUserId(ctx);
  await repo.update({
    filterByTk: gap.get('id'),
    values: { status: to, reviewNote, shippedVersion: to === 'shipped' ? shippedVersion : gap.get('shippedVersion'), reviewedById: userId, reviewedAt: new Date(), updatedById: userId },
  });

  // Tell the consultant who recorded it, through their project's inbox.
  const project: any = gap.get('projectId') ? await ctx.db.getRepository('dz_projects').findOne({ filterByTk: gap.get('projectId') }) : null;
  if (project && gap.get('createdById')) {
    const excerpt = String(gap.get('description')).slice(0, 60);
    await notify(ctx, {
      projectId: project.get('id'),
      spaceName: project.get('spaceName'),
      userIds: [Number(gap.get('createdById'))],
      kind: 'guidance_gap',
      code: gap.get('code'),
      title: `你记录的引导缺口${GAP_STATUSES[to]}`,
      content: `${gap.get('code')}：${excerpt}${reviewNote ? `｜评审意见：${reviewNote}` : ''}${to === 'shipped' ? `｜已随插件 ${shippedVersion} 发布` : ''}`,
      link: `/projects/${project.get('id')}/workspace/${gap.get('code')}`,
    });
  }
  return { id: Number(gap.get('id')), status: to };
}
