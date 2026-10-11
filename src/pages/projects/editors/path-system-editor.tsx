import { Columns3, CornerDownRight, LayoutPanelLeft, ListTree, Plus, Table2 } from "lucide-react";
import { useState } from "react";

import {
  type GoalPathSystem,
  type Issue,
  MAX_PATH_LEVEL,
  PERSPECTIVES,
  type PathNode,
  type Perspective,
  orderedPaths,
  parseAmount,
  pathNode,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { pathSystemSheets } from "@/lib/dingze/export/sheets";
import { errorAnchors } from "@/lib/dingze/rows";
import { SheetTable } from "@/pages/projects/components/sheet-table";
import { cn } from "@/lib/utils";

import { EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Node = PathNode & { goalId?: string | null };

export type PathGoal = { id: string; label: string; metric: string; value: string; group?: string };

type Props = {
  value: GoalPathSystem;
  onChange: (next: GoalPathSystem) => void;
  readOnly: boolean;
  issues: Issue[];
  goals: PathGoal[];
  goalWord: string;
  /** 子步骤 5：导入解码地图（S2-03 only）. */
  importFromMap?: { count: number; run: () => void };
  /** S2-03 also offers 表 3-10 (paths by perspective, as imported from the decode map). */
  decodeLayout?: boolean;
  /** Spec ID of the graph view: S2-02 for the company system. */
  graphSpecId?: string;
};

type View = "fill" | "t39" | "t310" | "tree";

const LEVEL_LABELS = ["", "一级路径", "二级路径", "三级路径", "四级路径"];

function descendants(nodes: Node[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
        out.add(n.id);
        grew = true;
      }
    }
  }
  return out;
}

/** “推得回来” at a glance: the children's sum when they share the parent's metric and unit. */
function rollUp(node: Node, nodes: Node[]): { sum: number; ok: boolean } | null {
  const kids = nodes.filter((n) => n.parentId === node.id);
  if (kids.length === 0 || typeof node.amount !== "number") return null;
  if (!kids.every((k) => typeof k.amount === "number" && k.metric.trim() === node.metric.trim() && (k.unit ?? "") === (node.unit ?? ""))) return null;
  const sum = kids.reduce((acc, k) => acc + (k.amount as number), 0);
  return { sum, ok: Math.abs(sum - node.amount) < 1e-9 };
}

