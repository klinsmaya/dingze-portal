import { ACTION_LABELS, ARTIFACTS, STAGES, STATUS_LABELS, type ArtifactStatus, type StageKey, VERSION_KIND_LABELS } from "@dingze/shared";

import type { SheetModel } from "./export/sheets";
import type { RegistryRow } from "./records-api";

// Pure helpers behind the 成果管理页 (filtering, labels, the exported list).

export type RegistryFilter = { stage: StageKey | "all"; status: ArtifactStatus | "stale" | "all" };

/** P0 / P1, or 方法底稿 for method worksheets. */
export function priorityLabel(priority: string): string {
  return priority === "method" ? "方法底稿" : priority;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function filterRegistry(rows: RegistryRow[], filter: RegistryFilter): RegistryRow[] {
  return rows.filter((row) => {
    const def = ARTIFACTS.find((a) => a.code === row.code);
    if (!def) return false;
    if (filter.stage !== "all" && def.stage !== filter.stage) return false;
    if (filter.status === "stale") return row.stale;
    if (filter.status !== "all" && row.status !== filter.status) return false;
    return true;
  });
}

export function aiDiffLabel(diff: RegistryRow["aiDiff"]): string {
  if (!diff) return "—";
  const total = diff.added + diff.removed + diff.changed;
  if (total === 0) return `v${diff.aiRev}→v${diff.lockedRev} 未改动`;
  const parts = [diff.changed && `改 ${diff.changed}`, diff.added && `增 ${diff.added}`, diff.removed && `删 ${diff.removed}`].filter(Boolean);
  return `v${diff.aiRev}→v${diff.lockedRev} ${parts.join(" · ")}`;
}

export function versionMix(v: RegistryRow["versions"]): string {
  if (v.total === 0) return "—";
  const parts = [
    v.ai && `${VERSION_KIND_LABELS.ai_draft} ${v.ai}`,
    v.enterprise && `${VERSION_KIND_LABELS.enterprise_edit} ${v.enterprise}`,
    v.consultant && `${VERSION_KIND_LABELS.consultant_revision} ${v.consultant}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function eventLabel(event: RegistryRow["lastEvent"]): string {
  if (!event) return "—";
  return `${event.by || "—"} ${ACTION_LABELS[event.action] ?? event.action}`;
}

/** The registry as one sheet for “导出清单”. */
export function registrySheet(rows: RegistryRow[]): SheetModel {
  const stageName = (key: StageKey) => STAGES.find((s) => s.key === key)?.name ?? key;
  return {
    name: "成果清单",
    columns: [
      ["阶段", 10],
      ["编号", 10],
      ["成果", 28],
      ["级别", 6],
      ["状态", 10],
      ["上游已变更", 10],
      ["当前版本", 8],
      ["定版版本", 8],
      ["版本构成", 30],
      ["AI 初稿→定版", 22],
      ["最近操作", 20],
      ["最近操作时间", 18],
    ].map(([header, width]) => ({ header: header as string, width: width as number })),
    rows: rows.map((row) => {
      const def = ARTIFACTS.find((a) => a.code === row.code)!;
      return [
        stageName(def.stage),
        def.specId,
        def.name,
        priorityLabel(def.priority),
        STATUS_LABELS[row.status],
        row.stale ? "是" : null,
        row.currentRev || null,
        row.lockedRev,
        versionMix(row.versions),
        aiDiffLabel(row.aiDiff),
        eventLabel(row.lastEvent),
        formatTime(row.lastEvent?.at ?? row.updatedAt),
      ];
    }),
    merges: [],
  };
}
