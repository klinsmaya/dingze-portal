import { Columns3, CornerDownRight, LayoutPanelLeft, Network, Plus, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

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
import { FIGURE_3_7, type Figure37Item, figureTag } from "@/lib/dingze/figure-3-7";
import { errorAnchors } from "@/lib/dingze/rows";
import { normalize } from "@/lib/dingze/tree-ops";
import { SheetTable } from "@/pages/projects/components/sheet-table";
import { cn } from "@/lib/utils";

import { Figure37Card } from "./find-path";
import { EditorToolbar, ImportButton, TextCell } from "./kit";
import { MoveToDialog, type TreeConfig, TreeMindMap, TreeNodeMenu, useTreeActions } from "./tree-editor";

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
  /** Spec ID of the mind-map view: S2-02 for the company system. */
  graphSpecId?: string;
  /** Key under which the person's last view is remembered. */
  viewKey?: string;
  defaultView?: "table" | "mind" | "t310";
};

type View = "table" | "mind" | "t39" | "t310";

const LEVEL_LABELS = ["", "一级路径", "二级路径", "三级路径", "四级路径"];

function rememberedView(key: string | undefined, fallback: View): View {
  try {
    const v = key ? window.localStorage.getItem(`dingze:view:${key}`) : null;
    return v === "table" || v === "mind" || v === "t39" || v === "t310" ? v : fallback;
  } catch {
    return fallback;
  }
}

/** “推得回来” at a glance: the children's sum when they share the parent's metric and unit. */
function rollUp(node: Node, nodes: Node[]): { sum: number; ok: boolean } | null {
  const kids = nodes.filter((n) => n.parentId === node.id);
  if (kids.length === 0 || typeof node.amount !== "number") return null;
  if (!kids.every((k) => typeof k.amount === "number" && k.metric.trim() === node.metric.trim() && (k.unit ?? "") === (node.unit ?? ""))) return null;
  // Round away float noise (0.8 + 0.4 = 1.2000000000000002).
  const sum = Number(kids.reduce((acc, k) => acc + (k.amount as number), 0).toFixed(6));
  return { sum, ok: Math.abs(sum - node.amount) < 1e-6 };
}

const amountOf = (n: Node) => (typeof n.amount === "number" ? n.amount : parseAmount(n.value));

