import {
  CircleCheck,
  ClipboardPaste,
  GitCompareArrows,
  RotateCcw,
  CornerDownRight,
  GripVertical,
  Network,
  Plus,
  Table2,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  type GoalPathSystem,
  type Issue,
  MAX_PATH_LEVEL,
  PERSPECTIVES,
  type PathNode,
  type Perspective,
  orderedPaths,
  additive,
  parseAmount,
  unitOf,
  pathNode,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ImportSource } from "@/components/dingze/import-source";
import { PATH_TEMPLATE } from "@/lib/dingze/import-templates";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { pathSystemSheets } from "@/lib/dingze/export/sheets";
import {
  FIGURE_3_7,
  type Figure37Item,
  figureTag,
} from "@/lib/dingze/figure-3-7";
import { REVEAL_EVENT, anchorCandidates } from "@/lib/dingze/locate";
import { errorAnchors } from "@/lib/dingze/rows";
import {
  type EditorChrome,
  useEditSession,
  useEditorChrome,
} from "@/pages/projects/components/edit-session";
import { parsePastedPaths } from "@/lib/dingze/paste-paths";
import { canMoveTo, childrenOf, normalize } from "@/lib/dingze/tree-ops";
import { SheetTable } from "@/pages/projects/components/sheet-table";
import { cn } from "@/lib/utils";

import { Figure37Card } from "./find-path";
import { PERSPECTIVE_STYLE } from "./perspective-style";
import { EditorToolbar, GridCell, ImportButton, TextCell } from "./kit";
import {
  MoveToDialog,
  RowHoverTools,
  type TreeActions,
  type TreeConfig,
  TreeMindMap,
  TreeNodeMenu,
  useTreeActions,
} from "./tree-editor";

type Node = PathNode & { goalId?: string | null };

export type PathGoal = {
  id: string;
  label: string;
  metric: string;
  value: string;
  unit?: string;
  group?: string;
};

/** Paths that measure different things support a goal together but have no sum (验收 E D02). */
const NOT_ADDITIVE = { ok: null, text: "口径不同：共同支撑，不求和" } as const;

/** The level-1 paths' sum, compared with the goal only when the goal is the same measure. */
function goalRoll(goal: PathGoal, paths: Node[], amounts: (number | null)[], compare: boolean) {
  if (paths.length === 0 || !amounts.every((a) => typeof a === "number")) return null;
  if (!additive(paths)) return NOT_ADDITIVE;
  const p = paths[0];
  const sameAsGoal =
    (!goal.metric.trim() || goal.metric.trim() === p.metric.trim()) && (!unitOf(goal) || unitOf(goal) === unitOf(p));
  return sumText(amounts as number[], compare && sameAsGoal ? parseAmount(goal.value) : null);
}

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
  /** Book titles of the two views, e.g. 《公司级目标路径系统图》 / 《…系统表》. */
  titles?: { map: string; mapChip: string; table: string; tableSpec: string };
  /** Key under which the person's last view is remembered. */
  viewKey?: string;
  defaultView?: "table" | "mind" | "t310";
};

type View = "table" | "mind" | "t39" | "t310";

const LEVEL_LABELS = ["", "一级路径", "二级路径", "三级路径", "四级路径"];

function rememberedView(key: string | undefined, fallback: View): View {
  try {
    const v = key ? window.localStorage.getItem(`dingze:view:${key}`) : null;
    return v === "table" || v === "mind" || v === "t39" || v === "t310"
      ? v
      : fallback;
  } catch {
    return fallback;
  }
}

/** “推得回来” at a glance: the children's sum when they share the parent's metric and unit. */
function rollUp(
  node: Node,
  nodes: Node[],
): { sum: number; ok: boolean } | null {
  const kids = nodes.filter((n) => n.parentId === node.id);
  if (kids.length === 0 || typeof node.amount !== "number") return null;
  if (
    !kids.every(
      (k) =>
        typeof k.amount === "number" &&
        k.metric.trim() === node.metric.trim() &&
        (k.unit ?? "") === (node.unit ?? ""),
    )
  )
    return null;
  // Round away float noise (0.8 + 0.4 = 1.2000000000000002).
  const sum = Number(
    kids.reduce((acc, k) => acc + (k.amount as number), 0).toFixed(6),
  );
  return { sum, ok: Math.abs(sum - node.amount) < 1e-6 };
}

const amountOf = (n: Node) =>
  typeof n.amount === "number" ? n.amount : parseAmount(n.value);

const num = (v: number) => String(Number(v.toFixed(6)));
/** “700 + 300 = 1000”, or “… = 900 ≠ 1000” when it does not add up. */
export function sumText(
  parts: number[],
  target: number | null,
): { ok: boolean | null; text: string } {
  const sum = Number(parts.reduce((a, b) => a + b, 0).toFixed(6));
  const terms =
    parts.length > 4
      ? `${parts.slice(0, 3).map(num).join(" + ")} + …`
      : parts.map(num).join(" + ");
  const expr = parts.length > 1 ? `${terms} = ${num(sum)}` : `合计 ${num(sum)}`;
  if (target === null) return { ok: null, text: expr };
  const ok = Math.abs(sum - target) < 1e-6;
  return { ok, text: ok ? expr : `${expr} ≠ ${num(target)}` };
}

/**
 * 拖动时的联动调整 (design 10 画面 3): a parent whose children added up before the move is offered
 * its new sum, so the branch it left (or joined) still 推得回来.
 */