/** S2-03 / S2-06: goal → 1st … 4th level paths, each with metric and value (分得下去、推得回来). */
export function PathSystemEditor({ value, onChange, readOnly, issues, goals, goalWord, importFromMap, decodeLayout, graphSpecId }: Props) {
  const [view, setView] = useState<View>("fill");
  const invalid = errorAnchors(issues);
  const nodes = (value.nodes ?? []) as Node[];
  // Keep the other parts of the payload (the S2-03 target zone) when paths change.
  const set = (next: Node[]) => onChange({ ...value, nodes: next });
  const layoutGoals = goals.map((g) => ({ id: g.id, label: g.label, target: [g.metric, g.value].filter(Boolean).join(" ") }));
  const [t39, t310] = pathSystemSheets(value, layoutGoals, true);
  const patch = (id: string, p: Partial<Node>) =>
    set(nodes.map((n) => (n.id === id ? { ...n, ...p, ...(p.value !== undefined ? { amount: parseAmount(p.value) } : {}) } : n)));
  const addChild = (parent: Node) =>
    set([...nodes, pathNode({ parentId: parent.id, level: parent.level + 1, metric: parent.metric, unit: parent.unit, perspective: parent.perspective })]);
  const addRoot = (goal: PathGoal) => set([...nodes, pathNode({ goalId: goal.id, level: 1 })]);
  const remove = (id: string) => {
    const gone = descendants(nodes, id);
    set(nodes.filter((n) => !gone.has(n.id)));
  };
  const ordered = orderedPaths(nodes, goals.map((g) => g.id));
  const byGoal = (goalId: string) => {
    const roots = new Set(nodes.filter((n) => n.level === 1 && n.goalId === goalId).map((n) => n.id));
    return ordered.filter((n) => {
      let cur: Node | undefined = n;
      while (cur && cur.parentId) cur = nodes.find((x) => x.id === cur!.parentId);
      return !!cur && roots.has(cur.id);
    });
  };
  const unattached = ordered.filter((n) => {
    let cur: Node | undefined = n;
    while (cur && cur.parentId) cur = nodes.find((x) => x.id === cur!.parentId);
    return !cur || !goals.some((g) => g.id === cur!.goalId);
  });

  return (
    <section aria-label="路径系统" className="flex flex-col gap-4">
      <EditorToolbar hint={`先 How 后 Who：每个${goalWord}拆出一级路径，再逐级分解到二、三级（标准图到四级）；每条路径都要有衡量指标和指标值，下级合计要推得回本级。`}>
        {importFromMap ? <ImportButton label="子步骤 5 · 从解码地图导入" count={importFromMap.count} readOnly={readOnly} onClick={importFromMap.run} /> : null}
        <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as View)} variant="outline" size="sm" className="flex-wrap">
          <ToggleGroupItem value="fill" title="逐条填写路径、指标和指标值">
            <Table2 /> 填写
          </ToggleGroupItem>
          <ToggleGroupItem value="t39" title="书中表 3-9：目标在左，一、二、三、四级路径向右展开（Excel 表格式路径系统图）">
            <Columns3 /> 横排表 <span className="text-[10px] opacity-70">表 3-9</span>
          </ToggleGroupItem>
          {decodeLayout ? (
            <ToggleGroupItem value="t310" title="书中表 3-10：按财务、客户、内部流程、学习与成长四个层面排列（从解码地图导入的样子）">
              <LayoutPanelLeft /> 按层面 <span className="text-[10px] opacity-70">表 3-10</span>
            </ToggleGroupItem>
          ) : null}
          <ToggleGroupItem value="tree" title="路径系统图：思维导图式的图形视图，和表格是同一份数据">
            <ListTree /> 路径图 {graphSpecId ? <span className="text-[10px] opacity-70">{graphSpecId}</span> : null}
          </ToggleGroupItem>
        </ToggleGroup>
      </EditorToolbar>

      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          还没有{goalWord}：请先完成上游表格。
        </p>
      ) : view === "tree" ? (
        <PathTree goals={goals} nodes={nodes} />
      ) : view === "t39" || view === "t310" ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {view === "t39"
              ? "表 3-9 横排表：只读预览，与“导出 Excel”里的布局一致；修改请切回“填写”。"
              : "表 3-10 按层面：解码地图四个层面导入后的样子；只读预览，修改请切回“填写”。"}
          </p>
          <SheetTable sheet={view === "t39" ? t39 : (t310 ?? t39)} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal) => {
            const rows = byGoal(goal.id);
            return (
              <div data-anchor={goal.id} key={goal.id} className={cn("overflow-hidden rounded-xl border bg-card", invalid.has(goal.id) && "border-destructive/40")}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-brand px-4 py-2.5 text-brand-foreground">
                  {goal.group ? <Badge className="bg-gold text-brand">{goal.group}</Badge> : null}
                  <span className="font-heading font-bold">{goal.label}</span>
                  <span className="text-sm opacity-85">
                    {goal.metric} {goal.value}
                  </span>
                  {!readOnly ? (
                    <Button size="sm" variant="secondary" className="ml-auto" onClick={() => addRoot(goal)}>
                      <Plus /> 一级路径
                    </Button>
                  ) : null}
                </div>
                <PathRows rows={rows} nodes={nodes} readOnly={readOnly} invalid={invalid} patch={patch} addChild={addChild} remove={remove} />
              </div>
            );
          })}
          {unattached.length ? (
            <div className="overflow-hidden rounded-xl border border-destructive/40 bg-card">
              <div className="bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive">没有挂到{goalWord}的路径</div>
              <PathRows rows={unattached} nodes={nodes} readOnly={readOnly} invalid={invalid} patch={patch} addChild={addChild} remove={remove} goals={goals} />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function PathRows({
  rows,
  nodes,
  readOnly,
  invalid,
  patch,
  addChild,
  remove,
  goals,
}: {
  rows: Node[];
  nodes: Node[];
  readOnly: boolean;
  invalid: Set<string>;
  patch: (id: string, p: Partial<Node>) => void;
  addChild: (parent: Node) => void;
  remove: (id: string) => void;
  goals?: PathGoal[];
}) {
  if (rows.length === 0) return <p className="px-4 py-4 text-sm text-muted-foreground">还没有路径</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left font-semibold">路径（动词＋宾语）</th>
            <th className="w-28 px-2 py-2 text-left font-semibold">层面</th>
            <th className="w-40 px-2 py-2 text-left font-semibold">衡量指标</th>
            <th className="w-32 px-2 py-2 text-left font-semibold">指标值</th>
            <th className="w-20 px-2 py-2 text-left font-semibold">单位</th>
            <th className="w-40" />
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => {
            const roll = rollUp(n, nodes);
            const label = n.path || LEVEL_LABELS[n.level] || "路径";
            return (
              <tr data-anchor={n.id} key={n.id} className={cn("border-t align-top", invalid.has(n.id) && "bg-destructive/5")}>
                <td className="px-1 py-1">
                  <div className="flex items-start gap-1" style={{ paddingLeft: `${(n.level - 1) * 1.25}rem` }}>
                    {n.level > 1 ? <CornerDownRight className="mt-2.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <TextCell label={`${LEVEL_LABELS[n.level] ?? "路径"}`} placeholder={LEVEL_LABELS[n.level]} value={n.path} onChange={(path) => patch(n.id, { path })} readOnly={readOnly} />
                      {goals && n.level === 1 && !readOnly ? (
                        <NativeSelect size="sm" aria-label={`${label} 挂到`} value={n.goalId ?? ""} onChange={(e) => patch(n.id, { goalId: e.target.value || null })}>
                          <NativeSelectOption value="">挂到…</NativeSelectOption>
                          {goals.map((g) => (
                            <NativeSelectOption key={g.id} value={g.id}>
                              {g.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-1 py-1">
                  {n.level === 1 ? (
                    <NativeSelect
                      size="sm"
                      aria-label={`${label} 层面`}
                      value={n.perspective ?? ""}
                      disabled={readOnly}
                      onChange={(e) => patch(n.id, { perspective: (e.target.value || undefined) as Perspective | undefined })}
                    >
                      <NativeSelectOption value="">—</NativeSelectOption>
                      {PERSPECTIVES.map((p) => (
                        <NativeSelectOption key={p.key} value={p.key}>
                          {p.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span className="px-2 text-xs text-muted-foreground">{LEVEL_LABELS[n.level]}</span>
                  )}
                </td>
                <td className="px-1 py-1">
                  <TextCell label={`${label} 衡量指标`} value={n.metric} onChange={(metric) => patch(n.id, { metric })} readOnly={readOnly} />
                </td>
                <td className="px-1 py-1">
                  <TextCell label={`${label} 指标值`} value={n.value} onChange={(v) => patch(n.id, { value: v })} readOnly={readOnly} />
                  {roll ? (
                    <div className={cn("px-1 pt-0.5 text-[11px]", roll.ok ? "text-status-done-foreground" : "text-destructive")}>
                      下级合计 {roll.sum}
                      {roll.ok ? " ✓" : ` ≠ ${n.amount}`}
                    </div>
                  ) : null}
                </td>
                <td className="px-1 py-1">
                  <TextCell label={`${label} 单位`} value={n.unit ?? ""} onChange={(unit) => patch(n.id, { unit })} readOnly={readOnly} />
                </td>
                <td className="px-1 py-1">
                  <div className="flex items-center justify-end gap-1">
                    {!readOnly && n.level < MAX_PATH_LEVEL ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => addChild(n)}>
                        <Plus /> 下级
                      </Button>
                    ) : null}
                    <RowActions label={label} readOnly={readOnly} onRemove={() => remove(n.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** S2-02 / 部门路径图: the same data as a tree. */
function PathTree({ goals, nodes }: { goals: PathGoal[]; nodes: Node[] }) {
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  const renderNode = (n: Node) => (
    <li key={n.id} className="relative pl-6 before:absolute before:top-0 before:left-2 before:h-full before:border-l before:border-border last:before:h-5">
      <span className="absolute top-5 left-2 w-4 border-t border-border" />
      <div className="my-1.5 inline-flex flex-col rounded-lg border bg-card px-3 py-1.5 text-sm shadow-xs">
        <span className="font-medium">{n.path || "（未命名）"}</span>
        <span className="text-xs text-muted-foreground">
          {n.metric} {n.value}
        </span>
      </div>
      {childrenOf(n.id).length ? <ul>{childrenOf(n.id).map(renderNode)}</ul> : null}
    </li>
  );
  return (
    <div className="flex flex-col gap-4 overflow-x-auto rounded-xl border bg-card p-4">
      {goals.map((g) => (
        <div key={g.id}>
          <div className="inline-flex flex-col rounded-lg bg-brand px-3 py-2 text-brand-foreground">
            <span className="font-heading font-bold">{g.label}</span>
            <span className="text-xs opacity-85">
              {g.metric} {g.value}
            </span>
          </div>
          <ul>{nodes.filter((n) => n.level === 1 && n.goalId === g.id).map(renderNode)}</ul>
        </div>
      ))}
    </div>
  );
}