/** S2-03 / S2-06: goal → 1st … 4th level paths, each with metric and value (分得下去、推得回来). */
export function PathSystemEditor({ value, onChange, readOnly, issues, goals, goalWord, importFromMap, decodeLayout, graphSpecId, viewKey, defaultView = "table" }: Props) {
  const [view, setViewState] = useState<View>(() => rememberedView(viewKey, defaultView));
  const setView = (v: View) => {
    setViewState(v);
    try {
      if (viewKey) window.localStorage.setItem(`dingze:view:${viewKey}`, v);
    } catch {
      // Not remembered in private mode.
    }
  };
  const invalid = errorAnchors(issues);
  const nodes = (value.nodes ?? []) as Node[];
  // Keep the other parts of the payload (the S2-03 target zone) when paths change.
  const set = (next: Node[]) => onChange({ ...value, nodes: next });
  const layoutGoals = goals.map((g) => ({ id: g.id, label: g.label, target: [g.metric, g.value].filter(Boolean).join(" ") }));
  const [t39, t310] = pathSystemSheets(value, layoutGoals, true);
  const patch = (id: string, p: Partial<Node>) =>
    set(nodes.map((n) => (n.id === id ? { ...n, ...p, ...(p.value !== undefined ? { amount: parseAmount(p.value) } : {}) } : n)));
  const addRoot = (goal: PathGoal, extra: Partial<Node> = {}) => set(normalize([...nodes, pathNode({ goalId: goal.id, level: 1, ...extra })]));

  const goalTotal = (goalId: string, list: Node[]) => {
    const roots = list.filter((n) => !n.parentId && n.goalId === goalId);
    const amounts = roots.map(amountOf);
    return amounts.every((a) => typeof a === "number") && roots.length ? (amounts as number[]).reduce((a, b) => a + b, 0) : null;
  };
  const cfg: TreeConfig<Node> = useMemo(
    () => ({
      nodes,
      setNodes: set,
      make: (p) => pathNode(p),
      maxLevel: MAX_PATH_LEVEL,
      title: (n) => n.path,
      copyForSplit: (n) => ({ path: n.path ? `${n.path}（拆分）` : "", metric: n.metric, unit: n.unit, perspective: n.perspective }),
      combine: (keep, gone) => {
        const a = amountOf(keep);
        const b = amountOf(gone);
        const sameMetric = keep.metric.trim() === gone.metric.trim();
        const total = sameMetric && typeof a === "number" && typeof b === "number" ? a + b : null;
        return {
          path: [keep.path, gone.path].filter(Boolean).join("、"),
          ...(total !== null ? { value: `${total}`, amount: total } : {}),
        };
      },
      roots: goals.map((g) => ({ id: g.id, label: g.label, sub: [g.metric, g.value].filter(Boolean).join(" ") })),
      levelWord: (l) => LEVEL_LABELS[l] ?? `${l} 级路径`,
      previewNote: (next, id) => {
        const moved = next.find((n) => n.id === id);
        if (!moved) return null;
        if (moved.parentId) {
          const parent = next.find((n) => n.id === moved.parentId);
          const roll = parent ? rollUp(parent, next) : null;
          return roll ? `移动后「${parent!.path}」下级合计 ${roll.sum}，本级 ${parent!.amount}${roll.ok ? "，推得回来" : "，推不回来（可以移动后再调）"}` : null;
        }
        const goal = goals.find((g) => g.id === moved.goalId);
        const total = goalTotal(moved.goalId ?? "", next);
        const target = goal ? parseAmount(goal.value) : null;
        if (total === null || target === null) return null;
        const d = total - target;
        return `移动后一级合计 ${total}${d === 0 ? "，等于" : d > 0 ? `，比${goalWord}多 ${d}` : `，比${goalWord}少 ${-d}`}${d ? "（可以移动后再调）" : ""}`;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, goals, goalWord, value],
  );
  const actions = useTreeActions(cfg);
  const [moving, setMoving] = useState<string | null>(null);
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

  // 图 3-7: which items already started a level-1 path, numbered like the design (第 N 条).
  const figureUsed: Record<string, number[]> = {};
  const firstGoal = goals[0];
  if (decodeLayout && firstGoal) {
    nodes
      .filter((n) => !n.parentId && n.groupTag)
      .forEach((n) => {
        const no = nodes.filter((x) => !x.parentId && x.goalId === n.goalId).indexOf(n) + 1;
        for (const key of Object.keys(FIGURE_KEYS)) if (FIGURE_KEYS[key] === n.groupTag) (figureUsed[key] ??= []).push(no);
      });
  }
  const pickFigure = (item: Figure37Item) => {
    if (!firstGoal) return;
    addRoot(firstGoal, { groupTag: figureTag(item), perspective: "financial" });
  };
  const rowTools = (n: Node) => (
    <div className="flex items-center justify-end gap-0.5">
      {!readOnly && n.level < MAX_PATH_LEVEL ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => actions.child(n.id)} title="新增下级">
          <Plus /> 下级
        </Button>
      ) : null}
      <TreeNodeMenu id={n.id} actions={actions} readOnly={readOnly} onMoveTo={setMoving} label={n.path || LEVEL_LABELS[n.level]} />
    </div>
  );

  return (
    <section aria-label="路径系统" className="flex flex-col gap-4">
      <EditorToolbar hint={`先 How 后 Who：每个${goalWord}拆出一级路径，再逐级分解到二、三级（标准图到四级）；每条路径都要有衡量指标和指标值，下级合计要推得回本级。思维导图和表格是同一份数据。`}>
        {importFromMap ? <ImportButton label="子步骤 5 · 从解码地图导入" count={importFromMap.count} readOnly={readOnly} onClick={importFromMap.run} /> : null}
        <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as View)} variant="outline" size="sm" className="flex-wrap" aria-label="展示方式">
          <ToggleGroupItem value="mind" title="思维导图：共创、发散、调整结构（拖动、下级 / 同级、升降级、移动到…）">
            <Network /> 思维导图 {graphSpecId ? <span className="text-[10px] opacity-70">{graphSpecId}</span> : null}
          </ToggleGroupItem>
          <ToggleGroupItem value="table" title="表格：逐格核数字、整理定稿">
            <Table2 /> 表格
          </ToggleGroupItem>
          {decodeLayout ? (
            <ToggleGroupItem value="t310" title="书中表 3-10：按财务、客户、内部流程、学习与成长四个层面排列；合并单元格按层级自动生成，可直接改">
              <LayoutPanelLeft /> 按层面 <span className="text-[10px] opacity-70">表 3-10</span>
            </ToggleGroupItem>
          ) : null}
          <ToggleGroupItem value="t39" title="书中表 3-9：目标在左，一、二、三、四级路径向右展开（导出 Excel 的样子）">
            <Columns3 /> 横排表 <span className="text-[10px] opacity-70">表 3-9</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </EditorToolbar>

      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          还没有{goalWord}：请先完成上游表格。
        </p>
      ) : view === "mind" ? (
        <TreeMindMap
          cfg={cfg}
          readOnly={readOnly}
          invalid={invalid}
          fields={[
            { key: "path", label: "路径", placeholder: "动词＋宾语" },
            { key: "metric", label: "衡量指标" },
            { key: "value", label: "指标值" },
          ]}
          patch={patch}
          detail={(n) => [n.metric, n.value, n.unit && !n.value.includes(n.unit) ? n.unit : ""].filter(Boolean).join(" ") || "（未填指标）"}
          tag={(n) => n.groupTag || (n.level === 1 && n.perspective ? PERSPECTIVES.find((p) => p.key === n.perspective)?.label : null)}
          rollUp={(n) => {
            const roll = rollUp(n, nodes);
            return roll ? { ok: roll.ok, text: roll.ok ? `下级合计 ${roll.sum} ✓` : `下级合计 ${roll.sum} ≠ ${n.amount}` } : null;
          }}
          rootCards={goals.map((g) => {
            const total = goalTotal(g.id, nodes);
            return {
              root: { id: g.id, label: g.label, sub: [g.metric, g.value].filter(Boolean).join(" ") },
              badge: [g.group, total !== null ? `一级合计 ${total}` : null].filter(Boolean).join(" · ") || undefined,
              nodes: nodes.filter((n) => !n.parentId && n.goalId === g.id),
              onAdd: () => addRoot(g),
            };
          })}
          emptyHint={decodeLayout ? "＋ 一级路径 · 按图 3-7 两组想" : "还没有路径"}
          side={decodeLayout && !readOnly ? <Figure37Card used={figureUsed} onPick={pickFigure} readOnly={readOnly} defaultOpen={!nodes.some((n) => !n.parentId)} /> : undefined}
        />
      ) : view === "t39" ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">表 3-9 横排表：只读预览，与“导出 Excel”里的布局一致；在“表格”“按层面”或“思维导图”里修改。</p>
          <SheetTable sheet={t39} />
        </div>
      ) : view === "t310" && t310 ? (
        <PathWideTable goals={goals} nodes={nodes} readOnly={readOnly} invalid={invalid} patch={patch} rowTools={rowTools} />
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
                <PathRows rows={rows} nodes={nodes} readOnly={readOnly} invalid={invalid} patch={patch} rowTools={rowTools} />
              </div>
            );
          })}
          {unattached.length ? (
            <div className="overflow-hidden rounded-xl border border-destructive/40 bg-card">
              <div className="bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive">没有挂到{goalWord}的路径</div>
              <PathRows rows={unattached} nodes={nodes} readOnly={readOnly} invalid={invalid} patch={patch} rowTools={rowTools} goals={goals} />
            </div>
          ) : null}
        </div>
      )}
      {view !== "mind" ? <MoveToDialog cfg={cfg} nodeId={moving} actions={actions} onClose={() => setMoving(null)} orderedNodes={ordered} /> : null}
    </section>
  );
}

