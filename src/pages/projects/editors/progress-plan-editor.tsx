import { CalendarRange, Table2, X } from "lucide-react";
import { useState } from "react";

import {
  type Issue,
  NODE_STATUS_LABELS,
  type NodeStatus,
  type PlanNode,
  type PlanRow,
  type ProgressPlan,
  type ProjectCharterSet,
  planNode,
  planRowsFromCharters,
  timeColumns,
  timeIndex,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: ProgressPlan;
  onChange: (next: ProgressPlan) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S3-02"?: ProjectCharterSet };
  projectYear: number;
  scheduleScale: "month" | "quarter";
};

const STATUS_TONE: Record<NodeStatus, string> = {
  planned: "border-border bg-card",
  in_progress: "border-brand bg-brand/10",
  done: "border-status-done-foreground bg-status-done",
  delayed: "border-destructive bg-destructive/10",
};

/** S3-05 (表 4-6) with its node table (S3-04, 表 4-5): time, name, result and acceptance per node. */
export function ProgressPlanEditor({ value, onChange, readOnly, issues, upstream, projectYear, scheduleScale }: Props) {
  const [view, setView] = useState<"table" | "timeline">("table");
  const invalid = errorAnchors(issues);
  const scale = value.scale ?? scheduleScale;
  const rows = value.rows ?? [];
  const seed = planRowsFromCharters(upstream["S3-02"], rows);
  const columns = timeColumns(scale, projectYear);
  const allNodes = rows.flatMap((r) => r.nodes ?? []);
  const set = (next: PlanRow[]) => onChange({ scale, rows: next });
  const setNodes = (row: PlanRow, nodes: PlanNode[]) => set(patchById(rows, row.id, { nodes }));

  return (
    <section aria-label="计划实施推进表" className="flex flex-col gap-4">
      <EditorToolbar hint={`时间刻度：${scale === "quarter" ? "季度" : "月度"}（运营管理里的项目设置）。节点四要素：时间、名称、成果、验收标准；项目阶段选填（如立项 → 设计 → 试产 → 验证 → 上市）。避免“推进、加强、持续优化”这类不可验收的描述。`}>
        <ImportButton label="导入项目及关键节点" count={seed.length} readOnly={readOnly} onClick={() => set([...rows, ...seed])} />
        <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as "table" | "timeline")} variant="outline" size="sm">
          <ToggleGroupItem value="table">
            <Table2 /> 节点表
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline">
            <CalendarRange /> 时间刻度
          </ToggleGroupItem>
        </ToggleGroup>
      </EditorToolbar>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">还没有导入项目</p>
      ) : view === "timeline" ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="sticky left-0 min-w-48 bg-muted px-2 py-2 text-left font-semibold">项目</th>
                {columns.map((c) => (
                  <th key={c} className="min-w-24 px-1 py-2 text-center font-semibold">
                    {scale === "quarter" ? c.slice(5) : `${Number(c.slice(5))} 月`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="sticky left-0 bg-card px-2 py-2 font-medium">{row.name}</td>
                  {columns.map((c) => {
                    const here = (row.nodes ?? []).filter((n) => timeIndex(n.time) === timeIndex(c));
                    return (
                      <td key={c} className="px-1 py-1">
                        {here.map((n) => (
                          <div key={n.id} className={cn("mb-1 rounded-md border px-1.5 py-1", STATUS_TONE[n.status])} title={`${n.deliverable}｜验收：${n.acceptance}`}>
                            <div className="font-semibold">{n.name}</div>
                            <div className="text-muted-foreground">{n.owner}</div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        rows.map((row) => (
          <div data-anchor={row.id} key={row.id} className={cn("overflow-hidden rounded-xl border bg-card", invalid.has(row.id) && "border-destructive/40")}>
            <div className="flex items-center gap-2 bg-muted px-3 py-2">
              <TextCell label="项目" value={row.name} onChange={(name) => set(patchById(rows, row.id, { name }))} readOnly={readOnly} className="max-w-md font-semibold" />
              <span className="text-xs text-muted-foreground">{(row.nodes ?? []).length} 个节点</span>
              <div className="ml-auto flex items-center gap-1">
                {!readOnly ? <AddButton label="节点" onClick={() => setNodes(row, [...(row.nodes ?? []), planNode()])} /> : null}
                <RowActions label={row.name} readOnly={readOnly} onRemove={() => set(removeById(rows, row.id))} onMove={(delta) => set(moveById(rows, row.id, delta))} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="w-28 px-2 py-2 text-left font-semibold">项目阶段</th>
                    <th className="w-32 px-2 py-2 text-left font-semibold">时间</th>
                    <th className="w-40 px-2 py-2 text-left font-semibold">节点名称</th>
                    <th className="px-2 py-2 text-left font-semibold">成果</th>
                    <th className="px-2 py-2 text-left font-semibold">验收标准</th>
                    <th className="w-24 px-2 py-2 text-left font-semibold">责任人</th>
                    <th className="w-24 px-2 py-2 text-left font-semibold">状态</th>
                    <th className="w-44 px-2 py-2 text-left font-semibold">前置节点</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {(row.nodes ?? []).map((n) => {
                    const nodes = row.nodes ?? [];
                    const patch = (p: Partial<PlanNode>) => setNodes(row, patchById(nodes, n.id, p));
                    return (
                      <tr data-anchor={n.id} key={n.id} className={cn("border-t align-top", invalid.has(n.id) && "bg-destructive/5")}>
                        <td className="px-1 py-1">
                          <TextCell label={`${n.name || "节点"} 阶段`} placeholder="如：立项" value={n.phase ?? ""} onChange={(phase) => patch({ phase })} readOnly={readOnly} />
                        </td>
                        <td className="px-1 py-1">
                          <NativeSelect size="sm" aria-label={`${n.name} 时间`} className="w-full" value={n.time} disabled={readOnly} onChange={(e) => patch({ time: e.target.value })}>
                            <NativeSelectOption value="">选择…</NativeSelectOption>
                            {[...columns, ...(n.time && !columns.includes(n.time) ? [n.time] : [])].map((c) => (
                              <NativeSelectOption key={c} value={c}>
                                {c}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </td>
                        {(["name", "deliverable", "acceptance", "owner"] as const).map((key) => (
                          <td key={key} className="px-1 py-1">
                            <TextCell label={`${n.name || "节点"} ${key}`} value={n[key]} onChange={(v) => patch({ [key]: v })} readOnly={readOnly} />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <NativeSelect size="sm" aria-label={`${n.name} 状态`} value={n.status} disabled={readOnly} onChange={(e) => patch({ status: e.target.value as NodeStatus })}>
                            {Object.entries(NODE_STATUS_LABELS).map(([k, label]) => (
                              <NativeSelectOption key={k} value={k}>
                                {label}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {(n.dependsOn ?? []).map((d) => (
                              <Badge key={d} variant="outline" className="gap-1 font-normal">
                                {allNodes.find((x) => x.id === d)?.name || "（已删除）"}
                                {!readOnly ? (
                                  <button type="button" aria-label="移除前置节点" onClick={() => patch({ dependsOn: n.dependsOn.filter((x) => x !== d) })}>
                                    <X className="size-3" />
                                  </button>
                                ) : null}
                              </Badge>
                            ))}
                            {!readOnly ? (
                              <NativeSelect size="sm" aria-label={`${n.name} 添加前置节点`} value="" onChange={(e) => e.target.value && patch({ dependsOn: [...(n.dependsOn ?? []), e.target.value] })}>
                                <NativeSelectOption value="">＋ 前置</NativeSelectOption>
                                {allNodes
                                  .filter((x) => x.id !== n.id && !(n.dependsOn ?? []).includes(x.id))
                                  .map((x) => (
                                    <NativeSelectOption key={x.id} value={x.id}>
                                      {x.time} {x.name}
                                    </NativeSelectOption>
                                  ))}
                              </NativeSelect>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-1 py-1">
                          <RowActions
                            label={n.name || "节点"}
                            readOnly={readOnly}
                            onRemove={() =>
                              set(
                                rows.map((r) => ({
                                  ...r,
                                  nodes: (r.nodes ?? []).filter((x) => x.id !== n.id).map((x) => ({ ...x, dependsOn: (x.dependsOn ?? []).filter((d) => d !== n.id) })),
                                }))
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
