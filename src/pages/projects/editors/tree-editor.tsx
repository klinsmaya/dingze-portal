import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CircleCheck,
  Combine,
  CornerDownRight,
  Ellipsis,
  FolderInput,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Info,
  MessageSquarePlus,
  Minus,
  Pencil,
  Plus,
  Split,
  Target,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  type MoveTarget,
  type TreeItem,
  type TreeResult,
  addChild,
  addSibling,
  canMoveTo,
  childrenOf,
  indent,
  mergeWithNeighbour,
  move,
  moveTo,
  outdent,
  removeBranch,
  split,
  subtree,
} from "@/lib/dingze/tree-ops";
import { cn } from "@/lib/utils";
import {
  type EditorChrome,
  useEditSession,
  useEditorChrome,
} from "@/pages/projects/components/edit-session";

// 调结构 UI shared by the path systems (S2-03 / S2-06) and WBS (S3-02): the same operations in the
// 思维导图 (node toolbar, drag, keyboard) and in the 表格 (row menu). Every operation is one
// command in the change log (via 调结构) and can be undone; 移动到… previews where it lands.

export type TreeRoot = { id: string | null; label: string; sub?: string };

export type TreeConfig<T extends TreeItem> = {
  nodes: T[];
  setNodes: (next: T[]) => void;
  make: (patch: Partial<T>) => T;
  maxLevel: number;
  /** Display name of a node (the path / package name). */
  title: (node: T) => string;
  copyForSplit: (node: T) => Partial<T>;
  combine: (keep: T, gone: T) => Partial<T>;
  /** Where level-1 nodes hang: the goals (paths) or the project itself (WBS, id null). */
  roots: TreeRoot[];
  /** Extra consequence of a move, e.g. “移动后一级合计 1200，比年度目标多 200”. */
  previewNote?: (next: T[], movedId: string) => string | null;
  levelWord?: (level: number) => string;
};

const LEVELS = ["", "一级", "二级", "三级", "四级", "五级"];

export type TreeActions<T extends TreeItem = TreeItem> = ReturnType<
  typeof useTreeActions<T>
>;
/** What the row / node menu needs: no moves with a target, so it fits any tree. */
type MenuActions = Pick<
  TreeActions,
  | "child"
  | "sibling"
  | "up"
  | "down"
  | "indent"
  | "outdent"
  | "split"
  | "merge"
  | "remove"
>;

export function useTreeActions<T extends TreeItem>(cfg: TreeConfig<T>) {
  const session = useEditSession();
  const name = (id: string) => {
    const n = cfg.nodes.find((x) => x.id === id);
    return n ? cfg.title(n) || "（未命名）" : "";
  };
  const run = (result: TreeResult<T>, label: string): string | null => {
    if (!result.ok) {
      toast.info(result.error);
      return null;
    }
    session?.nextMeta({ via: "structure", label });
    cfg.setNodes(result.nodes);
    return result.focus ?? null;
  };
  return {
    name,
    child: (id: string) =>
      run(
        addChild(cfg.nodes, id, cfg.make, cfg.maxLevel),
        `新增下级：「${name(id)}」下`,
      ),
    sibling: (id: string) =>
      run(addSibling(cfg.nodes, id, cfg.make), `新增同级：「${name(id)}」后`),
    up: (id: string) => run(move(cfg.nodes, id, -1), `上移「${name(id)}」`),
    down: (id: string) => run(move(cfg.nodes, id, 1), `下移「${name(id)}」`),
    indent: (id: string) =>
      run(indent(cfg.nodes, id, cfg.maxLevel), `降一级「${name(id)}」`),
    outdent: (id: string) =>
      run(outdent(cfg.nodes, id), `升一级「${name(id)}」`),
    split: (id: string) =>
      run(
        split(cfg.nodes, id, cfg.make, cfg.copyForSplit),
        `拆成两条「${name(id)}」`,
      ),
    merge: (id: string) =>
      run(
        mergeWithNeighbour(cfg.nodes, id, cfg.combine),
        `合并「${name(id)}」和相邻同级`,
      ),
    remove: (id: string) => {
      const count = subtree(cfg.nodes, id).size - 1;
      if (
        count > 0 &&
        !window.confirm(
          `「${name(id)}」下面还有 ${count} 条，会一起删除（之后可以撤销）。继续？`,
        )
      )
        return null;
      return run(
        removeBranch(cfg.nodes, id),
        `删除「${name(id)}」${count ? `及下级 ${count} 条` : ""}`,
      );
    },
    /** `patch`: a layer drop also changes the node (its perspective); `adjust`: the linked sum change. */
    moveTo: (
      id: string,
      target: MoveTarget,
      extra?: {
        patch?: Partial<T>;
        adjust?: (nodes: T[]) => T[];
        where?: string;
      },
    ) => {
      const where =
        extra?.where ??
        (target.parentId
          ? `「${name(target.parentId)}」下`
          : `「${cfg.roots.find((r) => r.id === (target.goalId ?? null))?.label ?? "第一级"}」`);
      let result = moveTo(cfg.nodes, id, target, cfg.maxLevel);
      if (!result.ok && extra?.patch && result.error === "已经在这里")
        result = { ok: true, nodes: cfg.nodes, focus: id };
      if (result.ok && (extra?.patch || extra?.adjust)) {
        let nodes = extra.patch
          ? result.nodes.map((n) =>
              n.id === id ? { ...n, ...extra.patch } : n,
            )
          : result.nodes;
        if (extra.adjust) nodes = extra.adjust(nodes);
        result = { ...result, nodes };
      }
      return run(
        result,
        `移动「${name(id)}」到${where}${extra?.adjust ? "，并同步上级合计" : ""}`,
      );
    },
  };
}