const FIGURE_KEYS: Record<string, string> = Object.fromEntries(
  FIGURE_3_7.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => [i.key, figureTag(i)]))),
);

function PathRows({
  rows,
  nodes,
  readOnly,
  invalid,
  patch,
  rowTools,
  goals,
}: {
  rows: Node[];
  nodes: Node[];
  readOnly: boolean;
  invalid: Set<string>;
  patch: (id: string, p: Partial<Node>) => void;
  rowTools: (node: Node) => React.ReactNode;
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
                <td className="px-1 py-1">{rowTools(n)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 表 3-10 按层面: the same nodes as a wide table — 层面 | 一级路径 衡量指标 指标值 | 二级 … — with
 * merged cells computed from the levels (never merged by hand). Every cell edits in place.
 */
function PathWideTable({
  goals,
  nodes,
  readOnly,
  invalid,
  patch,
  rowTools,
}: {
  goals: PathGoal[];
  nodes: Node[];
  readOnly: boolean;
  invalid: Set<string>;
  patch: (id: string, p: Partial<Node>) => void;
  rowTools: (node: Node) => React.ReactNode;
}) {
  const levels = Math.max(2, ...nodes.map((n) => n.level));
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  type Cell = { node: Node; span: number } | "covered" | undefined;
  const groupsFor = (goalId: string) => {
    const roots = nodes.filter((n) => !n.parentId && n.goalId === goalId);
    const keys = [...PERSPECTIVES.map((p) => p.key as string), ""];
    return keys
      .map((key) => ({ key, label: PERSPECTIVES.find((p) => p.key === key)?.label ?? "未分层面", roots: roots.filter((r) => (r.perspective ?? "") === key) }))
      .filter((g) => g.roots.length || g.key !== "");
  };
  const emit = (n: Node, rows: Cell[][]) => {
    const start = rows.length;
    const kids = childrenOf(n.id);
    if (!kids.length) rows.push(Array.from({ length: levels }, () => undefined));
    else kids.forEach((k) => emit(k, rows));
    rows[start][n.level - 1] = { node: n, span: rows.length - start };
    for (let i = start + 1; i < rows.length; i++) rows[i][n.level - 1] = "covered";
  };
  const cellCls = "border px-1 py-1 align-top";
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table role="treegrid" aria-label="表 3-10 按层面" className="w-full border-collapse text-sm" style={{ minWidth: `${6 + levels * 34}rem` }}>
        <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="w-24 border px-2 py-2 text-left font-semibold">层面</th>
            {Array.from({ length: levels }, (_, i) => (
              <th key={i} colSpan={3} className="border px-2 py-2 text-left font-semibold">
                {LEVEL_LABELS[i + 1]} · 衡量指标 · 指标值
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {goals.map((goal) => (
            <PathWideGoal key={goal.id} goal={goal} levels={levels}>
              {groupsFor(goal.id).map((group) => {
                const rows: Cell[][] = [];
                group.roots.forEach((r) => emit(r, rows));
                if (!rows.length) {
                  return (
                    <tr key={group.key} className="text-muted-foreground">
                      <td className={cn(cellCls, "font-semibold")}>{group.label}</td>
                      <td className={cn(cellCls, "text-xs")} colSpan={levels * 3}>
                        这个层面还没有路径
                      </td>
                    </tr>
                  );
                }
                return rows.map((row, i) => (
                  <tr key={`${group.key}-${i}`}>
                    {i === 0 ? (
                      <td rowSpan={rows.length} className={cn(cellCls, "bg-muted/40 font-semibold")}>
                        {group.label}
                      </td>
                    ) : null}
                    {row.flatMap((cell, level) => {
                      if (cell === "covered") return [];
                      if (!cell) return [<td key={`e${level}`} colSpan={3} className={cn(cellCls, "bg-muted/20")} />];
                      const n = cell.node;
                      const label = n.path || LEVEL_LABELS[n.level];
                      const roll = rollUp(n, nodes);
                      return [
                        <td key={`${n.id}-p`} rowSpan={cell.span} data-anchor={n.id} className={cn(cellCls, "min-w-56", invalid.has(n.id) && "bg-destructive/5")}>
                          {n.groupTag ? <div className="px-1 text-[10px] text-muted-foreground">{n.groupTag}</div> : null}
                          <TextCell label={LEVEL_LABELS[n.level]} anchor={`${n.id}.path`} value={n.path} onChange={(path) => patch(n.id, { path })} readOnly={readOnly} />
                          {rowTools(n)}
                          {n.level === 1 && !readOnly ? (
                            <NativeSelect size="sm" aria-label={`${label} 层面`} value={n.perspective ?? ""} onChange={(e) => patch(n.id, { perspective: (e.target.value || undefined) as Perspective | undefined })}>
                              <NativeSelectOption value="">层面…</NativeSelectOption>
                              {PERSPECTIVES.map((p) => (
                                <NativeSelectOption key={p.key} value={p.key}>
                                  {p.label}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          ) : null}
                        </td>,
                        <td key={`${n.id}-m`} rowSpan={cell.span} className={cn(cellCls, "w-32")}>
                          <TextCell label={`${label} 衡量指标`} anchor={`${n.id}.metric`} value={n.metric} onChange={(metric) => patch(n.id, { metric })} readOnly={readOnly} />
                        </td>,
                        <td key={`${n.id}-v`} rowSpan={cell.span} className={cn(cellCls, "w-28")}>
                          <TextCell label={`${label} 指标值`} anchor={`${n.id}.value`} value={n.value} onChange={(v) => patch(n.id, { value: v })} readOnly={readOnly} />
                          {roll ? (
                            <div className={cn("px-1 pt-0.5 text-[11px]", roll.ok ? "text-status-done-foreground" : "font-semibold text-[color:var(--dz-ai)]")}>
                              下级合计 {roll.sum}
                              {roll.ok ? " ✓" : ` ≠ ${n.amount}`}
                            </div>
                          ) : null}
                        </td>,
                      ];
                    })}
                  </tr>
                ));
              })}
            </PathWideGoal>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">合并单元格按层级自动生成；行尾 ⋯ 里可以新增同级 / 下级、升降级、移动到…、拆分、合并、删除。</p>
    </div>
  );
}

function PathWideGoal({ goal, levels, children }: { goal: PathGoal; levels: number; children: React.ReactNode }) {
  return (
    <>
      <tr data-anchor={goal.id}>
        <td colSpan={1 + levels * 3} className="border bg-brand px-3 py-2 text-brand-foreground">
          {goal.group ? <Badge className="mr-2 bg-gold text-brand">{goal.group}</Badge> : null}
          <span className="font-heading font-bold">{goal.label}</span>
          <span className="ml-2 text-sm opacity-85">
            {goal.metric} {goal.value}
          </span>
        </td>
      </tr>
      {children}
    </>
  );
}
