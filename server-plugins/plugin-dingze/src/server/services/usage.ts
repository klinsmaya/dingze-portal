import type { Context } from '@nocobase/actions';

import { ARTIFACTS, type ProjectUsage, STAGES, type UsageEvent, aggregateUsage, projectIdFromWorkContext, stageGateCodes } from '../../shared';
import { requireOps, systemAccess, userSpaceNames } from './access';
import { openCommentCounts } from './comments';

// 运营看板: every enterprise and project the operator can see, with stage progress, the
// review backlog and the digital consultants' usage (recorded, not billed; spec 5.6 §6).

export const COACH_USERNAMES = ['dingze-strategy-coach', 'dingze-goal-coach', 'dingze-action-coach'];

/** sessionId → projectId, filling the cache for sessions seen for the first time. */
async function sessionProjects(ctx: Context, sessionIds: string[]): Promise<Map<string, number | null>> {
  const repo = ctx.db.getRepository('dz_ai_sessions');
  const out = new Map<string, number | null>();
  if (!sessionIds.length) return out;
  const known = await repo.find({ filter: { sessionId: { $in: sessionIds } } });
  for (const row of known as any[]) out.set(row.get('sessionId'), row.get('projectId') ? Number(row.get('projectId')) : null);
  const missing = sessionIds.filter((id) => !out.has(id));
  if (missing.length) {
    const messages = await ctx.db.getRepository('aiMessages').find({
      filter: { sessionId: { $in: missing }, role: 'user' },
      fields: ['sessionId', 'workContext', 'messageId'],
      sort: ['messageId'],
    });
    for (const id of missing) {
      const first = (messages as any[]).find((m) => m.get('sessionId') === id && projectIdFromWorkContext(m.get('workContext')) !== null);
      const projectId = first ? projectIdFromWorkContext(first.get('workContext')) : null;
      out.set(id, projectId);
      // A conversation without a project yet may get one later, so only hits are cached.
      if (projectId) await repo.create({ values: { sessionId: id, projectId } }).catch(() => undefined);
    }
  }
  return out;
}

export async function usageByProject(ctx: Context): Promise<Map<number, ProjectUsage>> {
  const events = await ctx.db.getRepository('aiUsageEvents').find({
    filter: { aiEmployeeUsername: { $in: COACH_USERNAMES } },
    fields: ['sessionId', 'userId', 'occurredAt', 'inputTokens', 'outputTokens', 'totalTokens'],
  });
  const rows: UsageEvent[] = (events as any[]).map((e) => ({
    sessionId: String(e.get('sessionId')),
    userId: e.get('userId') ?? null,
    occurredAt: e.get('occurredAt'),
    inputTokens: e.get('inputTokens'),
    outputTokens: e.get('outputTokens'),
    totalTokens: e.get('totalTokens'),
  }));
  const sessions = await sessionProjects(ctx, [...new Set(rows.map((e) => e.sessionId))]);
  return aggregateUsage(rows, (id) => sessions.get(id));
}

export async function opsBoard(ctx: Context) {
  requireOps(await systemAccess(ctx));
  const spaces = await userSpaceNames(ctx);
  if (!spaces.length) return { enterprises: [], projects: [] };
  const [enterprises, projects] = await Promise.all([
    ctx.db.getRepository('dz_enterprises').find({ filter: { spaceName: { $in: spaces } }, sort: ['-createdAt'] }),
    ctx.db.getRepository('dz_projects').find({ filter: { spaceName: { $in: spaces } }, sort: ['-createdAt'] }),
  ]);
  const ids = projects.map((p: any) => p.get('id'));
  const [artifacts, usage] = await Promise.all([
    ids.length ? ctx.db.getRepository('dz_artifacts').find({ filter: { projectId: { $in: ids } }, fields: ['projectId', 'code', 'status', 'stale', 'updatedAt'] }) : [],
    usageByProject(ctx),
  ]);
  const p0 = new Set(ARTIFACTS.filter((a) => a.priority === 'P0').map((a) => a.code));
  const rows = [];
  for (const p of projects as any[]) {
    const id = p.get('id');
    const own = (artifacts as any[]).filter((a) => a.get('projectId') === id);
    const status = (code: string) => own.find((a) => a.get('code') === code)?.get('status');
    const count = (s: string) => own.filter((a) => a.get('status') === s && p0.has(a.get('code'))).length;
    const lastAt = own.reduce<string | null>((latest, a) => {
      const at = a.get('updatedAt') ? new Date(a.get('updatedAt')).toISOString() : null;
      return at && (!latest || at > latest) ? at : latest;
    }, null);
    rows.push({
      id,
      name: p.get('name'),
      year: p.get('year'),
      enterpriseId: p.get('enterpriseId'),
      campId: p.get('campId') ?? null,
      stages: STAGES.map((s) => {
        const gate = stageGateCodes(s.key);
        return { key: s.key, name: s.name, locked: gate.filter((c) => status(c) === 'locked').length, total: gate.length };
      }),
      backlog: {
        stepDone: count('step_done'),
        inReview: count('in_review'),
        pendingConfirm: count('pending_confirm'),
        stale: own.filter((a) => a.get('stale')).length,
        comments: Object.values(await openCommentCounts(ctx, id)).reduce((a, b) => a + b, 0),
      },
      lastActivityAt: lastAt,
      usage: usage.get(id) ?? null,
    });
  }
  return {
    enterprises: enterprises.map((e: any) => ({ id: e.get('id'), name: e.get('name'), shortName: e.get('shortName'), status: e.get('status') })),
    projects: rows,
  };
}