function linkedAdjust(
  next: Node[],
  movedId: string,
  before: Node[],
): { label: string; apply: (nodes: Node[]) => Node[] } | null {
  const was = before.find((n) => n.id === movedId);
  const now = next.find((n) => n.id === movedId);
  if (!was || !now) return null;
  const changes: { id: string; path: string; from: number; to: number }[] = [];
  for (const parentId of new Set([was.parentId, now.parentId])) {
    if (!parentId) continue;
    const old = before.find((n) => n.id === parentId);
    const fresh = next.find((n) => n.id === parentId);
    if (!old || !fresh || !rollUp(old, before)?.ok) continue;
    const kids = next.filter((n) => n.parentId === parentId);
    if (
      !kids.length ||
      !kids.every(
        (k) =>
          typeof k.amount === "number" &&
          k.metric.trim() === fresh.metric.trim(),
      )
    )
      continue;
    const sum = Number(
      kids.reduce((a, k) => a + (k.amount as number), 0).toFixed(6),
    );
    if (typeof fresh.amount === "number" && Math.abs(sum - fresh.amount) > 1e-6)
      changes.push({
        id: parentId,
        path: fresh.path,
        from: fresh.amount,
        to: sum,
      });
  }
  if (!changes.length) return null;
  return {
    label: `同时把${changes.map((c) => `「${c.path || "上级"}」${num(c.from)} 改为 ${num(c.to)}`).join("，")}，保持推得回来`,
    apply: (nodes) =>
      nodes.map((n) => {
        const c = changes.find((x) => x.id === n.id);
        return c
          ? {
              ...n,
              amount: c.to,
              value: n.value.replace(/-?\d+(\.\d+)?/, num(c.to)) || num(c.to),
            }
          : n;
      }),
  };
}

