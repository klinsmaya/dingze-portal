import type { Context } from '@nocobase/actions';

import { getArtifactDef } from '../../shared';
import { HttpError, type ProjectContext } from './access';

// 计划书的来源版本 (验收 D01)：计划书在导出时由上游表拼出来，所以“定版 v2 的计划书”必须始终用 v2
// 定版那一刻的上游版本，不能读上游后来重开的草稿。定版时把来源写在计划书的定版版本上；更早定版、
// 没有这份记录的，按定版时间回溯。

export const PLAN_BOOKS = ['S3-07', 'S3-08'];

export type SourceBasis = 'locked' | 'draft' | 'at_time';
export type SourceRef = { versionId: number; rev: number; basis: SourceBasis };

const BASIS_LABELS: Record<SourceBasis, string> = {
  locked: '定版',
  draft: '草稿（未定版）',
  at_time: '计划书定版时的版本',
};

/** The upstream versions a plan book reads right now: locked where locked, else the current draft. */
export async function currentSources(ctx: Context, projectId: number, code: string, transaction?: any) {
  const refs: Record<string, SourceRef> = {};
  for (const dep of getArtifactDef(code).dependsOn) {
    const row = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code: dep }, appends: ['lockedVersion', 'currentVersion'], transaction });
    if (!row) continue;
    const locked = row.get('status') === 'locked' && row.get('lockedVersion');
    const version = locked ? row.get('lockedVersion') : row.get('currentVersion');
    if (version) refs[dep] = { versionId: version.get('id'), rev: version.get('rev'), basis: locked ? 'locked' : 'draft' };
  }
  return refs;
}

/** For a plan book locked before sources were recorded: what each upstream was when it was locked. */
async function sourcesAtLock(ctx: Context, projectId: number, code: string, plan: any) {
  const event = await ctx.db.getRepository('dz_audit_events').findOne({
    filter: { projectId, code, action: { $in: ['confirm', 'forceLock'] }, toStatus: 'locked', rev: plan.get('rev') },
    sort: ['-id'],
  });
  const lockAt = new Date(event?.get('createdAt') ?? plan.get('updatedAt') ?? plan.get('createdAt')).getTime();
  const refs: Record<string, SourceRef> = {};
  for (const dep of getArtifactDef(code).dependsOn) {
    const row = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code: dep }, appends: ['lockedVersion'] });
    if (!row) continue;
    const locked = row.get('lockedVersion');
    if (locked && new Date(locked.get('createdAt')).getTime() <= lockAt) {
      refs[dep] = { versionId: locked.get('id'), rev: locked.get('rev'), basis: 'locked' };
      continue;
    }
    const before = await ctx.db.getRepository('dz_artifact_versions').findOne({
      filter: { artifactId: row.get('id'), createdAt: { $lte: new Date(lockAt).toISOString() } },
      sort: ['-rev'],
    });
    if (before) refs[dep] = { versionId: before.get('id'), rev: before.get('rev'), basis: 'at_time' };
  }
  return refs;
}

/**
 * Everything a plan book export needs: the plan book's own version, the exact upstream versions
 * and their payloads, and a source list for the Word cover.
 */
export async function planBookSources(ctx: Context, pc: ProjectContext, code: string) {
  if (!PLAN_BOOKS.includes(code)) throw new HttpError(400, '只有计划书需要来源版本');
  const projectId = pc.project.get('id');
  const row = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code }, appends: ['lockedVersion', 'currentVersion'] });
  if (!row || !row.get('currentVersionId')) throw new HttpError(404, '计划书还没有内容');
  const locked = row.get('status') === 'locked' && row.get('lockedVersion');
  const plan = locked ? row.get('lockedVersion') : row.get('currentVersion');
  let refs: Record<string, SourceRef>;
  let recorded = true;
  if (locked) {
    const stored = plan.get('sources') as Record<string, SourceRef> | null;
    if (stored && Object.keys(stored).length) refs = stored;
    else {
      refs = await sourcesAtLock(ctx, projectId, code, plan);
      recorded = false;
    }
  } else refs = await currentSources(ctx, projectId, code);

  const ids = Object.values(refs).map((r) => r.versionId);
  const versions = ids.length ? await ctx.db.getRepository('dz_artifact_versions').find({ filter: { id: { $in: ids } } }) : [];
  const payloads: Record<string, unknown> = {};
  const sources = [];
  for (const [dep, ref] of Object.entries(refs)) {
    const v = (versions as any[]).find((x) => x.get('id') === ref.versionId);
    if (!v) continue;
    payloads[dep] = v.get('payload');
    const d = getArtifactDef(dep);
    sources.push({ code: dep, specId: d.specId, name: d.name, rev: ref.rev, basis: ref.basis, basisLabel: BASIS_LABELS[ref.basis] });
  }
  return {
    code,
    locked: !!locked,
    rev: plan.get('rev') as number,
    payload: plan.get('payload'),
    /** false: an older lock whose sources were reconstructed from the lock time. */
    recorded,
    stale: !!row.get('stale'),
    staleReason: row.get('staleReason') ?? null,
    sources,
    payloads,
  };
}
