import type { Context } from '@nocobase/actions';

import { ARTIFACTS, type ArtifactDef, type ArtifactStatus, diffPayloads, summarizeDiff } from '../../shared';
import { HttpError, type ProjectContext } from './access';

// 成果管理页 and 交付页 (spec 二(一)7): every artifact's state, versions, operators and the
// difference between the AI draft and the locked version; delivery payloads and export log.

const who = (user: any) => (user ? user.get('nickname') || user.get('username') || '' : '');

export async function artifactRegistry(ctx: Context, pc: ProjectContext) {
  const projectId = pc.project.get('id');
  const [rows, versions, events] = await Promise.all([
    ctx.db.getRepository('dz_artifacts').find({ filter: { projectId } }),
    ctx.db.getRepository('dz_artifact_versions').find({
      filter: { projectId },
      fields: ['id', 'code', 'rev', 'kind', 'createdAt', 'createdById'],
      appends: ['createdBy'],
      sort: ['code', 'rev'],
    }),
    ctx.db.getRepository('dz_audit_events').find({
      filter: { projectId, code: { $notEmpty: true } },
      fields: ['id', 'code', 'action', 'createdAt', 'createdById', 'toStatus'],
      appends: ['createdBy'],
      sort: ['-createdAt'],
    }),
  ]);
  const byCode = new Map(rows.map((r: any) => [r.get('code'), r]));

  // AI draft vs locked version: the latest AI version at or before the locked rev.
  const diffs = new Map<string, { aiRev: number; lockedRev: number; added: number; removed: number; changed: number }>();
  const pairs: { code: string; aiId: number; aiRev: number; lockedId: number; lockedRev: number }[] = [];
  for (const row of rows as any[]) {
    const lockedId = row.get('lockedVersionId');
    if (!lockedId) continue;
    const own = versions.filter((v: any) => v.get('code') === row.get('code'));
    const locked = own.find((v: any) => v.get('id') === lockedId);
    if (!locked) continue;
    const ai = own.filter((v: any) => v.get('kind') === 'ai_draft' && v.get('rev') <= locked.get('rev')).pop();
    if (ai) pairs.push({ code: row.get('code'), aiId: ai.get('id'), aiRev: ai.get('rev'), lockedId, lockedRev: locked.get('rev') });
  }
  if (pairs.length) {
    const payloads = await ctx.db.getRepository('dz_artifact_versions').find({
      filter: { id: { $in: pairs.flatMap((p) => [p.aiId, p.lockedId]) } },
      fields: ['id', 'payload'],
    });
    const payload = new Map(payloads.map((p: any) => [p.get('id'), p.get('payload')]));
    for (const p of pairs) {
      const summary = summarizeDiff(diffPayloads(payload.get(p.aiId), payload.get(p.lockedId)));
      diffs.set(p.code, { aiRev: p.aiRev, lockedRev: p.lockedRev, ...summary });
    }
  }

  return ARTIFACTS.map((def) => {
    const row: any = byCode.get(def.code);
    const own = versions.filter((v: any) => v.get('code') === def.code);
    const last = events.find((e: any) => e.get('code') === def.code);
    const lockedId = row?.get('lockedVersionId');
    return {
      code: def.code,
      status: (row?.get('status') as ArtifactStatus) ?? 'not_started',
      stale: !!row?.get('stale'),
      currentRev: row?.get('currentRev') ?? 0,
      lockedRev: own.find((v: any) => v.get('id') === lockedId)?.get('rev') ?? null,
      updatedAt: row?.get('updatedAt') ?? null,
      versions: {
        total: own.length,
        ai: own.filter((v: any) => v.get('kind') === 'ai_draft').length,
        enterprise: own.filter((v: any) => v.get('kind') === 'enterprise_edit').length,
        consultant: own.filter((v: any) => v.get('kind') === 'consultant_revision').length,
      },
      lastEvent: last ? { action: last.get('action'), at: last.get('createdAt'), by: who(last.get('createdBy')) } : null,
      aiDiff: diffs.get(def.code) ?? null,
    };
  });
}

