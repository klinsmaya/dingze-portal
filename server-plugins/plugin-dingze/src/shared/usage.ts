// 数字咨询师用量 (spec 5.6 §6): recorded per project for the operations board, not billed.

export interface UsageEvent {
  sessionId: string;
  userId: number | null;
  occurredAt: string | Date;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface ProjectUsage {
  turns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** The same totals over the last 30 days. */
  turns30: number;
  tokens30: number;
  users: number;
  lastAt: string | null;
}

/** The project a conversation was opened for, from the page context sent with a message. */
export function projectIdFromWorkContext(workContext: unknown): number | null {
  if (!Array.isArray(workContext)) return null;
  for (const item of workContext) {
    const id = (item as { content?: { projectId?: unknown } } | null)?.content?.projectId;
    if (typeof id === 'number' && Number.isInteger(id)) return id;
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  }
  return null;
}

const DAY = 24 * 3600 * 1000;

/** Sums usage events per project; events of sessions with no known project are skipped. */
export function aggregateUsage(events: UsageEvent[], projectOfSession: (sessionId: string) => number | null | undefined, now = Date.now()): Map<number, ProjectUsage> {
  const since = now - 30 * DAY;
  const acc = new Map<number, ProjectUsage & { userSet: Set<number> }>();
  for (const e of events) {
    const projectId = projectOfSession(e.sessionId);
    if (!projectId) continue;
    const u = acc.get(projectId) ?? { turns: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, turns30: 0, tokens30: 0, users: 0, lastAt: null, userSet: new Set<number>() };
    const at = new Date(e.occurredAt).getTime();
    const total = Number(e.totalTokens) || (Number(e.inputTokens) || 0) + (Number(e.outputTokens) || 0);
    u.turns += 1;
    u.inputTokens += Number(e.inputTokens) || 0;
    u.outputTokens += Number(e.outputTokens) || 0;
    u.totalTokens += total;
    if (at >= since) {
      u.turns30 += 1;
      u.tokens30 += total;
    }
    if (e.userId != null) u.userSet.add(e.userId);
    if (Number.isFinite(at) && (!u.lastAt || at > Date.parse(u.lastAt))) u.lastAt = new Date(at).toISOString();
    acc.set(projectId, u);
  }
  return new Map([...acc].map(([id, { userSet, ...u }]) => [id, { ...u, users: userSet.size }]));
}
