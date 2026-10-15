import { type ArtifactStatus, STATUS_LABELS, dependentsOf, getArtifactDef } from "@dingze/shared";

// 影响清单（客户反馈 2026-10-15：内训后回去继续优化）：一张表改了或重开了，哪些下游要跟着核对。
// 第一层是直接引用它的表（已标“上游已变更”）；更下游的表等第一层重新完成或定版后才会被提示。

export type ImpactRow = {
  code: string;
  specId: string;
  name: string;
  depth: 1 | 2;
  /** Direct upstream this row is reached through (depth 2 only). */
  via?: string;
  status: ArtifactStatus;
  statusLabel: string;
  stale: boolean;
};

type Progress = { code: string; status: ArtifactStatus; stale: boolean };

export function impactList(code: string, artifacts: Progress[]): ImpactRow[] {
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  const rows: ImpactRow[] = [];
  const seen = new Set<string>([code]);
  const add = (c: string, depth: 1 | 2, via?: string) => {
    if (seen.has(c)) return;
    seen.add(c);
    const a = byCode.get(c);
    if (!a || a.status === "not_started") return;
    const def = getArtifactDef(c);
    rows.push({ code: c, specId: def.specId, name: def.plain, depth, via, status: a.status, statusLabel: STATUS_LABELS[a.status] ?? a.status, stale: a.stale });
  };
  const direct = dependentsOf(code);
  for (const c of direct) add(c, 1);
  for (const c of direct) for (const d of dependentsOf(c)) add(d, 2, getArtifactDef(c).plain);
  return rows;
}
