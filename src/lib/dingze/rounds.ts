// 成果历史的轮次（客户反馈 2026-10-15：内训集中定版，回去后继续优化）：每次定版是一轮，
// 第 1 次定版之后的修改都属于“优化”。

type Event = { action: string; rev: number | null; at: string; by: string };

const LOCKS = ["confirm", "forceLock"];

/** Locked revisions in order: v → “第 N 次定版”. */
export function lockRounds(events: Event[]): Map<number, { no: number; label: string; at: string; by: string }> {
  const locks = events.filter((e) => LOCKS.includes(e.action) && e.rev).sort((a, b) => a.at.localeCompare(b.at));
  const out = new Map<number, { no: number; label: string; at: string; by: string }>();
  for (const e of locks) {
    if (out.has(e.rev!)) continue;
    const no = out.size + 1;
    out.set(e.rev!, { no, label: no === 1 ? "第 1 次定版" : `第 ${no} 次定版（优化）`, at: e.at, by: e.by });
  }
  return out;
}

/** Which round a revision belongs to: before the first lock, or after the N-th lock (优化第 N 轮). */
export function roundOf(rev: number, rounds: Map<number, { no: number }>): string {
  const locked = [...rounds.entries()].filter(([r]) => r <= rev).sort((a, b) => a[0] - b[0]);
  if (!locked.length) return "首次定版前";
  const [lastRev, last] = locked[locked.length - 1];
  return lastRev === rev ? "" : `优化第 ${last.no} 轮`;
}