/** The node / row menu: every structure operation with its shortcut (design 10 §3). */
export function TreeNodeMenu({
  id,
  actions,
  readOnly,
  onMoveTo,
  onEdit,
  label,
  nest = true,
}: {
  id: string;
  actions: MenuActions;
  readOnly: boolean;
  onMoveTo: (id: string) => void;
  onEdit?: (id: string) => void;
  label: string;
  /** False for flat lists shown as a map (S2-01 themes): no 下级 / 升降级. */
  nest?: boolean;
}) {
  const session = useEditSession();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} 的更多操作`}
            title="更多操作（Shift+F10 移动到…）"
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {!readOnly && onEdit ? (
          <DropdownMenuItem onClick={() => onEdit(id)}>
            <Pencil /> 编辑 <DropdownMenuShortcut>F2</DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : null}
        {session ? (
          <DropdownMenuItem onClick={() => session.commentOn(id)}>
            <MessageSquarePlus /> 插入批注{" "}
            <DropdownMenuShortcut>Ctrl+Alt+M</DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : null}
        {!readOnly ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.sibling(id)}>
              <Plus /> 新增同级{" "}
              <DropdownMenuShortcut>Ctrl+Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
            {nest ? (
              <>
                <DropdownMenuItem onClick={() => actions.child(id)}>
                  <CornerDownRight /> 新增下级{" "}
                  <DropdownMenuShortcut>Ctrl+Shift+Enter</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.outdent(id)}>
                  <ArrowLeft /> 升一级{" "}
                  <DropdownMenuShortcut>Alt+Shift+←</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.indent(id)}>
                  <ArrowRight /> 降一级{" "}
                  <DropdownMenuShortcut>Alt+Shift+→</DropdownMenuShortcut>
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onClick={() => actions.up(id)}>
              <ArrowUp /> 上移{" "}
              <DropdownMenuShortcut>Alt+Shift+↑</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.down(id)}>
              <ArrowDown /> 下移{" "}
              <DropdownMenuShortcut>Alt+Shift+↓</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveTo(id)}>
              <FolderInput /> 移动到…{" "}
              <DropdownMenuShortcut>Shift+F10</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.split(id)}>
              <Split /> 拆成两条
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.merge(id)}>
              <Combine /> 和相邻同级合并
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.remove(id)}
            >
              <Trash2 /> 删除（可撤销）{" "}
              <DropdownMenuShortcut>Delete</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 悬停一行出现的工具条 (design 10 画面 4): 同级、下级、升降级、上下移、批注、删除、更多. */
export function RowHoverTools({
  id,
  actions,
  readOnly,
  onMoveTo,
  label,
  canChild = true,
  className,
}: {
  id: string;
  actions: MenuActions;
  readOnly: boolean;
  onMoveTo: (id: string) => void;
  label: string;
  canChild?: boolean;
  className?: string;
}) {
  const session = useEditSession();
  const tool = (
    title: string,
    icon: ReactNode,
    run: () => void,
    text?: string,
  ) => (
    <Button
      type="button"
      size={text ? "xs" : "icon-xs"}
      variant="ghost"
      title={title}
      aria-label={`${title}：${label}`}
      onClick={run}
    >
      {icon}
      {text}
    </Button>
  );
  return (
    <div
      role="toolbar"
      aria-label={`${label} 的行工具`}
      className={cn(
        "flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-md",
        className,
      )}
    >
      {!readOnly ? (
        <>
          {tool(
            "新增同级（Enter）",
            <Plus />,
            () => actions.sibling(id),
            "同级",
          )}
          {canChild
            ? tool(
                "新增下级（Tab）",
                <CornerDownRight />,
                () => actions.child(id),
                "下级",
              )
            : null}
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {tool("升一级（Alt+Shift+←）", <IndentDecrease />, () =>
            actions.outdent(id),
          )}
          {tool("降一级（Alt+Shift+→）", <IndentIncrease />, () =>
            actions.indent(id),
          )}
          {tool("上移（Alt+Shift+↑）", <ArrowUp />, () => actions.up(id))}
          {tool("下移（Alt+Shift+↓）", <ArrowDown />, () => actions.down(id))}
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        </>
      ) : null}
      {session ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          title="批注（Ctrl+Alt+M）"
          aria-label={`批注：${label}`}
          onClick={() => session.commentOn(id)}
          style={{ color: "var(--dz-comment)" }}
        >
          <MessageSquarePlus />
        </Button>
      ) : null}
      {!readOnly
        ? tool("删除（可撤销）", <Trash2 className="text-destructive" />, () =>
            actions.remove(id),
          )
        : null}
      <TreeNodeMenu
        id={id}
        actions={actions}
        readOnly={readOnly}
        onMoveTo={onMoveTo}
        label={label}
      />
    </div>
  );
}

/** 移动到…: the keyboard / button alternative to dragging, with a preview of the result. */
export function MoveToDialog<T extends TreeItem>({
  cfg,
  nodeId,
  actions,
  onClose,
  orderedNodes,
}: {
  cfg: TreeConfig<T>;
  nodeId: string | null;
  actions: TreeActions<T>;
  onClose: () => void;
  /** Nodes in display order (depth first). */
  orderedNodes: T[];
}) {
  const node = cfg.nodes.find((n) => n.id === nodeId) ?? null;
  type Option = {
    key: string;
    target: MoveTarget;
    label: string;
    level: number;
    disabled: string | null;
    current: boolean;
  };
  const options = useMemo<Option[]>(() => {
    if (!node) return [];
    const out: Option[] = [];
    for (const root of cfg.roots) {
      const target = { parentId: null, goalId: root.id };
      out.push({
        key: `root:${root.id}`,
        target,
        label: `${root.label}${root.sub ? `（${root.sub}）` : ""} · 作为一级`,
        level: 0,
        disabled: canMoveTo(cfg.nodes, node.id, target, cfg.maxLevel),
        current: !node.parentId && (node.goalId ?? null) === root.id,
      });
      const underRoot = orderedNodes.filter((n) => {
        let cur: T | undefined = n;
        while (cur?.parentId)
          cur = cfg.nodes.find((x) => x.id === cur!.parentId);
        return (cur?.goalId ?? null) === root.id || cfg.roots.length === 1;
      });
      for (const n of underRoot) {
        const t = { parentId: n.id };
        out.push({
          key: n.id,
          target: t,
          label: cfg.title(n) || "（未命名）",
          level: n.level,
          disabled: canMoveTo(cfg.nodes, node.id, t, cfg.maxLevel),
          current: node.parentId === n.id,
        });
      }
    }
    return out;
  }, [cfg, node, orderedNodes]);
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => setChoice(null), [nodeId]);
  const chosen = options.find((o) => o.key === choice) ?? null;
  const preview = useMemo(() => {
    if (!node || !chosen || chosen.disabled) return null;
    const result = moveTo(cfg.nodes, node.id, chosen.target, cfg.maxLevel);
    if (!result.ok) return null;
    const moved = result.nodes.find((n) => n.id === node.id)!;
    const count = subtree(cfg.nodes, node.id).size - 1;
    const where = chosen.target.parentId
      ? `挂到「${chosen.label}」下`
      : `作为「${cfg.roots.find((r) => r.id === (chosen.target.goalId ?? null))?.label}」的一级`;
    const word = cfg.levelWord ?? ((l: number) => `${LEVELS[l] ?? `${l} 级`}`);
    return [
      `「${cfg.title(node) || "（未命名）"}」${count ? `及下级 ${count} 条` : ""}${where}，变成${word(moved.level)}`,
      cfg.previewNote?.(result.nodes, node.id),
    ]
      .filter(Boolean)
      .join("；");
  }, [cfg, node, chosen]);
  const enabled = options.filter((o) => !o.disabled);
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const i = enabled.findIndex((o) => o.key === choice);
    const next =
      enabled[
        (i + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) %
          enabled.length
      ];
    if (next) setChoice(next.key);
  };

  return (
    <Dialog
      open={!!node}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            把「{node ? cfg.title(node) || "（未命名）" : ""}」移动到…
          </DialogTitle>
          <DialogDescription>
            选一个新的上级，下级一起移动。键盘用 ↑↓ 选、Enter 确定。
          </DialogDescription>
        </DialogHeader>
        <div
          role="listbox"
          aria-label="新的上级"
          tabIndex={0}
          onKeyDown={onKey}
          className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto rounded-lg border p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="option"
              aria-selected={choice === o.key}
              aria-disabled={!!o.disabled}
              disabled={!!o.disabled && !o.current}
              onClick={() => !o.disabled && setChoice(o.key)}
              title={o.disabled ?? undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                choice === o.key
                  ? "bg-brand text-brand-foreground"
                  : o.disabled
                    ? "text-muted-foreground"
                    : "hover:bg-accent",
                o.level === 0 && "font-semibold",
              )}
              style={{ paddingLeft: `${0.5 + o.level * 1}rem` }}
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.current ? (
                <span className="shrink-0 text-xs opacity-80">现在在这里</span>
              ) : o.disabled ? (
                <span className="shrink-0 text-[11px]">{o.disabled}</span>
              ) : null}
            </button>
          ))}
        </div>
        <p
          className={cn(
            "min-h-10 rounded-md px-3 py-2 text-sm",
            preview ? "bg-muted" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {preview ?? "选一个位置，这里会预览移动后的样子。"}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!chosen || !!chosen.disabled}
            onClick={() => {
              if (node && chosen) actions.moveTo(node.id, chosen.target);
              onClose();
            }}
          >
            移动到这里
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type MindField<T> = {
  key: keyof T & string;
  label: string;
  placeholder?: string;
};

/** A sum shown as a pill under a node: green when it adds up, orange when not, grey with nothing to compare. */
export type MindRoll = { ok: boolean | null; text: string };

/** 层面 (财务 / 客户 / 内部流程 / 学习与成长) between a root and its level-1 nodes (design 10 画面 1、2). */
export type MindLayer<T> = {
  key: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
  /** CSS colours of the layer (perspective). */
  tone?: string;
  soft?: string;
  nodes: T[];
  /** Shown on a dashed card while the layer has no nodes, e.g. “子步骤 2 · 待开始”. */
  placeholder?: string;
  roll?: MindRoll | null;
  onAdd?: () => void;
  /** Where a node dropped on the layer goes, and what changes on it (its perspective). */
  target: MoveTarget;
  patch?: Partial<T>;
};

export type MindRootCard<T> = {
  root: TreeRoot & { value?: string };
  badge?: string;
  /** Level-1 nodes hanging directly on the root. */
  nodes: T[];
  layers?: MindLayer<T>[];
  onAdd?: () => void;
  roll?: MindRoll | null;
};

/** A change offered together with a drop: “同时把「…」改为 500 → 合计 1000”. */
export type DropAdjust<T> = { label: string; apply: (nodes: T[]) => T[] };

type MindProps<T extends TreeItem> = {
  cfg: TreeConfig<T>;
  readOnly: boolean;
  invalid: Set<string>;
  /** Editable fields, edited together (design: 路径、衡量指标、指标值三项一起改). */
  fields: MindField<T>[];
  patch: (id: string, values: Partial<T>) => void;
  /** Second line of a node, e.g. the metric “新增售气量”. */
  detail: (node: T) => ReactNode;
  /** Right side of the second line, e.g. “300 万方”. */
  amount?: (node: T) => ReactNode;
  /** Small tag above the title, e.g. “提高客户价值 › 开发新客户”. */
  tag?: (node: T) => string | null | undefined;
  /** The children's sum as a pill under the node (推得回来 / 推不回来). */
  rollUp?: (node: T) => MindRoll | null;
  rootCards: MindRootCard<T>[];
  /** Dashed placeholder at the end of each level-1 list, e.g. “一级路径” · “按图 3-7 两组想”. */
  addLabel?: string;
  addHint?: string;
  emptyHint?: ReactNode;
  /** Floating card at the top right of the canvas (图 3-7). */
  side?: ReactNode;
  /** The editor's header chrome (title, views …); the map adds its toolbar and zoom to it. */
  chrome?: EditorChrome;
  /** Offered with a drop that breaks a parent's sum; applied unless Shift is held on release. */
  dropAdjust?: (
    next: T[],
    movedId: string,
    before: T[],
  ) => DropAdjust<T> | null;
};

type Drop<T> = {
  key: string;
  ok: boolean;
  text: string;
  target?: MoveTarget;
  patch?: Partial<T>;
  where?: string;
};

function RollPill({ roll, className }: { roll: MindRoll; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-medium tabular-nums shadow-xs",
        className,
      )}
      style={
        roll.ok === true
          ? {
              background: "var(--dz-ok-soft)",
              color: "var(--dz-ok)",
              borderColor: "color-mix(in oklab, var(--dz-ok) 35%, transparent)",
            }
          : roll.ok === false
            ? {
                background: "var(--dz-warn-soft)",
                color: "var(--dz-warn)",
                borderColor:
                  "color-mix(in oklab, var(--dz-warn) 40%, transparent)",
              }
            : undefined
      }
    >
      {roll.ok === true ? (
        <CircleCheck className="size-3" />
      ) : roll.ok === false ? (
        <TriangleAlert className="size-3" />
      ) : null}
      {roll.text}
    </span>
  );
}

/** 思维导图: a left-to-right tree of the same nodes as the table (role=tree). */
export function TreeMindMap<T extends TreeItem>({
  cfg,
  readOnly,
  invalid,
  fields,
  patch,
  detail,
  amount,
  tag,
  rollUp,
  rootCards,
  addLabel,
  addHint,
  emptyHint,
  side,
  chrome,
  dropAdjust,
}: MindProps<T>) {
  const actions = useTreeActions(cfg);
  const session = useEditSession();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop<T> | null>(null);
  const [skipAdjust, setSkipAdjust] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const tree = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const levelWord = cfg.levelWord ?? ((l: number) => `${LEVELS[l] ?? l}`);
  const toggle = (key: string) =>
    setCollapsed((c) =>
      c.has(key)
        ? new Set([...c].filter((x) => x !== key))
        : new Set([...c, key]),
    );

  const lists = useMemo(() => {
    const out: T[][] = [];
    for (const r of rootCards) {
      out.push(r.nodes);
      for (const l of r.layers ?? [])
        if (!collapsed.has(`layer:${r.root.id}:${l.key}`)) out.push(l.nodes);
    }
    return out;
  }, [rootCards, collapsed]);
  const visible = useMemo(() => {
    const out: T[] = [];
    const walk = (n: T) => {
      out.push(n);
      if (!collapsed.has(n.id))
        for (const c of childrenOf(cfg.nodes, n.id)) walk(c);
    };
    for (const list of lists) for (const n of list) walk(n);
    return out;
  }, [cfg.nodes, lists, collapsed]);
  const ordered = useMemo(() => {
    const out: T[] = [];
    const walk = (n: T) => {
      out.push(n);
      for (const c of childrenOf(cfg.nodes, n.id)) walk(c);
    };
    for (const r of rootCards)
      for (const list of [r.nodes, ...(r.layers ?? []).map((l) => l.nodes)])
        for (const n of list) walk(n);
    return out;
  }, [cfg.nodes, rootCards]);

  // Keep keyboard focus on the selected node after an operation re-renders the tree.
  useEffect(() => {
    if (!selected || editing) return;
    const el = box.current?.querySelector<HTMLElement>(
      `[data-mm-id="${CSS.escape(selected)}"]`,
    );
    if (
      el &&
      document.activeElement !== el &&
      !el.contains(document.activeElement)
    )
      el.focus({ preventScroll: false });
  }, [selected, editing, cfg.nodes]);

  const after = (focus: string | null, edit = false) => {
    if (!focus) return;
    setSelected(focus);
    if (edit && !readOnly) setEditing(focus);
  };

  const onKey = (event: KeyboardEvent<HTMLElement>, n: T) => {
    if (editing) return;
    const key = event.key;
    const alt = event.altKey && event.shiftKey;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (key === "F2" && !readOnly) return (handled(), setEditing(n.id));
    if (key === "F10" && event.shiftKey && !readOnly)
      return (handled(), setMoving(n.id));
    if (alt && !readOnly) {
      if (key === "ArrowLeft") return (handled(), after(actions.outdent(n.id)));
      if (key === "ArrowRight") return (handled(), after(actions.indent(n.id)));
      if (key === "ArrowUp") return (handled(), after(actions.up(n.id)));
      if (key === "ArrowDown") return (handled(), after(actions.down(n.id)));
    }
    if (
      !readOnly &&
      n.level < cfg.maxLevel &&
      (key === "Tab" ||
        (key === "Enter" && (event.ctrlKey || event.metaKey) && event.shiftKey))
    )
      return (handled(), after(actions.child(n.id), true));
    if (!readOnly && key === "Enter")
      return (handled(), after(actions.sibling(n.id), true));
    if (!readOnly && (key === "Delete" || key === "Backspace")) {
      handled();
      const i = visible.findIndex((x) => x.id === n.id);
      const fallback = visible[i - 1]?.id ?? visible[i + 1]?.id ?? null;
      if (
        actions.remove(n.id) !== null ||
        !cfg.nodes.some((x) => x.id === n.id)
      )
        setSelected(fallback);
      return;
    }
    const i = visible.findIndex((x) => x.id === n.id);
    if (key === "ArrowDown")
      return (handled(), setSelected(visible[i + 1]?.id ?? n.id));
    if (key === "ArrowUp")
      return (handled(), setSelected(visible[i - 1]?.id ?? n.id));
    if (key === "ArrowLeft") {
      handled();
      if (childrenOf(cfg.nodes, n.id).length && !collapsed.has(n.id))
        toggle(n.id);
      else if (n.parentId) setSelected(n.parentId);
      return;
    }
    if (key === "ArrowRight") {
      handled();
      if (collapsed.has(n.id)) toggle(n.id);
      else setSelected(childrenOf(cfg.nodes, n.id)[0]?.id ?? n.id);
    }
  };

  // Where a drop lands: under a node, on a layer, or in front of a sibling (插入位).
  const problemOf = (
    id: string,
    target: MoveTarget,
    layerPatch?: Partial<T>,
  ) => {
    const problem = canMoveTo(cfg.nodes, id, target, cfg.maxLevel);
    if (problem === "已经在这里" && layerPatch) {
      const node = cfg.nodes.find((n) => n.id === id);
      if (
        node &&
        Object.entries(layerPatch).some(([k, v]) => node[k as keyof T] !== v)
      )
        return null;
    }
    return problem;
  };
  const dropOn = (
    key: string,
    target: MoveTarget,
    label: string,
    layerPatch?: Partial<T>,
  ) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!drag) return;
      const problem = problemOf(drag, target, layerPatch);
      if (!problem) event.preventDefault();
      if (skipAdjust !== event.shiftKey) setSkipAdjust(event.shiftKey);
      if (drop?.key !== key)
        setDrop({
          key,
          ok: !problem,
          text: problem ?? `松手：放到${label}`,
          target,
          patch: layerPatch,
          where: label,
        });
    },
    onDragLeave: () => setDrop((d) => (d?.key === key ? null : d)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (drag && !problemOf(drag, target, layerPatch)) {
        const adjust = !event.shiftKey ? preview?.adjust : null;
        after(
          actions.moveTo(drag, target, {
            patch: layerPatch,
            adjust: adjust?.apply,
            where: label,
          }),
        );
      }
      setDrag(null);
      setDrop(null);
    },
  });

  // 松开后会这样 (design 10 画面 3): level and position, the sums, the branch that moves along.
  const preview = useMemo(() => {
    if (!drag || !drop?.ok || !drop.target) return null;
    let result = moveTo(cfg.nodes, drag, drop.target, cfg.maxLevel);
    if (!result.ok && drop.patch) result = { ok: true, nodes: cfg.nodes };
    if (!result.ok) return null;
    const next = drop.patch
      ? result.nodes.map((n) => (n.id === drag ? { ...n, ...drop.patch } : n))
      : result.nodes;
    const moved = next.find((n) => n.id === drag);
    if (!moved) return null;
    const sibs = next.filter((n) =>
      moved.parentId
        ? n.parentId === moved.parentId
        : !n.parentId && (n.goalId ?? null) === (moved.goalId ?? null),
    );
    const lines: { tone: "ok" | "warn" | "info"; text: string }[] = [];
    const t = tag?.(moved);
    lines.push({
      tone: "ok",
      text: `成为${levelWord(moved.level)}第 ${sibs.findIndex((n) => n.id === drag) + 1} 条${t ? ` · ${t}` : ""}`,
    });
    const note = cfg.previewNote?.(next, drag);
    if (note)
      lines.push({
        tone: /推不回来|多 |少 |多\d|少\d/.test(note) ? "warn" : "info",
        text: note,
      });
    const count = subtree(next, drag).size - 1;
    if (count) lines.push({ tone: "info", text: `${count} 条下级一起移动` });
    return { lines, adjust: dropAdjust?.(next, drag, cfg.nodes) ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, drop?.key, drop?.ok, cfg.nodes]);

  // The header toolbar acts on the selected node (design 10: one toolbar for map and table).
  const sel =
    selected && cfg.nodes.some((n) => n.id === selected) ? selected : null;
  const selNode = sel ? cfg.nodes.find((n) => n.id === sel)! : null;
  const visibleIndex = sel ? visible.findIndex((x) => x.id === sel) : -1;
  useEditorChrome(
    chrome
      ? {
          ...chrome,
          tools: {
            selected: sel,
            selectedLabel: selNode
              ? cfg.title(selNode) || "（未命名）"
              : undefined,
            ...(sel && !readOnly
              ? {
                  child:
                    selNode && selNode.level < cfg.maxLevel
                      ? () => after(actions.child(sel), true)
                      : undefined,
                  sibling: () => after(actions.sibling(sel), true),
                  indent:
                    cfg.maxLevel > 1
                      ? () => after(actions.indent(sel))
                      : undefined,
                  outdent:
                    cfg.maxLevel > 1
                      ? () => after(actions.outdent(sel))
                      : undefined,
                  up: () => after(actions.up(sel)),
                  down: () => after(actions.down(sel)),
                  moveTo: () => setMoving(sel),
                  split: () => after(actions.split(sel)),
                  merge: () => after(actions.merge(sel)),
                  remove: () => {
                    const fallback =
                      visible[visibleIndex - 1]?.id ??
                      visible[visibleIndex + 1]?.id ??
                      null;
                    if (actions.remove(sel) !== null) setSelected(fallback);
                  },
                }
              : {}),
          },
          zoom: {
            value: zoom,
            set: setZoom,
            fit: () => {
              const host = box.current;
              const content = tree.current;
              if (!host || !content) return;
              const ratio =
                (host.clientWidth - 48) / (content.scrollWidth / zoom || 1);
              setZoom(Math.max(0.5, Math.min(1, Math.round(ratio * 10) / 10)));
            },
            minimap,
            setMinimap,
          },
        }
      : null,
    !!chrome,
  );

  /** 放到这里: drop zones between siblings, only while dragging. */
  const slot = (
    key: string,
    target: MoveTarget,
    level: number,
    index: number,
    layerPatch?: Partial<T>,
  ) => {
    if (!drag || readOnly) return null;
    const problem = problemOf(drag, target, layerPatch);
    if (problem) return null;
    const active = drop?.key === key;
    return (
      <li
        key={key}
        role="none"
        className={cn("dz-mm-slot", active && "dz-mm-slot-active")}
      >
        <div
          {...dropOn(
            key,
            target,
            `${levelWord(level)}第 ${index + 1} 条`,
            layerPatch,
          )}
          className={cn(
            "flex items-center rounded-md border border-dashed text-xs transition-all",
            active
              ? "h-9 min-w-56 border-brand bg-[color:var(--dz-cus-soft)] px-3 text-brand"
              : "h-2.5 min-w-44 border-transparent",
          )}
        >
          {active ? (
            <>
              <Plus className="mr-1 size-3.5" /> 放到这里 · {levelWord(level)}第{" "}
              {index + 1} 条
            </>
          ) : null}
        </div>
      </li>
    );
  };

  const withSlots = (
    list: T[],
    target: (before: string | null) => MoveTarget,
    level: number,
    render: (n: T) => ReactNode,
    keyBase: string,
    layerPatch?: Partial<T>,
  ) => {
    const out: ReactNode[] = [];
    list.forEach((n, i) => {
      out.push(
        slot(`slot:${keyBase}:${n.id}`, target(n.id), level, i, layerPatch),
      );
      out.push(render(n));
    });
    out.push(
      slot(`slot:${keyBase}:end`, target(null), level, list.length, layerPatch),
    );
    return out;
  };

  const addPlaceholder = (onAdd: (() => void) | undefined, key: string) =>
    onAdd && !readOnly && !drag ? (
      <li key={`add:${key}`} role="none">
        <button
          type="button"
          onClick={onAdd}
          className="flex min-w-44 items-center gap-1.5 rounded-lg border border-dashed border-brand/40 bg-card/60 px-3 py-2 text-left text-xs text-brand hover:border-brand hover:bg-card"
        >
          <Plus className="size-3.5" />{" "}
          <span className="font-semibold">{addLabel ?? "一级"}</span>
          {addHint ? (
            <span className="text-muted-foreground">{addHint}</span>
          ) : null}
        </button>
      </li>
    ) : null;

  const renderNode = (n: T): ReactNode => {
    const kids = childrenOf(cfg.nodes, n.id);
    const isCollapsed = collapsed.has(n.id);
    const roll = rollUp?.(n) ?? null;
    const isSelected = selected === n.id;
    const t = tag?.(n);
    const hiddenCount = isCollapsed ? subtree(cfg.nodes, n.id).size - 1 : 0;
    const value = amount?.(n);
    return (
      <li key={n.id} role="none">
        <div className={cn("relative flex items-center", roll && "my-3")}>
          {isSelected && !readOnly && editing !== n.id && !drag ? (
            <div
              className="absolute -top-9 left-0 z-10 flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-md"
              role="toolbar"
              aria-label="节点工具条"
            >
              {n.level < cfg.maxLevel ? (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => after(actions.child(n.id), true)}
                  title="新增下级（Tab）"
                >
                  <CornerDownRight /> 下级
                </Button>
              ) : null}
              <Button
                size="xs"
                variant="ghost"
                onClick={() => after(actions.sibling(n.id), true)}
                title="新增同级（Enter）"
              >
                <Plus /> 同级
              </Button>
              {session ? (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => session.commentOn(n.id)}
                  title="批注（Ctrl+Alt+M）"
                  style={{ color: "var(--dz-comment)" }}
                >
                  <MessageSquarePlus /> 批注
                </Button>
              ) : null}
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setMoving(n.id)}
                title="移动到…（Shift+F10）"
                aria-label="移动到…"
              >
                <FolderInput />
              </Button>
              <TreeNodeMenu
                id={n.id}
                actions={actions}
                readOnly={readOnly}
                onMoveTo={setMoving}
                onEdit={setEditing}
                label={cfg.title(n) || "节点"}
                nest={cfg.maxLevel > 1}
              />
            </div>
          ) : null}
          <div
            role="treeitem"
            aria-level={n.level}
            aria-selected={isSelected}
            aria-expanded={kids.length ? !isCollapsed : undefined}
            aria-label={`${cfg.title(n) || "未命名"}${roll && roll.ok === false ? `，推不回来：${roll.text}` : ""}`}
            tabIndex={isSelected || (!selected && n === visible[0]) ? 0 : -1}
            data-anchor={n.id}
            data-mm-id={n.id}
            data-mm-card="node"
            draggable={!readOnly && editing !== n.id}
            onDragStart={(event) => {
              setDrag(n.id);
              setSelected(n.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", cfg.title(n));
            }}
            onDragEnd={() => {
              setDrag(null);
              setDrop(null);
            }}
            {...dropOn(
              n.id,
              { parentId: n.id },
              `「${cfg.title(n) || "（未命名）"}」下`,
            )}
            onClick={() => setSelected(n.id)}
            onDoubleClick={() => !readOnly && setEditing(n.id)}
            onKeyDown={(event) => onKey(event, n)}
            className={cn(
              "relative cursor-pointer rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-xs outline-none transition-[box-shadow,opacity]",
              editing === n.id ? "w-80 ring-2 ring-brand" : "min-w-48 max-w-72",
              isSelected && editing !== n.id && "ring-2 ring-brand",
              invalid.has(n.id) && "border-destructive/50",
              drag === n.id && "border-dashed opacity-45",
              drop?.key === n.id &&
                (drop.ok
                  ? "outline-2 outline-offset-2 outline-dashed outline-brand"
                  : "outline-2 outline-offset-2 outline-dashed outline-destructive"),
            )}
          >
            {editing === n.id ? (
              <NodeEditor
                node={n}
                fields={fields}
                onCancel={() => setEditing(null)}
                onSave={(values) => {
                  patch(n.id, values);
                  setEditing(null);
                  setSelected(n.id);
                }}
              />
            ) : (
              <>
                {t ? (
                  <div className="mb-0.5 truncate text-[11px] text-muted-foreground">
                    ↗ {t}
                  </div>
                ) : null}
                <div
                  className={cn(
                    "font-semibold leading-snug",
                    !cfg.title(n) && "text-muted-foreground",
                  )}
                >
                  {cfg.title(n) || "（双击填写）"}
                </div>
                <div className="mt-0.5 flex items-baseline gap-3 text-xs text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">{detail(n)}</span>
                  {value ? (
                    <span className="shrink-0 font-semibold text-foreground tabular-nums">
                      {value}
                    </span>
                  ) : null}
                </div>
                {roll && roll.ok === false ? (
                  <span
                    aria-hidden
                    className="absolute top-0 right-0 size-0 rounded-tr-lg border-t-[10px] border-l-[10px] border-l-transparent"
                    style={{ borderTopColor: "var(--dz-warn)" }}
                  />
                ) : null}
              </>
            )}
            {drop?.key === n.id && !drop.ok ? (
              <div className="absolute top-full left-0 z-10 mt-1 whitespace-nowrap rounded bg-destructive px-1.5 py-0.5 text-[11px] text-white">
                {drop.text}
              </div>
            ) : null}
          </div>
          {roll && editing !== n.id ? (
            <RollPill
              roll={roll}
              className="absolute top-full left-2 z-[1] mt-1"
            />
          ) : null}
          {kids.length ? (
            <button
              type="button"
              aria-label={isCollapsed ? `展开 ${hiddenCount} 条` : "折叠"}
              onClick={() => toggle(n.id)}
              className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full border bg-background px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? `+${hiddenCount}` : <Minus className="size-3" />}
            </button>
          ) : null}
        </div>
        {kids.length && !isCollapsed ? (
          <ul role="group" className="dz-mm-children">
            {withSlots(
              kids,
              (before) => ({ parentId: n.id, before }),
              n.level + 1,
              renderNode,
              n.id,
            )}
          </ul>
        ) : null}
      </li>
    );
  };

  const renderLayer = (rootId: string | null, layer: MindLayer<T>) => {
    const key = `layer:${rootId}:${layer.key}`;
    const isCollapsed = collapsed.has(key);
    const empty = layer.nodes.length === 0;
    const count = layer.nodes.reduce(
      (acc, n) => acc + subtree(cfg.nodes, n.id).size,
      0,
    );
    return (
      <li key={key} role="none">
        <div className={cn("relative flex items-center", layer.roll && "my-3")}>
          <div
            role="group"
            aria-label={`${layer.label}层面`}
            data-mm-root={layer.key}
            data-mm-card="layer"
            {...dropOn(
              key,
              layer.target,
              `「${layer.label}」层面`,
              layer.patch,
            )}
            className={cn(
              "relative flex min-w-40 items-center gap-2 rounded-lg border border-l-[3px] bg-card py-2 pr-3 pl-2 shadow-xs",
              empty && "border-dashed shadow-none",
              drop?.key === key &&
                (drop.ok
                  ? "outline-2 outline-offset-2 outline-dashed outline-brand"
                  : "outline-2 outline-offset-2 outline-dashed outline-destructive"),
            )}
            style={{
              borderLeftColor: layer.tone,
              ...(empty
                ? {
                    backgroundImage:
                      "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, var(--border) 45%, transparent) 6px 7px)",
                  }
                : {}),
            }}
          >
            {layer.icon ? (
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-md"
                style={{ background: layer.soft, color: layer.tone }}
              >
                {layer.icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="text-sm font-semibold">{layer.label}</div>
              <div className="text-[11px] text-muted-foreground">
                {empty ? (layer.placeholder ?? "还没有") : layer.sub}
              </div>
            </div>
            {empty && layer.onAdd && !readOnly ? (
              <Button
                size="icon-xs"
                variant="ghost"
                className="ml-auto"
                onClick={layer.onAdd}
                aria-label={`在${layer.label}层面加一条`}
                title={`加一条${addLabel ?? ""}`}
              >
                <Plus />
              </Button>
            ) : null}
          </div>
          {layer.roll ? (
            <RollPill
              roll={layer.roll}
              className="absolute top-full left-2 z-[1] mt-1"
            />
          ) : null}
          {!empty ? (
            <button
              type="button"
              aria-label={
                isCollapsed ? `展开 ${count} 条` : `折叠${layer.label}`
              }
              onClick={() => toggle(key)}
              className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full border bg-background px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? `+${count}` : <Minus className="size-3" />}
            </button>
          ) : null}
        </div>
        {!empty && !isCollapsed ? (
          <ul role="group" className="dz-mm-children">
            {withSlots(
              layer.nodes,
              (before) => ({ ...layer.target, before }),
              1,
              renderNode,
              key,
              layer.patch,
            )}
            {addPlaceholder(layer.onAdd, key)}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="relative">
      {drag ? (
        <div className="sticky top-2 z-30 h-0">
          <div
            className="mx-auto flex w-fit items-center gap-2 rounded-full bg-[#12384a] px-4 py-1.5 text-xs text-white shadow-lg"
            role="status"
          >
            <GripVertical className="size-3.5 opacity-70" /> <b>拖动中</b>{" "}
            松开放下 · <Kbd className="bg-white/15 text-white">Esc</Kbd> 取消 ·
            不方便拖动：选中后{" "}
            <Kbd className="bg-white/15 text-white">Alt+Shift+←</Kbd>{" "}
            升一级，或「移动到…」
          </div>
        </div>
      ) : null}
      {preview ? (
        <div className="sticky top-14 z-30 h-0">
          <div
            className="absolute top-12 right-3 w-72 rounded-xl border bg-popover p-3 text-xs shadow-lg"
            role="status"
            aria-label="松开后会这样"
          >
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <FolderInput className="size-4" /> 松开后会这样
            </div>
            <ul className="flex flex-col gap-1.5">
              {preview.lines.map((l) => (
                <li
                  key={l.text}
                  className="flex gap-1.5"
                  style={
                    l.tone === "warn"
                      ? { color: "var(--dz-warn)", fontWeight: 600 }
                      : undefined
                  }
                >
                  {l.tone === "ok" ? (
                    <CircleCheck
                      className="mt-px size-3.5 shrink-0"
                      style={{ color: "var(--dz-ok)" }}
                    />
                  ) : l.tone === "warn" ? (
                    <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  ) : (
                    <Info className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
            {preview.adjust ? (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted px-2 py-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                    !skipAdjust &&
                      "border-brand bg-brand text-brand-foreground",
                  )}
                >
                  {!skipAdjust ? <Check className="size-3" /> : null}
                </span>
                <span>
                  {preview.adjust.label}
                  <span className="block text-[10px] text-muted-foreground">
                    {skipAdjust
                      ? "按住 Shift：只移动，不改上级"
                      : "松开时按住 Shift 则只移动"}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={box}
        className="dz-mm dz-dots min-w-0 overflow-auto rounded-lg p-6 pt-12 pb-10"
      >
        <div
          ref={tree}
          role="tree"
          aria-label="思维导图"
          className={cn("flex w-max flex-col gap-10", side && "pr-72")}
          style={zoom === 1 ? undefined : { zoom }}
        >
          {rootCards.map(({ root, nodes, layers, onAdd, badge, roll }) => {
            const rootKey = `root:${root.id}`;
            const hasLayers = !!layers?.length;
            const rootDrop = hasLayers
              ? {}
              : dropOn(
                  rootKey,
                  { parentId: null, goalId: root.id },
                  `「${root.label}」下`,
                );
            return (
              <div
                key={root.id ?? "root"}
                data-mm-root={root.id ?? ""}
                className="flex items-center"
              >
                <div className={cn("relative shrink-0", roll && "my-3")}>
                  <div
                    data-mm-card="root"
                    {...rootDrop}
                    className={cn(
                      "relative flex min-w-48 max-w-64 flex-col rounded-lg bg-brand px-3 py-2.5 text-brand-foreground shadow-md",
                      drop?.key === rootKey &&
                        "outline-2 outline-offset-2 outline-dashed outline-gold",
                    )}
                  >
                    {badge ? (
                      <span className="mb-0.5 flex items-center gap-1 text-[10px] text-gold">
                        <Target className="size-3" /> {badge}
                      </span>
                    ) : null}
                    <span className="font-heading font-bold leading-snug">
                      {root.label}
                    </span>
                    {root.sub || root.value ? (
                      <span className="mt-0.5 flex items-baseline gap-3 text-xs opacity-85">
                        <span className="min-w-0 flex-1 truncate">
                          {root.sub}
                        </span>
                        {root.value ? (
                          <b className="shrink-0 tabular-nums">{root.value}</b>
                        ) : null}
                      </span>
                    ) : null}
                    {drop?.key === rootKey && !drop.ok ? (
                      <div className="absolute top-full left-0 z-10 mt-1 whitespace-nowrap rounded bg-destructive px-1.5 py-0.5 text-[11px] text-white">
                        {drop.text}
                      </div>
                    ) : null}
                  </div>
                  {roll ? (
                    <RollPill
                      roll={roll}
                      className="absolute top-full left-2 z-[1] mt-1"
                    />
                  ) : null}
                </div>
                {nodes.length || hasLayers || (onAdd && !readOnly) ? (
                  <ul role="group" className="dz-mm-children">
                    {withSlots(
                      nodes,
                      (before) => ({ parentId: null, goalId: root.id, before }),
                      1,
                      renderNode,
                      rootKey,
                    )}
                    {!hasLayers ? addPlaceholder(onAdd, rootKey) : null}
                    {(layers ?? []).map((l) => renderLayer(root.id, l))}
                  </ul>
                ) : (
                  <span className="ml-6 text-xs text-muted-foreground">
                    {emptyHint ?? "还没有下级"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {side ? <div className="absolute top-3 right-3 z-20">{side}</div> : null}
      {minimap ? (
        <MiniMap
          host={box}
          tree={tree}
          zoom={zoom}
          anchors={[...invalid]}
          onClose={() => setMinimap(false)}
        />
      ) : null}
      <MoveToDialog
        cfg={cfg}
        nodeId={moving}
        actions={actions}
        onClose={() => setMoving(null)}
        orderedNodes={ordered}
      />
    </div>
  );
}

/** 小地图 (design 10 画面 2): the whole map in miniature; purple blocks are comments, click to scroll. */
function MiniMap({
  host,
  tree,
  zoom,
  anchors,
  onClose,
}: {
  host: React.RefObject<HTMLDivElement | null>;
  tree: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  anchors: string[];
  onClose: () => void;
}) {
  const [shape, setShape] = useState<{
    w: number;
    h: number;
    boxes: { x: number; y: number; w: number; h: number; tone: string }[];
    view: { x: number; y: number; w: number; h: number };
  } | null>(null);
  useEffect(() => {
    const measure = () => {
      const content = tree.current;
      const scroller =
        host.current?.closest<HTMLElement>("[data-dingze-main]") ?? null;
      const frame = host.current;
      if (!content || !frame) return;
      const origin = content.getBoundingClientRect();
      const boxes = [
        ...content.querySelectorAll<HTMLElement>("[data-mm-card]"),
      ].map((el) => {
        const r = el.getBoundingClientRect();
        const mark = el.getAttribute("data-dz-mark") ?? "";
        const tone = mark.includes("comment")
          ? "var(--dz-comment)"
          : anchors.includes(el.dataset.mmId ?? "")
            ? "var(--dz-warn)"
            : el.dataset.mmCard === "root"
              ? "var(--brand)"
              : el.dataset.mmCard === "layer"
                ? "var(--dz-fin)"
                : "var(--muted-foreground)";
        return {
          x: r.left - origin.left,
          y: r.top - origin.top,
          w: r.width,
          h: r.height,
          tone,
        };
      });
      const visibleTop = Math.max(
        origin.top,
        scroller?.getBoundingClientRect().top ?? 0,
      );
      const visibleBottom = Math.min(
        origin.bottom,
        scroller?.getBoundingClientRect().bottom ?? window.innerHeight,
      );
      const fr = frame.getBoundingClientRect();
      setShape({
        w: origin.width,
        h: origin.height,
        boxes,
        view: {
          x: Math.max(0, fr.left - origin.left),
          y: Math.max(0, visibleTop - origin.top),
          w: Math.min(fr.width, origin.width),
          h: Math.max(0, visibleBottom - visibleTop),
        },
      });
    };
    measure();
    const scroller = host.current?.closest<HTMLElement>("[data-dingze-main]");
    scroller?.addEventListener("scroll", measure, { passive: true });
    host.current?.addEventListener("scroll", measure, { passive: true });
    const timer = window.setInterval(measure, 1200);
    return () => {
      scroller?.removeEventListener("scroll", measure);
      host.current?.removeEventListener("scroll", measure);
      window.clearInterval(timer);
    };
  }, [host, tree, zoom, anchors]);
  if (!shape) return null;
  const scale = Math.min(180 / (shape.w || 1), 120 / (shape.h || 1));
  return (
    <div className="sticky bottom-3 z-20 h-0">
      <div className="absolute right-3 bottom-0 rounded-lg border bg-popover p-1.5 shadow-lg">
        <div className="mb-1 flex items-center justify-between px-0.5 text-[10px] text-muted-foreground">
          小地图
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭小地图"
            className="hover:text-foreground"
          >
            <Minus className="size-3" />
          </button>
        </div>
        <svg
          width={shape.w * scale}
          height={shape.h * scale}
          className="cursor-pointer rounded bg-[color:var(--dz-canvas)]"
          role="img"
          aria-label="导图缩略图，点击跳到对应位置"
          onClick={(event) => {
            const r = (
              event.currentTarget as SVGSVGElement
            ).getBoundingClientRect();
            const x = (event.clientX - r.left) / scale;
            const y = (event.clientY - r.top) / scale;
            const content = tree.current;
            const scroller =
              host.current?.closest<HTMLElement>("[data-dingze-main]");
            if (!content) return;
            const origin = content.getBoundingClientRect();
            if (scroller)
              scroller.scrollBy({
                top:
                  origin.top +
                  y -
                  (scroller.getBoundingClientRect().top +
                    scroller.clientHeight / 2),
                behavior: "smooth",
              });
            host.current?.scrollBy({
              left:
                origin.left +
                x -
                (host.current.getBoundingClientRect().left +
                  host.current.clientWidth / 2),
              behavior: "smooth",
            });
          }}
        >
          {shape.boxes.map((b, i) => (
            <rect
              key={i}
              x={b.x * scale}
              y={b.y * scale}
              width={Math.max(2, b.w * scale)}
              height={Math.max(2, b.h * scale)}
              rx={1}
              fill={b.tone}
              opacity={0.55}
            />
          ))}
          <rect
            x={shape.view.x * scale}
            y={shape.view.y * scale}
            width={shape.view.w * scale}
            height={shape.view.h * scale}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={1.5}
            rx={2}
          />
        </svg>
      </div>
    </div>
  );
}

function NodeEditor<T extends TreeItem>({
  node,
  fields,
  onSave,
  onCancel,
}: {
  node: T;
  fields: MindField<T>[];
  onSave: (values: Partial<T>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, String(node[f.key] ?? "")])),
  );
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);
  const save = () => {
    const changed = Object.fromEntries(
      Object.entries(values).filter(
        ([k, v]) => v !== String(node[k as keyof T] ?? ""),
      ),
    );
    if (Object.keys(changed).length) onSave(changed as Partial<T>);
    else onCancel();
  };
  return (
    <div
      className="flex flex-col gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
        {fields.map((f, i) => {
          const original = String(node[f.key] ?? "");
          const changed = values[f.key] !== original && original !== "";
          return (
            <label
              key={f.key}
              className="contents text-[11px] text-muted-foreground"
            >
              <span>{f.label}</span>
              <span className="relative">
                <Input
                  ref={i === 0 ? first : undefined}
                  aria-label={f.label}
                  className={cn(
                    "h-7 text-sm",
                    changed && "pr-16 font-semibold",
                  )}
                  placeholder={original || f.placeholder}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
                {changed ? (
                  <span
                    className="pointer-events-none absolute top-1/2 right-2 max-w-14 -translate-y-1/2 truncate text-[11px] text-muted-foreground line-through"
                    title={`原值：${original}`}
                  >
                    {original}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Kbd>Enter</Kbd> 保存 <Kbd>Tab</Kbd> 下一项 <Kbd>Esc</Kbd> 取消
      </span>
    </div>
  );
}
