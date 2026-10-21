import { FileSpreadsheet, History } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ARTIFACTS, SPEC_ITEMS, STAGES, STATUS_LABELS, type ArtifactStatus, type SpecItem, type StageKey, getArtifactDef } from "@dingze/shared";

import { StatusBadge } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorMessage } from "@/lib/dingze/errors";
import { downloadXlsx } from "@/lib/dingze/export/xlsx";
import { workspacePath } from "@/lib/dingze/progress";
import { type RegistryFilter, aiDiffLabel, eventLabel, filterRegistry, formatTime, priorityLabel, registrySheet, versionMix } from "@/lib/dingze/records";
import type { RegistryRow } from "@/lib/dingze/records-api";
import { useArtifactRegistry } from "@/lib/dingze/records-queries";

import { ArtifactHistorySheet } from "./components/artifact-history";
import { useProjectContext } from "./project-context";

const STATUS_FILTERS: { value: RegistryFilter["status"]; label: string }[] = [
  { value: "all", label: "全部状态" },
  ...(["not_started", "in_progress", "step_done", "in_review", "pending_confirm", "locked"] as ArtifactStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  { value: "stale", label: "上游已变更" },
];

const DERIVED_LABELS = { view: "图形视图", embedded: "内嵌表", snapshot: "只读快照" } as const;

/** 成果与定版：every artifact of the project with state, versions, operators and AI-vs-locked difference. */
export default function ArtifactsPage({ embedded = false }: { embedded?: boolean }) {
  const { project } = useProjectContext();
  const registry = useArtifactRegistry(project);
  const [filter, setFilter] = useState<RegistryFilter>({ stage: "all", status: "all" });
  const [historyCode, setHistoryCode] = useState<string | null>(null);
  const rows = useMemo(() => filterRegistry(registry.data ?? [], filter), [registry.data, filter]);
  const all = registry.data ?? [];
  const isMethod = (code: string) => ARTIFACTS.find((a) => a.code === code)?.priority === "method";
  const tableCount = ARTIFACTS.filter((a) => a.priority !== "method").length;
  const locked = all.filter((r) => r.status === "locked" && !isMethod(r.code)).length;
  // 附录 B order: tables, views / embedded tables next to their source, S3-09 (out of V1).
  const shown = new Map(rows.map((r) => [r.code, r]));
  const listed = SPEC_ITEMS.flatMap((item): { item: SpecItem; row: RegistryRow | null }[] => {
    if (item.kind === "artifact") return shown.has(item.code) ? [{ item, row: shown.get(item.code)! }] : [];
    if (item.kind === "derived") return shown.has(item.derived.sourceCode) ? [{ item, row: shown.get(item.derived.sourceCode)! }] : [];
    return (filter.stage === "all" || filter.stage === item.stage) && filter.status === "all" ? [{ item, row: null }] : [];
  });
  const methods = rows.filter((r) => isMethod(r.code));

  const renderRow = (def: (typeof ARTIFACTS)[number], row: RegistryRow) => (
                  <tr key={row.code} className="border-t align-top">
                    <td className="px-3 py-2">
                      <Link to={workspacePath(project.id, row.code)} className="font-medium text-brand hover:underline">
                        《{def.name}》
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {def.specId}
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">
                          {priorityLabel(def.priority)}
                        </Badge>
                        {STAGES.find((s) => s.key === def.stage)?.name}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} stale={row.stale} />
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {row.currentRev ? `当前 v${row.currentRev}` : "—"}
                      {row.lockedRev ? <div className="text-muted-foreground">定版 v{row.lockedRev}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{versionMix(row.versions)}</td>
                    <td className="px-3 py-2 text-xs">{aiDiffLabel(row.aiDiff)}</td>
                    <td className="px-3 py-2 text-xs">
                      {eventLabel(row.lastEvent)}
                      <div className="text-muted-foreground">{formatTime(row.lastEvent?.at ?? row.updatedAt)}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <Button variant="ghost" size="sm" disabled={row.versions.total === 0} onClick={() => setHistoryCode(row.code)}>
                        <History /> 历史
                      </Button>
                    </td>
                  </tr>
  );

  const exportList = async () => {
    try {
      const stamp = formatTime(new Date().toISOString());
      await downloadXlsx(
        `${project.enterprise?.shortName ?? "企业"}-成果清单.xlsx`.replace(/[\\/:*?"<>|]/g, "_"),
        { title: "成果清单", subtitle: `${project.enterprise?.shortName ?? ""} · ${project.name} · 导出于 ${stamp}`, draft: false },
        [registrySheet(rows)]
      );
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    }
  };

  return (
    <div className={embedded ? "flex flex-col gap-5" : "mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6"}>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          {embedded ? null : <h1 className="font-heading text-2xl font-bold text-brand">成果与定版</h1>}
          <p className="mt-1 text-sm text-muted-foreground">
            附录 B 共 24 项成果：{tableCount} 张表独立填写和定版，4 项是图形视图或内嵌表（随所属表定版），S3-09 移出 V1。已定版 {locked} / {tableCount}。
            使命、愿景、经营预算是方法底稿，不单独编号、不计入成果。
          </p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportList} disabled={rows.length === 0}>
          <FileSpreadsheet /> 导出清单
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={[filter.stage]}
          onValueChange={(v) => v[0] && setFilter((f) => ({ ...f, stage: v[0] as StageKey | "all" }))}
          variant="outline"
          size="sm"
          aria-label="按阶段筛选"
        >
          <ToggleGroupItem value="all">全部阶段</ToggleGroupItem>
          {STAGES.map((s) => (
            <ToggleGroupItem key={s.key} value={s.key}>
              {s.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <NativeSelect size="sm" aria-label="按状态筛选" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as RegistryFilter["status"] }))}>
          {STATUS_FILTERS.map((s) => (
            <NativeSelectOption key={s.value} value={s.value}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {/* 与下表行数一致：附录 B 的成果项（含图形视图、内嵌表和移出项），方法底稿另列 (验收 D07)。 */}
        <span className="text-xs text-muted-foreground">
          {listed.length} 项 · 其中 {listed.filter((l) => l.item.kind === "artifact").length} 张表独立定版
        </span>
      </div>

      {registry.error ? (
        <Alert variant="destructive">
          <AlertTitle>成果清单加载失败</AlertTitle>
          <AlertDescription>{errorMessage(registry.error)}</AlertDescription>
        </Alert>
      ) : registry.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">成果</th>
                <th className="px-3 py-2 text-left font-semibold">状态</th>
                <th className="px-3 py-2 text-left font-semibold">版本</th>
                <th className="px-3 py-2 text-left font-semibold">版本构成</th>
                <th className="px-3 py-2 text-left font-semibold">AI 初稿 → 定版</th>
                <th className="px-3 py-2 text-left font-semibold">最近操作</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {listed.map(({ item, row }) => {
                if (item.kind === "out") {
                  return (
                    <tr key={item.specId} className="border-t align-top text-muted-foreground">
                      <td className="px-3 py-2">
                        <span className="font-medium">《{item.name}》</span>
                        <div className="mt-0.5 text-xs">{item.specId} · {STAGES.find((s) => s.key === item.stage)?.name}</div>
                      </td>
                      <td colSpan={6} className="px-3 py-2 text-xs">{item.note}</td>
                    </tr>
                  );
                }
                if (item.kind === "derived") {
                  const source = getArtifactDef(item.derived.sourceCode);
                  return (
                    <tr key={item.specId} className="border-t align-top">
                      <td className="px-3 py-2 pl-6">
                        <Link to={workspacePath(project.id, source.code)} className="font-medium text-brand hover:underline">
                          《{item.derived.name}》
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {item.specId}
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            {DERIVED_LABELS[item.derived.kind]}
                          </Badge>
                          在 {source.specId}《{source.name}》里
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row ? <StatusBadge status={row.status} stale={row.stale} /> : null}
                        <div className="mt-0.5 text-xs text-muted-foreground">随 {source.specId}</div>
                      </td>
                      <td colSpan={5} className="px-3 py-2 text-xs text-muted-foreground">与 {source.specId} 同一份数据，版本、复核和定版都跟随它。</td>
                    </tr>
                  );
                }
                const def = ARTIFACTS.find((a) => a.code === row!.code)!;
                return renderRow(def, row!);
              })}
              {listed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    没有符合筛选条件的成果
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {methods.length ? (
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">
            方法底稿 <span className="font-normal text-muted-foreground">· {methods.length} 份，不单独编号，结论写回所属成果</span>
          </summary>
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <tbody>{methods.map((row) => renderRow(ARTIFACTS.find((a) => a.code === row.code)!, row))}</tbody>
            </table>
          </div>
        </details>
      ) : null}
      <ArtifactHistorySheet project={project} code={historyCode} onClose={() => setHistoryCode(null)} />
    </div>
  );
}
