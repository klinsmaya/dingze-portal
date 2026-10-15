import { type DiffEntry, dependentsOf, diffPayloads, getArtifactDef } from "@dingze/shared";

// 定版前展示 (验收意见 B02)：这次要定的版本和上一定版比改了什么、哪些表会以它为依据。

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "（空）";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 60)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `${v.length} 条`;
  const o = v as Record<string, unknown>;
  const label = o.name ?? o.title ?? o.path ?? o.task ?? o.metric;
  return typeof label === "string" && label ? label : "一条";
};

/** Readable change lines between two payloads (上游改了什么、定版前对比共用)。 */
export function describeChanges(before: unknown, after: unknown, nameOf: (path: string) => string = (p) => p, limit = 12) {
  const entries = diffPayloads(before, after);
  return {
    total: entries.length,
    changes: entries.slice(0, limit).map((e) => ({ where: nameOf(e.path), kind: e.kind, before: show(e.before), after: show(e.after) })),
  };
}

export type ConfirmSummary = {
  firstLock: boolean;
  lockedRev: number | null;
  total: number;
  changes: { where: string; kind: DiffEntry["kind"]; before: string; after: string }[];
  downstream: string[];
};

export function confirmSummary(
  code: string,
  current: unknown,
  locked: { rev: number; payload: unknown } | null | undefined,
  nameOf: (path: string) => string = (p) => p,
  limit = 8,
): ConfirmSummary {
  const entries = locked ? diffPayloads(locked.payload, current) : [];
  return {
    firstLock: !locked,
    lockedRev: locked?.rev ?? null,
    total: entries.length,
    changes: entries.slice(0, limit).map((e) => ({ where: nameOf(e.path), kind: e.kind, before: show(e.before), after: show(e.after) })),
    downstream: dependentsOf(code).map((c) => `${getArtifactDef(c).specId} ${getArtifactDef(c).plain}`),
  };
}