/** S2-03 / S2-06: goal → 1st … 4th level paths, each with metric and value (分得下去、推得回来). */
export function PathSystemEditor({
  value,
  onChange,
  readOnly,
  issues,
  goals,
  goalWord,
  importFromMap,
  decodeLayout,
  graphSpecId,
  viewKey,
  defaultView = "table",
  titles,
}: Props) {
  const session = useEditSession();
  const [view, setViewState] = useState<View>(() =>
    rememberedView(viewKey, defaultView),
  );
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
  const layoutGoals = goals.map((g) => ({
    id: g.id,
    label: g.label,
    target: [g.metric, g.value].filter(Boolean).join(" "),
  }));
  const [t39, t310] = pathSystemSheets(value, layoutGoals, true);
  const patch = (id: string, p: Partial<Node>, label?: string) => {
    if (label) session?.nextMeta({ label });
    set(
      nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              ...p,
              ...(p.value !== undefined
                ? { amount: parseAmount(p.value) }
                : {}),
            }
          : n,
      ),
    );
  };
  const addRoot = (goal: PathGoal, extra: Partial<Node> = {}) =>
    set(
      normalize([...nodes, pathNode({ goalId: goal.id, level: 1, ...extra })]),
    );

  const goalTotal = (goalId: string, list: Node[]) => {
    const roots = list.filter((n) => !n.parentId && n.goalId === goalId);
    const amounts = roots.map(amountOf);
    return amounts.every((a) => typeof a === "number") && roots.length
      ? (amounts as number[]).reduce((a, b) => a + b, 0)
      : null;
  };
  const cfg: TreeConfig<Node> = useMemo(
    () => ({
      nodes,
      setNodes: set,
      make: (p) => pathNode(p),
      maxLevel: MAX_PATH_LEVEL,
      title: (n) => n.path,
      copyForSplit: (n) => ({
        path: n.path ? `${n.path}（拆分）` : "",
        metric: n.metric,
        unit: n.unit,
        perspective: n.perspective,
      }),
      combine: (keep, gone) => {
        const a = amountOf(keep);
        const b = amountOf(gone);
        const sameMetric = keep.metric.trim() === gone.metric.trim();
        const total =
          sameMetric && typeof a === "number" && typeof b === "number"
            ? a + b
            : null;
        return {
          path: [keep.path, gone.path].filter(Boolean).join("、"),
          ...(total !== null ? { value: `${total}`, amount: total } : {}),
        };
      },
      roots: goals.map((g) => ({
        id: g.id,
        label: g.label,
        sub: [g.metric, g.value].filter(Boolean).join(" "),
      })),
      levelWord: (l) => LEVEL_LABELS[l] ?? `${l} 级路径`,
      previewNote: (next, id) => {
        const moved = next.find((n) => n.id === id);
        if (!moved) return null;
        if (moved.parentId) {
          const parent = next.find((n) => n.id === moved.parentId);
          const roll = parent ? rollUp(parent, next) : null;
          return roll
            ? `移动后「${parent!.path}」下级合计 ${roll.sum}，本级 ${parent!.amount}${roll.ok ? "，推得回来" : "，推不回来（可以移动后再调）"}`
            : null;
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
  const [level4, setLevel4] = useState(false);
  const [pasting, setPasting] = useState(false);
  const ordered = orderedPaths(
    nodes,
    goals.map((g) => g.id),
  );
  const byGoal = (goalId: string) => {
    const roots = new Set(
      nodes
        .filter((n) => n.level === 1 && n.goalId === goalId)
        .map((n) => n.id),
    );
    return ordered.filter((n) => {
      let cur: Node | undefined = n;
      while (cur && cur.parentId)
        cur = nodes.find((x) => x.id === cur!.parentId);
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
        const no =
          nodes.filter((x) => !x.parentId && x.goalId === n.goalId).indexOf(n) +
          1;
        for (const key of Object.keys(FIGURE_KEYS))
          if (FIGURE_KEYS[key] === n.groupTag)
            (figureUsed[key] ??= []).push(no);
      });
  }
  const pickFigure = (item: Figure37Item) => {
    if (!firstGoal) return;
    addRoot(firstGoal, { groupTag: figureTag(item), perspective: "financial" });
  };
  const rowTools = (n: Node) => (
    <div className="flex items-center justify-end gap-0.5">
      {!readOnly && n.level < MAX_PATH_LEVEL ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => actions.child(n.id)}
          title="新增下级"
        >
          <Plus /> 下级
        </Button>
      ) : null}
      <TreeNodeMenu
        id={n.id}
        actions={actions}
        readOnly={readOnly}
        onMoveTo={setMoving}
        label={n.path || LEVEL_LABELS[n.level]}
      />
    </div>
  );

  // Header chrome (design 10): 思维导图 | 表格, and the table's 版式; the toolbar acts on the
  // node of the focused row in the table, on the selected node in the map.
  const tableVariants = [
    { key: "table", label: "逐条填写" },
    ...(decodeLayout ? [{ key: "t310", label: "按层面（表 3-10）" }] : []),
    { key: "t39", label: "横排（表 3-9，只读）" },
  ];
  const lastTable = useRef<View>(
    view === "mind" ? (decodeLayout ? "t310" : "table") : view,
  );
  if (view !== "mind") lastTable.current = view;
  const tableSpec =
    view === "t39" ? "表 3-9" : view === "t310" ? "表 3-10" : "逐条填写";
  const focused = session?.focusAnchor
    ? (anchorCandidates(session.focusAnchor).find((c) =>
        nodes.some((n) => n.id === c),
      ) ?? null)
    : null;
  const focusedNode = focused
    ? (nodes.find((n) => n.id === focused) ?? null)
    : null;
  // 状态条：推得回来 N 处 / 推不回来 M 处 (design 10 画面 2、4).
  const rolls = nodes
    .map((n) => rollUp(n, nodes))
    .filter((r): r is { sum: number; ok: boolean } => !!r);
  const bad = rolls.filter((r) => !r.ok).length;
  const summary: EditorChrome["summary"] = rolls.length
    ? [
        bad
          ? { tone: "warn", text: `${bad} 处推不回来` }
          : { tone: "ok", text: `推得回来 ${rolls.length} 处` },
      ]
    : undefined;
  // 修订: rows deleted since the compared version stay visible as ghosts, each with 恢复.
  const baseNodes = session?.revision.on ? (((session.revision.basePayload as GoalPathSystem | undefined)?.nodes ?? []) as Node[]) : [];
  const removed = baseNodes.filter((b) => !nodes.some((n) => n.id === b.id));
  const restore = (id: string) => {
    const gone = new Set(removed.map((r) => r.id));
    const branch: Node[] = [];
    const walk = (x: Node) => {
      branch.push(x);
      baseNodes.filter((c) => c.parentId === x.id && gone.has(c.id)).forEach(walk);
    };
    const top = removed.find((r) => r.id === id);
    if (!top) return;
    walk(top);
    const parentHere = !top.parentId || nodes.some((n) => n.id === top.parentId);
    const rootGoal = rootOf(top, baseNodes)?.goalId ?? goals[0]?.id ?? null;
    const shift = parentHere ? 0 : 1 - top.level;
    const back = branch.map((x) => (x.id === top.id && !parentHere ? { ...x, parentId: null, goalId: rootGoal, level: 1 } : { ...x, level: x.level + shift }));
    session?.nextMeta({ via: "structure", label: `恢复「${top.path || "已删除的一条"}」${branch.length > 1 ? `及下级 ${branch.length - 1} 条` : ""}` });
    set(normalize([...nodes, ...back]));
  };
  const tableExtra =
    view === "t310" || view === "table" ? (
      <span className="flex items-center gap-1">
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPasting(true)}
            title="把 Excel 里的路径表整块粘贴进来"
          >
            <ClipboardPaste /> 从 Excel 粘贴
          </Button>
        ) : null}
        {view === "t310" ? (
          <label className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Checkbox
              checked={level4}
              onCheckedChange={(v) => setLevel4(!!v)}
              aria-label="显示四级列"
            />{" "}
            四级列
          </label>
        ) : null}
      </span>
    ) : undefined;
  const baseChrome: EditorChrome = {
    checks: (payload) => {
      const list = ((payload as GoalPathSystem | null)?.nodes ?? []) as Node[];
      return list.flatMap((n) => (rollUp(n, list) ? [{ id: n.id, label: n.path, ...sumText(childrenOf(list, n.id).map((k) => k.amount as number), n.amount as number) }] : []));
    },
    extra: tableExtra,
    extraKey: `${view}:${level4}:${readOnly}`,
    summary,
    title: view === "mind" ? titles?.map : titles?.table,
    chip:
      view === "mind"
        ? (titles?.mapChip ??
          (graphSpecId ? `${graphSpecId} · 思维导图` : undefined))
        : titles
          ? `${titles.tableSpec} · ${tableSpec}`
          : undefined,
    views: [
      { key: "mind", label: "思维导图", icon: <Network className="size-4" /> },
      { key: "table", label: "表格", icon: <Table2 className="size-4" /> },
    ],
    view: view === "mind" ? "mind" : "table",
    setView: (k) => setView(k === "mind" ? "mind" : lastTable.current),
    variants: view === "mind" ? undefined : tableVariants,
    variant: view === "mind" ? undefined : view,
    setVariant: (k) => setView(k as View),
  };
  const tableTools: EditorChrome["tools"] = {
    selected: focused,
    selectedLabel: focusedNode
      ? focusedNode.path || LEVEL_LABELS[focusedNode.level]
      : undefined,
    ...(focused && !readOnly && view !== "t39"
      ? {
          child: () => actions.child(focused),
          sibling: () => actions.sibling(focused),
          indent: () => actions.indent(focused),
          outdent: () => actions.outdent(focused),
          up: () => actions.up(focused),
          down: () => actions.down(focused),
          moveTo: () => setMoving(focused),
          split: () => actions.split(focused),
          merge: () => actions.merge(focused),
          remove: () => actions.remove(focused),
        }
      : {}),
  };
  useEditorChrome({ ...baseChrome, tools: tableTools }, view !== "mind");

  return (
    <section aria-label="路径系统" className="flex flex-col gap-4">
      <EditorToolbar
        hint={`先 How 后 Who：每个${goalWord}拆出一级路径，再逐级分解到二、三级（标准图到四级）；每条路径都要有衡量指标和指标值，下级合计要推得回本级。思维导图和表格是同一份数据。`}
      >
        {importFromMap ? (
          <ImportButton
            label="子步骤 5 · 从解码地图导入"
            count={importFromMap.count}
            readOnly={readOnly}
            onClick={importFromMap.run}
          />
        ) : null}
      </EditorToolbar>

      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          还没有{goalWord}：请先完成上游表格。
        </p>
      ) : view === "mind" ? (
        <TreeMindMap
          chrome={baseChrome}
          cfg={cfg}
          readOnly={readOnly}
          invalid={invalid}
          fields={[
            { key: "path", label: "路径", placeholder: "动词＋宾语" },
            { key: "metric", label: "衡量指标" },
            { key: "value", label: "指标值" },
          ]}
          patch={patch}
          detail={(n) => n.metric || "（未填指标）"}
          amount={(n) =>
            [n.value, n.unit && !n.value.includes(n.unit) ? n.unit : ""]
              .filter(Boolean)
              .join(" ")
          }
          tag={(n) =>
            n.groupTag ||
            (n.level === 1 && n.perspective && !decodeLayout
              ? PERSPECTIVES.find((p) => p.key === n.perspective)?.label
              : null)
          }
          rollUp={(n) =>
            rollUp(n, nodes)
              ? sumText(
                  childrenOf(nodes, n.id).map((k) => k.amount as number),
                  n.amount as number,
                )
              : null
          }
          rootCards={goals.map((g) => {
            const level1 = nodes.filter(
              (n) => !n.parentId && n.goalId === g.id,
            );
            const amounts = level1.map(amountOf);
            const allNumbers =
              level1.length > 0 && amounts.every((a) => typeof a === "number");
            if (!decodeLayout) {
              return {
                root: {
                  id: g.id,
                  label: g.label,
                  sub: g.metric,
                  value: g.value,
                },
                badge: g.group || goalWord,
                nodes: level1,
                onAdd: () => addRoot(g),
                roll: allNumbers ? goalRoll(g, level1, amounts, true) : null,
              };
            }
            // 表 3-10 / 系统图: 年度目标 → 四个层面 → 一级路径 (design 10 画面 2).
            const layered = PERSPECTIVES.map((p) => {
              const own = level1.filter(
                (n) => (n.perspective ?? "financial") === p.key,
              );
              const ownAmounts = own.map(amountOf);
              const numeric =
                own.length > 0 &&
                ownAmounts.every((a) => typeof a === "number");
              const style = PERSPECTIVE_STYLE[p.key];
              const Icon = style.icon;
              return {
                key: p.key,
                label: p.label,
                sub: `${own.length} 条一级路径`,
                icon: <Icon className="size-4" />,
                tone: style.tone,
                soft: style.soft,
                nodes: own,
                placeholder: "还没有一级路径",
                // Compared with the goal only when every level-1 path of the goal sits in this layer.
                roll: numeric ? goalRoll(g, own, ownAmounts, own.length === level1.length) : null,
                onAdd: () => addRoot(g, { perspective: p.key }),
                target: { parentId: null, goalId: g.id },
                patch: { perspective: p.key } as Partial<Node>,
              };
            });
            return {
              root: { id: g.id, label: g.label, sub: g.metric, value: g.value },
              badge: g.group || goalWord,
              nodes: [],
              layers: readOnly
                ? layered.filter((l) => l.nodes.length)
                : layered,
            };
          })}
          addLabel="一级路径"
          addHint={decodeLayout ? "按图 3-7 两组想" : undefined}
          emptyHint="还没有路径"
          side={
            decodeLayout && !readOnly ? (
              <Figure37Card
                used={figureUsed}
                onPick={pickFigure}
                readOnly={readOnly}
                defaultOpen={!nodes.some((n) => !n.parentId)}
              />
            ) : undefined
          }
          dropAdjust={(next, movedId, before) =>
            linkedAdjust(next, movedId, before)
          }
        />
      ) : view === "t39" ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            表 3-9 横排表：只读预览，与“导出
            Excel”里的布局一致；在“表格”“按层面”或“思维导图”里修改。
          </p>
          <SheetTable sheet={t39} />
        </div>
      ) : view === "t310" && t310 ? (
        <PathWideTable
          goals={goals}
          nodes={nodes}
          readOnly={readOnly}
          invalid={invalid}
          patch={patch}
          actions={actions}
          onMoveTo={setMoving}
          onAddRoot={(g, perspective) => addRoot(g, { perspective })}
          removed={removed.filter((r) => !r.parentId || !removed.some((x) => x.id === r.parentId)).map((r) => ({ node: r, goalId: rootOf(r, baseNodes)?.goalId ?? null }))}
          onRestore={restore}
          revisionStats={session?.revision.on ? session.revisionStats() : null}
          minLevels={level4 ? 4 : 3}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal) => {
            const rows = byGoal(goal.id);
            return (
              <div
                data-anchor={goal.id}
                key={goal.id}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card",
                  invalid.has(goal.id) && "border-destructive/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-brand px-4 py-2.5 text-brand-foreground">
                  {goal.group ? (
                    <Badge className="bg-gold text-brand">{goal.group}</Badge>
                  ) : null}
                  <span className="font-heading font-bold">{goal.label}</span>
                  <span className="text-sm opacity-85">
                    {goal.metric} {goal.value}
                  </span>
                  {!readOnly ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-auto"
                      onClick={() => addRoot(goal)}
                    >
                      <Plus /> 一级路径
                    </Button>
                  ) : null}
                </div>
                <PathRows
                  rows={rows}
                  nodes={nodes}
                  readOnly={readOnly}
                  invalid={invalid}
                  patch={patch}
                  rowTools={rowTools}
                />
              </div>
            );
          })}
          {unattached.length ? (
            <div className="overflow-hidden rounded-xl border border-destructive/40 bg-card">
              <div className="bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive">
                没有挂到{goalWord}的路径
              </div>
              <PathRows
                rows={unattached}
                nodes={nodes}
                readOnly={readOnly}
                invalid={invalid}
                patch={patch}
                rowTools={rowTools}
                goals={goals}
              />
            </div>
          ) : null}
        </div>
      )}
      {view !== "mind" ? (
        <MoveToDialog
          cfg={cfg}
          nodeId={moving}
          actions={actions}
          onClose={() => setMoving(null)}
          orderedNodes={ordered}
        />
      ) : null}
      <PasteDialog
        open={pasting}
        onClose={() => setPasting(false)}
        goals={goals}
        defaultGoal={
          (focusedNode && rootOf(focusedNode, nodes)?.goalId) || goals[0]?.id
        }
        defaultPerspective={
          (focusedNode && rootOf(focusedNode, nodes)?.perspective) ||
          "financial"
        }
        onImport={(goalId, perspective, added) => {
          session?.nextMeta({
            via: "structure",
            label: `从 Excel 粘贴 ${added.length} 条路径`,
          });
          set(
            normalize([
              ...nodes,
              ...added.map((n) =>
                n.level === 1 ? { ...n, goalId, perspective } : n,
              ),
            ]),
          );
        }}
      />
    </section>
  );
}