export async function artifactHistory(ctx: Context, pc: ProjectContext, def: ArtifactDef) {
  const projectId = pc.project.get('id');
  const [versions, events] = await Promise.all([
    ctx.db.getRepository('dz_artifact_versions').find({
      filter: { projectId, code: def.code },
      fields: ['id', 'rev', 'kind', 'note', 'changes', 'createdAt', 'createdById'],
      appends: ['createdBy'],
      sort: ['-rev'],
    }),
    ctx.db.getRepository('dz_audit_events').find({
      filter: { projectId, code: def.code },
      appends: ['createdBy'],
      sort: ['-createdAt'],
      limit: 200,
    }),
  ]);
  return {
    versions: versions.map((v: any) => ({ rev: v.get('rev'), kind: v.get('kind'), note: v.get('note') ?? '', at: v.get('createdAt'), by: who(v.get('createdBy')), changes: v.get('changes') ?? [] })),
    events: events.map((e: any) => ({
      action: e.get('action'),
      fromStatus: e.get('fromStatus') ?? null,
      toStatus: e.get('toStatus') ?? null,
      rev: e.get('rev') ?? null,
      reason: e.get('reason') ?? '',
      at: e.get('createdAt'),
      by: who(e.get('createdBy')),
    })),
  };
}

const MAX_VALUE = 400;
function preview(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

/** One saved version's content, for the 修订 view that compares the draft with any version. */
export async function versionPayload(ctx: Context, pc: ProjectContext, def: ArtifactDef, rev: unknown) {
  const v: any = await ctx.db.getRepository('dz_artifact_versions').findOne({
    filter: { projectId: pc.project.get('id'), code: def.code, rev: Number(rev) },
    appends: ['createdBy'],
  });
  if (!v) throw new HttpError(404, '版本不存在');
  return { rev: v.get('rev'), kind: v.get('kind'), at: v.get('createdAt'), by: who(v.get('createdBy')), payload: v.get('payload') };
}

export async function versionDiff(ctx: Context, pc: ProjectContext, def: ArtifactDef, fromRev: unknown, toRev: unknown) {
  const from = Number(fromRev);
  const to = Number(toRev);
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new HttpError(400, '请选择要对比的两个版本');
  const rows = await ctx.db.getRepository('dz_artifact_versions').find({
    filter: { projectId: pc.project.get('id'), code: def.code, rev: { $in: [from, to] } },
    fields: ['rev', 'payload'],
  });
  const a = rows.find((r: any) => r.get('rev') === from);
  const b = rows.find((r: any) => r.get('rev') === to);
  if (!a || !b) throw new HttpError(404, '版本不存在');
  const entries = diffPayloads(a.get('payload'), b.get('payload'));
  return {
    from,
    to,
    summary: summarizeDiff(entries),
    entries: entries.slice(0, 300).map((e) => ({ path: e.path, kind: e.kind, before: preview(e.before), after: preview(e.after) })),
    truncated: entries.length > 300,
  };
}

/** Payload per artifact for delivery exports: the locked version when there is one. */
export async function deliveryBundle(ctx: Context, pc: ProjectContext) {
  const projectId = pc.project.get('id');
  const [rows, exports] = await Promise.all([
    ctx.db.getRepository('dz_artifacts').find({ filter: { projectId }, appends: ['currentVersion', 'lockedVersion'] }),
    ctx.db.getRepository('dz_exports').find({ filter: { projectId }, appends: ['createdBy'], sort: ['-createdAt'], limit: 200 }),
  ]);
  return {
    artifacts: rows
      .filter((r: any) => r.get('currentVersionId'))
      .map((r: any) => {
        const locked = r.get('lockedVersion');
        const current = r.get('currentVersion');
        const useLocked = r.get('status') === 'locked' && locked;
        const version = useLocked ? locked : current;
        return { code: r.get('code'), status: r.get('status'), rev: version?.get('rev') ?? 0, locked: !!useLocked, payload: version?.get('payload') ?? null };
      }),
    exports: exports.map((e: any) => ({
      id: e.get('id'),
      code: e.get('code'),
      rev: e.get('rev'),
      format: e.get('format'),
      fileName: e.get('fileName'),
      draft: !!e.get('draft'),
      at: e.get('createdAt'),
      by: who(e.get('createdBy')),
    })),
  };
}

export async function recordExport(ctx: Context, pc: ProjectContext, def: ArtifactDef, input: { rev?: unknown; format?: unknown; fileName?: unknown; draft?: unknown }) {
  const format = ['docx', 'xlsx', 'svg', 'png'].includes(String(input.format)) ? String(input.format) : null;
  if (!format) throw new HttpError(400, '未知的导出格式');
  await ctx.db.getRepository('dz_exports').create({
    values: {
      projectId: pc.project.get('id'),
      code: def.code,
      rev: Number(input.rev) || 0,
      format,
      fileName: String(input.fileName ?? '').slice(0, 200),
      draft: input.draft === true,
      spaceName: pc.spaceName,
    },
    context: ctx,
  });
  return { ok: true };
}