const FIGURE_KEYS: Record<string, string> = Object.fromEntries(
  FIGURE_3_7.flatMap((s) =>
    s.groups.flatMap((g) => g.items.map((i) => [i.key, figureTag(i)])),
  ),
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
  if (rows.length === 0)
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">还没有路径</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left font-semibold">
              路径（动词＋宾语）
            </th>
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
              <tr
                data-anchor={n.id}
                key={n.id}
                className={cn(
                  "border-t align-top",
                  invalid.has(n.id) && "bg-destructive/5",
                )}
              >
                <td className="px-1 py-1">
                  <div
                    className="flex items-start gap-1"
                    style={{ paddingLeft: `${(n.level - 1) * 1.25}rem` }}
                  >
                    {n.level > 1 ? (
                      <CornerDownRight className="mt-2.5 size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <TextCell
                        label={`${LEVEL_LABELS[n.level] ?? "路径"}`}
                        placeholder={LEVEL_LABELS[n.level]}
                        value={n.path}
                        onChange={(path) => patch(n.id, { path })}
                        readOnly={readOnly}
                      />
                      {goals && n.level === 1 && !readOnly ? (
                        <NativeSelect
                          size="sm"
                          aria-label={`${label} 挂到`}
                          value={n.goalId ?? ""}
                          onChange={(e) =>
                            patch(n.id, { goalId: e.target.value || null })
                          }
                        >
                          <NativeSelectOption value="">
                            挂到…
                          </NativeSelectOption>
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
                      onChange={(e) =>
                        patch(n.id, {
                          perspective: (e.target.value || undefined) as
                            | Perspective
                            | undefined,
                        })
                      }
                    >
                      <NativeSelectOption value="">—</NativeSelectOption>
                      {PERSPECTIVES.map((p) => (
                        <NativeSelectOption key={p.key} value={p.key}>
                          {p.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span className="px-2 text-xs text-muted-foreground">
                      {LEVEL_LABELS[n.level]}
                    </span>
                  )}
                </td>
                <td className="px-1 py-1">
                  <TextCell
                    label={`${label} 衡量指标`}
                    value={n.metric}
                    onChange={(metric) => patch(n.id, { metric })}
                    readOnly={readOnly}
                  />
                </td>
                <td className="px-1 py-1">
                  <TextCell
                    label={`${label} 指标值`}
                    value={n.value}
                    onChange={(v) => patch(n.id, { value: v })}
                    readOnly={readOnly}
                  />
                  {roll ? (
                    <div
                      className={cn(
                        "px-1 pt-0.5 text-[11px]",
                        roll.ok
                          ? "text-status-done-foreground"
                          : "text-destructive",
                      )}
                    >
                      下级合计 {roll.sum}
                      {roll.ok ? " ✓" : ` ≠ ${n.amount}`}
                    </div>
                  ) : null}
                </td>
                <td className="px-1 py-1">
                  <TextCell
                    label={`${label} 单位`}
                    value={n.unit ?? ""}
                    onChange={(unit) => patch(n.id, { unit })}
                    readOnly={readOnly}
                  />
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

const rootOf = (n: Node, nodes: Node[]) => {
  let cur: Node | undefined = n;
  while (cur && cur.parentId) cur = nodes.find((x) => x.id === cur!.parentId);
  return cur;
};

function PasteDialog({
  open,
  onClose,
  goals,
  defaultGoal,
  defaultPerspective,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  goals: PathGoal[];
  defaultGoal?: string | null;
  defaultPerspective: Perspective;
  onImport: (goalId: string, perspective: Perspective, nodes: Node[]) => void;
}) {
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState<string>("");
  const [perspective, setPerspective] = useState<Perspective | "">("");
  const parsed = parsePastedPaths(text);
  const goal = goalId || defaultGoal || goals[0]?.id || "";
  const layer = perspective || defaultPerspective;
  const byLevel = [1, 2, 3, 4]
    .map((l) => parsed.filter((n) => n.level === l).length)
    .filter(Boolean);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>从 Excel 粘贴路径</DialogTitle>
          <DialogDescription>
            在 Excel 里选中“一级路径 · 衡量指标 · 指标值 · 二级路径
            …”这些列（不含表头）复制，粘贴到下面。合并单元格留空的行，会接在上一行下面。
          </DialogDescription>
        </DialogHeader>
        <ImportSource template={PATH_TEMPLATE} onText={setText} />
        <Textarea
          autoFocus
          aria-label="粘贴内容"
          className="min-h-40 font-mono text-xs"
          placeholder={
            "开发车用天然气新客户\t新增售气量\t700万方\t吸引车用天然气加气客户\t新增售气量\t500万方\n\t\t\t争取公交车辆天然气用户\t新增售气量\t120万方"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          挂到
          <NativeSelect
            size="sm"
            aria-label="挂到年度目标"
            value={goal}
            onChange={(e) => setGoalId(e.target.value)}
          >
            {goals.map((g) => (
              <NativeSelectOption key={g.id} value={g.id}>
                {g.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          的
          <NativeSelect
            size="sm"
            aria-label="层面"
            value={layer}
            onChange={(e) => setPerspective(e.target.value as Perspective)}
          >
            {PERSPECTIVES.map((p) => (
              <NativeSelectOption key={p.key} value={p.key}>
                {p.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          层面
        </div>
        <p className="text-xs text-muted-foreground" role="status">
          {parsed.length
            ? `将新增 ${parsed.length} 条：${byLevel.map((c, i) => `${LEVEL_LABELS[i + 1]} ${c} 条`).join("、")}（可以撤销）`
            : "还没有识别到路径"}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!parsed.length || !goal}
            onClick={() => {
              onImport(goal, layer, parsed);
              setText("");
              onClose();
            }}
          >
            导入 {parsed.length || ""} 条
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Replace the number in a value, keeping its unit: “300 万方” → “310 万方”. */
function withAmount(value: string, amount: number): string {
  return /-?\d+(\.\d+)?/.test(value)
    ? value.replace(/-?\d+(\.\d+)?/, num(amount))
    : num(amount);
}

/**
 * 表 3-10 按层面 (design 10 画面 4): 层面 | 一级路径 路径 · 衡量指标 · 指标值 | 二级 … — merged cells come
 * from the levels; every cell edits in place like Excel; a parent that does not add up gets an orange
 * corner and “下级 N”, and the check row under each layer offers one-click fixes.
 */
function PathWideTable({
  goals,
  nodes,
  readOnly,
  invalid,
  patch,
  actions,
  onMoveTo,
  onAddRoot,
  minLevels,
  removed,
  onRestore,
  revisionStats,
}: {
  removed: { node: Node; goalId: string | null }[];
  onRestore: (id: string) => void;
  revisionStats: { label: string; changed: number; added: number; removed: number; people: number } | null;
  onAddRoot: (goal: PathGoal, perspective: Perspective) => void;
  goals: PathGoal[];
  nodes: Node[];
  readOnly: boolean;
  invalid: Set<string>;
  patch: (id: string, p: Partial<Node>, label?: string) => void;
  actions: TreeActions<Node>;
  onMoveTo: (id: string) => void;
  minLevels: number;
}) {
  const levels = Math.min(
    MAX_PATH_LEVEL,
    Math.max(minLevels, ...nodes.map((n) => n.level)),
  );
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  // A located issue unfolds the layer its row sits in (验收 D05).
  useEffect(() => {
    const onReveal = (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail ?? [];
      let n = nodes.find((x) => ids.includes(x.id));
      while (n?.parentId) n = nodes.find((x) => x.id === n!.parentId);
      if (n) {
        const key = `${n.goalId}:${n.perspective ?? ""}`;
        setClosed((c) => (c[key] ? { ...c, [key]: false } : c));
      }
    };
    window.addEventListener(REVEAL_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_EVENT, onReveal);
  }, [nodes]);
  const [later, setLater] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const kidsOf = (id: string) => nodes.filter((n) => n.parentId === id);
  type Cell = { node: Node; span: number } | "covered" | undefined;
  type Row = { cells: Cell[]; leaf: Node };
  const emit = (n: Node, rows: Row[]) => {
    const start = rows.length;
    const kids = kidsOf(n.id);
    if (!kids.length)
      rows.push({
        cells: Array.from({ length: levels }, () => undefined),
        leaf: n,
      });
    else kids.forEach((k) => emit(k, rows));
    rows[start].cells[n.level - 1] = { node: n, span: rows.length - start };
    for (let i = start + 1; i < rows.length; i++)
      rows[i].cells[n.level - 1] = "covered";
  };
  const branch = (roots: Node[]) => {
    const out: Node[] = [];
    const walk = (n: Node) => {
      out.push(n);
      kidsOf(n.id).forEach(walk);
    };
    roots.forEach(walk);
    return out;
  };
  const cls = "border-r border-b align-top";
  const dropRow = (target: Node) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!drag || drag === target.id) return;
      const problem = canMoveTo(
        nodes,
        drag,
        { parentId: target.parentId, goalId: target.goalId, before: target.id },
        MAX_PATH_LEVEL,
      );
      if (problem && problem !== "已经在这里") return;
      e.preventDefault();
      if (over !== target.id) setOver(target.id);
    },
    onDragLeave: () => setOver((o) => (o === target.id ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (drag && drag !== target.id) {
        const patchLayer =
          !target.parentId && target.perspective
            ? ({ perspective: target.perspective } as Partial<Node>)
            : undefined;
        actions.moveTo(
          drag,
          {
            parentId: target.parentId,
            goalId: target.goalId,
            before: target.id,
          },
          { patch: patchLayer, where: `「${target.path || "这一行"}」前` },
        );
      }
      setDrag(null);
      setOver(null);
    },
  });

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table
        role="treegrid"
        aria-label="表 3-10 按层面"
        className="w-full border-collapse text-sm"
        style={{ minWidth: `${6 + levels * 21}rem` }}
      >
        <thead className="text-xs text-muted-foreground">
          <tr className="bg-muted/60">
            <th
              rowSpan={2}
              className="w-24 border-r border-b px-2 py-2 text-left font-semibold text-foreground"
            >
              层面
            </th>
            {Array.from({ length: levels }, (_, i) => (
              <th
                key={i}
                colSpan={3}
                className="border-r border-b px-2 py-2 text-left font-semibold text-foreground"
              >
                <span className="inline-flex items-center gap-1">
                  {i === 0 ? <Network className="size-3.5" /> : null}
                  {LEVEL_LABELS[i + 1]}
                </span>
              </th>
            ))}
          </tr>
          <tr className="bg-muted/30">
            {Array.from({ length: levels }, (_, i) => (
              <Fragment key={i}>
                <th className="border-r border-b px-2 py-1 text-left font-normal">
                  路径
                </th>
                <th className="w-28 border-r border-b px-2 py-1 text-left font-normal">
                  衡量指标
                </th>
                <th className="w-24 border-r border-b px-2 py-1 text-right font-normal">
                  指标值
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {goals.map((goal) => {
            const roots = nodes.filter(
              (n) => !n.parentId && n.goalId === goal.id,
            );
            const target = parseAmount(goal.value);
            const groups = [...PERSPECTIVES.map((p) => p.key as string), ""]
              .map((key) => ({
                key,
                roots: roots.filter((r) => (r.perspective ?? "") === key),
              }))
              .filter((g) => g.roots.length || (g.key !== "" && !readOnly));
            return (
              <Fragment key={goal.id}>
                <tr data-anchor={goal.id}>
                  <td
                    colSpan={1 + levels * 3}
                    className="border-b bg-[color:var(--dz-fin-soft)] px-3 py-2"
                  >
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <Badge className="gap-1 bg-brand text-brand-foreground">
                        <Target className="size-3" /> {goal.group || "年度目标"}
                      </Badge>
                      <b className="font-heading">{goal.label}</b>
                      <span className="text-muted-foreground">|</span>
                      <span>{goal.metric}</span>
                      <span className="text-muted-foreground">|</span>
                      <b className="tabular-nums">{goal.value}</b>
                    </span>
                  </td>
                </tr>
                {groups.map((group) => {
                  const p = PERSPECTIVES.find((x) => x.key === group.key);
                  const style = p ? PERSPECTIVE_STYLE[p.key] : null;
                  const Icon = style?.icon;
                  const all = branch(group.roots);
                  const checks = all
                    .map((n) => ({ n, roll: rollUp(n, nodes) }))
                    .filter(
                      (
                        x,
                      ): x is { n: Node; roll: { sum: number; ok: boolean } } =>
                        !!x.roll,
                    );
                  const bad = checks.filter((c) => !c.roll.ok).length;
                  const key = `${goal.id}:${group.key}`;
                  // Layers start open; a layer with nothing wrong can be folded to one line.
                  const isClosed = closed[key] ?? false;
                  const layerCell = (span: number, compact = false) => (
                    <td
                      rowSpan={span}
                      className="w-24 border-r border-b border-l-4 bg-muted/20 px-2 py-2 align-top"
                      style={{
                        borderLeftColor: style?.tone ?? "var(--border)",
                      }}
                    >
                      {compact ? (
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          {Icon ? (
                            <Icon
                              className="size-3.5 shrink-0"
                              style={{ color: style!.tone }}
                            />
                          ) : null}
                          {p?.label ?? "未分层面"}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-center">
                          {Icon ? (
                            <span
                              aria-hidden
                              className="flex size-8 items-center justify-center rounded-full"
                              style={{
                                background: style!.soft,
                                color: style!.tone,
                              }}
                            >
                              <Icon className="size-4" />
                            </span>
                          ) : null}
                          <span className="text-sm font-semibold">
                            {p?.label ?? "未分层面"}
                          </span>
                          {p ? (
                            <span className="text-[10px] leading-tight text-muted-foreground">
                              {LAYER_SUB[p.key]}
                            </span>
                          ) : null}
                          {bad ? (
                            <span
                              className="rounded px-1 text-[10px] font-semibold text-white"
                              style={{ background: "var(--dz-warn)" }}
                            >
                              {bad} 处推不回来
                            </span>
                          ) : null}
                          {group.roots.length ? (
                            <button
                              type="button"
                              className="text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setClosed({ ...closed, [key]: !isClosed })
                              }
                              aria-expanded={!isClosed}
                            >
                              {isClosed ? "展开" : "收起"}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </td>
                  );
                  if (!group.roots.length) {
                    return (
                      <tr key={key}>
                        {layerCell(1, true)}
                        <td
                          colSpan={levels * 3}
                          className="border-b px-3 py-1 text-xs text-muted-foreground"
                        >
                          这个层面还没有路径
                          {!readOnly ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="ml-2 text-brand"
                              onClick={() =>
                                onAddRoot(goal, group.key as Perspective)
                              }
                            >
                              <Plus /> 一级路径
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  }
                  if (isClosed) {
                    const second = all.filter((n) => n.level === 2).length;
                    return (
                      <tr key={key}>
                        {layerCell(1)}
                        <td
                          colSpan={levels * 3}
                          className="border-b px-3 py-2 text-xs"
                        >
                          <span className="font-semibold">
                            {group.roots
                              .map((r) => r.path || "（未命名）")
                              .join("、")}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {group.roots.length} 条一级路径
                            {second ? ` · ${second} 条二级` : ""}
                          </span>
                          <button
                            type="button"
                            className="ml-2 text-brand hover:underline"
                            onClick={() =>
                              setClosed({ ...closed, [key]: false })
                            }
                          >
                            › 展开
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  const rows: Row[] = [];
                  group.roots.forEach((r) => emit(r, rows));
                  const layerSum = group.roots.map(amountOf);
                  const layerCheck =
                    group.roots.length === roots.length && target !== null
                      ? goalRoll(goal, group.roots, layerSum, true)
                      : null;
                  return (
                    <Fragment key={key}>
                      {rows.map((row, i) => (
                        <tr key={`${key}-${i}`}>
                          {i === 0 ? layerCell(rows.length + 1) : null}
                          {row.cells.flatMap((cell, level) => {
                            if (cell === "covered") return [];
                            if (!cell) {
                              const offer =
                                !readOnly &&
                                level === row.leaf.level &&
                                row.leaf.level < MAX_PATH_LEVEL;
                              return [
                                <td
                                  key={`e${level}`}
                                  colSpan={3}
                                  className={cn(cls, "bg-muted/10")}
                                >
                                  {offer ? (
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      className="m-1 text-brand"
                                      onClick={() => actions.child(row.leaf.id)}
                                    >
                                      <Plus /> 分解{LEVEL_LABELS[level + 1]}
                                    </Button>
                                  ) : null}
                                </td>,
                              ];
                            }
                            const n = cell.node;
                            const label = n.path || LEVEL_LABELS[n.level];
                            const roll = rollUp(n, nodes);
                            const broken = roll && !roll.ok;
                            return [
                              <td
                                key={`${n.id}-p`}
                                rowSpan={cell.span}
                                className={cn(
                                  cls,
                                  "group/row relative min-w-36",
                                  invalid.has(n.id) && "bg-destructive/5",
                                  over === n.id &&
                                    "shadow-[inset_0_3px_0_var(--brand)]",
                                )}
                                {...dropRow(n)}
                              >
                                {!readOnly ? (
                                  <span
                                    draggable
                                    onDragStart={(e) => {
                                      setDrag(n.id);
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData(
                                        "text/plain",
                                        n.path,
                                      );
                                    }}
                                    onDragEnd={() => {
                                      setDrag(null);
                                      setOver(null);
                                    }}
                                    title="拖动整行：调整顺序或换上级"
                                    aria-hidden
                                    className="absolute top-2 left-0 cursor-grab text-muted-foreground opacity-0 group-hover/row:opacity-100"
                                  >
                                    <GripVertical className="size-3.5" />
                                  </span>
                                ) : null}
                                {n.groupTag ? (
                                  <div className="px-2 pt-1 text-[10px] text-muted-foreground">
                                    ↗ {n.groupTag}
                                  </div>
                                ) : null}
                                <GridCell
                                  label={`${LEVEL_LABELS[n.level]} ${label}`}
                                  anchor={n.id}
                                  value={n.path}
                                  placeholder={`填写${LEVEL_LABELS[n.level]}`}
                                  onChange={(path) => patch(n.id, { path })}
                                  readOnly={readOnly}
                                />
                                <RowHoverTools
                                  id={n.id}
                                  actions={actions}
                                  readOnly={readOnly}
                                  onMoveTo={onMoveTo}
                                  label={label}
                                  canChild={n.level < MAX_PATH_LEVEL}
                                  className="absolute -top-4 right-1 z-20 hidden group-focus-within/row:flex group-hover/row:flex"
                                />
                              </td>,
                              <td
                                key={`${n.id}-m`}
                                rowSpan={cell.span}
                                className={cn(cls, "w-28")}
                              >
                                <GridCell
                                  label={`${label} 衡量指标`}
                                  anchor={`${n.id}.metric`}
                                  value={n.metric}
                                  placeholder="衡量指标"
                                  onChange={(metric) => patch(n.id, { metric })}
                                  readOnly={readOnly}
                                />
                              </td>,
                              <td
                                key={`${n.id}-v`}
                                rowSpan={cell.span}
                                className={cn(cls, "relative w-24")}
                                style={
                                  broken
                                    ? { background: "var(--dz-warn-soft)" }
                                    : undefined
                                }
                              >
                                {broken ? (
                                  <span
                                    aria-hidden
                                    className="absolute top-0 right-0 size-0 border-t-[9px] border-l-[9px] border-l-transparent"
                                    style={{ borderTopColor: "var(--dz-warn)" }}
                                  />
                                ) : null}
                                <GridCell
                                  label={`${label} 指标值`}
                                  anchor={`${n.id}.value`}
                                  value={n.value}
                                  placeholder="指标值"
                                  align="right"
                                  onChange={(v) => patch(n.id, { value: v })}
                                  readOnly={readOnly}
                                >
                                  {broken ? (
                                    <span
                                      className="block text-[11px] font-semibold"
                                      style={{ color: "var(--dz-warn)" }}
                                    >
                                      下级 {num(roll.sum)}
                                    </span>
                                  ) : null}
                                </GridCell>
                              </td>,
                            ];
                          })}
                        </tr>
                      ))}
                      <tr key={`${key}-check`}>
                        <td
                          colSpan={levels * 3}
                          className="border-b px-2 py-1.5"
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            {layerCheck ? (
                              <Check37
                                ok={layerCheck.ok}
                                text={
                                  layerCheck.ok
                                    ? `${num(target!)} = ${(layerSum as number[]).map(num).join(" + ")}`
                                    : layerCheck.text
                                }
                              />
                            ) : null}
                            {checks.map(({ n, roll }) => {
                              const kids = kidsOf(n.id);
                              const parts = kids
                                .map((k) => num(k.amount as number))
                                .join(" + ");
                              if (roll.ok)
                                return (
                                  <Check37
                                    key={n.id}
                                    ok
                                    text={`${num(n.amount as number)} = ${parts}`}
                                  />
                                );
                              const last = kids[kids.length - 1];
                              const fixLast =
                                (n.amount as number) -
                                (roll.sum - (last.amount as number));
                              return (
                                <span
                                  key={n.id}
                                  className="flex flex-wrap items-center gap-1"
                                >
                                  <Check37
                                    ok={false}
                                    text={`${num(n.amount as number)} ≠ ${parts} = ${num(roll.sum)}`}
                                  />
                                  {!readOnly && !later.has(n.id) ? (
                                    <>
                                      {fixLast >= 0 ? (
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          onClick={() =>
                                            patch(
                                              last.id,
                                              {
                                                value: withAmount(
                                                  last.value,
                                                  fixLast,
                                                ),
                                              },
                                              `按校验调整：「${last.path}」改为 ${num(fixLast)}`,
                                            )
                                          }
                                        >
                                          把「{last.path || "最后一条"}」改为{" "}
                                          {num(fixLast)}
                                        </Button>
                                      ) : null}
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                          patch(
                                            n.id,
                                            {
                                              value: withAmount(
                                                n.value,
                                                roll.sum,
                                              ),
                                            },
                                            `按校验调整：「${n.path}」改为 ${num(roll.sum)}`,
                                          )
                                        }
                                      >
                                        把上级改为 {num(roll.sum)}
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() =>
                                          setLater(new Set([...later, n.id]))
                                        }
                                      >
                                        先放着
                                      </Button>
                                    </>
                                  ) : null}
                                </span>
                              );
                            })}
                            {!checks.length && !layerCheck ? (
                              <span className="text-muted-foreground">
                                下级填好指标值后，这里自动核对推不推得回来
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                {removed
                  .filter((r) => (r.goalId ?? goals[0]?.id) === goal.id)
                  .map(({ node: r }) => (
                    <tr key={`gone-${r.id}`} className="text-muted-foreground" style={{ background: "color-mix(in oklab, var(--dz-removed) 8%, transparent)" }}>
                      <td className="border-r border-b px-2 py-1.5 text-[11px]">已删除</td>
                      <td colSpan={levels * 3} className="border-b px-2 py-1.5 text-sm">
                        <span className="line-through" style={{ color: "var(--dz-removed)" }}>
                          {LEVEL_LABELS[r.level]}「{r.path || "未命名"}」 · {r.metric} · {r.value}
                        </span>
                        {!readOnly ? (
                          <Button size="xs" variant="outline" className="ml-2" onClick={() => onRestore(r.id)}>
                            <RotateCcw /> 恢复
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
          {revisionStats ? (
            <tr>
              <td colSpan={1 + levels * 3} className="px-3 py-1.5 text-xs text-muted-foreground">
                <GitCompareArrows className="mr-1 inline size-3.5" />
                对比 {revisionStats.label}：改 {revisionStats.changed} 处 · 增 {revisionStats.added} 行 · 删 {revisionStats.removed} 行 · {revisionStats.people} 人
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** ok: adds up; false: does not; null: nothing to add up (different measures). */
function Check37({ ok, text }: { ok: boolean | null; text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-medium tabular-nums"
      style={{ color: ok === null ? "var(--muted-foreground)" : ok ? "var(--dz-ok)" : "var(--dz-warn)" }}
    >
      {ok === null ? null : ok ? (
        <CircleCheck className="size-3.5" />
      ) : (
        <TriangleAlert className="size-3.5" />
      )}
      {text}
    </span>
  );
}

const LAYER_SUB: Record<Perspective, string> = {
  financial: "股东价值差距",
  customer: "客户价值主张",
  process: "关键价值创造流程",
  learning: "战略资产准备度",
};
