import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Combine,
  CornerDownRight,
  Ellipsis,
  FolderInput,
  MessageSquarePlus,
  Minus,
  Pencil,
  Plus,
  Split,
  Trash2,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { type EditorChrome, useEditSession, useEditorChrome } from "@/pages/projects/components/edit-session";

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

export type TreeActions = ReturnType<typeof useTreeActions>;

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
    child: (id: string) => run(addChild(cfg.nodes, id, cfg.make, cfg.maxLevel), `新增下级：「${name(id)}」下`),
    sibling: (id: string) => run(addSibling(cfg.nodes, id, cfg.make), `新增同级：「${name(id)}」后`),
    up: (id: string) => run(move(cfg.nodes, id, -1), `上移「${name(id)}」`),
    down: (id: string) => run(move(cfg.nodes, id, 1), `下移「${name(id)}」`),
    indent: (id: string) => run(indent(cfg.nodes, id, cfg.maxLevel), `降一级「${name(id)}」`),
    outdent: (id: string) => run(outdent(cfg.nodes, id), `升一级「${name(id)}」`),
    split: (id: string) => run(split(cfg.nodes, id, cfg.make, cfg.copyForSplit), `拆成两条「${name(id)}」`),
    merge: (id: string) => run(mergeWithNeighbour(cfg.nodes, id, cfg.combine), `合并「${name(id)}」和相邻同级`),
    remove: (id: string) => {
      const count = subtree(cfg.nodes, id).size - 1;
      if (count > 0 && !window.confirm(`「${name(id)}」下面还有 ${count} 条，会一起删除（之后可以撤销）。继续？`)) return null;
      return run(removeBranch(cfg.nodes, id), `删除「${name(id)}」${count ? `及下级 ${count} 条` : ""}`);
    },
    moveTo: (id: string, target: MoveTarget) => {
      const where = target.parentId ? `「${name(target.parentId)}」下` : `「${cfg.roots.find((r) => r.id === (target.goalId ?? null))?.label ?? "第一级"}」`;
      return run(moveTo(cfg.nodes, id, target, cfg.maxLevel), `移动「${name(id)}」到${where}`);
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
  actions: TreeActions;
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
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`${label} 的更多操作`} title="更多操作（Shift+F10 移动到…）" />}>
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
            <MessageSquarePlus /> 插入批注 <DropdownMenuShortcut>Ctrl+Alt+M</DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : null}
        {!readOnly ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.sibling(id)}>
              <Plus /> 新增同级 <DropdownMenuShortcut>Ctrl+Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
            {nest ? (
              <>
                <DropdownMenuItem onClick={() => actions.child(id)}>
                  <CornerDownRight /> 新增下级 <DropdownMenuShortcut>Ctrl+Shift+Enter</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.outdent(id)}>
                  <ArrowLeft /> 升一级 <DropdownMenuShortcut>Alt+Shift+←</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.indent(id)}>
                  <ArrowRight /> 降一级 <DropdownMenuShortcut>Alt+Shift+→</DropdownMenuShortcut>
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onClick={() => actions.up(id)}>
              <ArrowUp /> 上移 <DropdownMenuShortcut>Alt+Shift+↑</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.down(id)}>
              <ArrowDown /> 下移 <DropdownMenuShortcut>Alt+Shift+↓</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveTo(id)}>
              <FolderInput /> 移动到… <DropdownMenuShortcut>Shift+F10</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.split(id)}>
              <Split /> 拆成两条
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.merge(id)}>
              <Combine /> 和相邻同级合并
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => actions.remove(id)}>
              <Trash2 /> 删除（可撤销） <DropdownMenuShortcut>Delete</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
  actions: TreeActions;
  onClose: () => void;
  /** Nodes in display order (depth first). */
  orderedNodes: T[];
}) {
  const node = cfg.nodes.find((n) => n.id === nodeId) ?? null;
  type Option = { key: string; target: MoveTarget; label: string; level: number; disabled: string | null; current: boolean };
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
        while (cur?.parentId) cur = cfg.nodes.find((x) => x.id === cur!.parentId);
        return (cur?.goalId ?? null) === root.id || cfg.roots.length === 1;
      });
      for (const n of underRoot) {
        const t = { parentId: n.id };
        out.push({ key: n.id, target: t, label: cfg.title(n) || "（未命名）", level: n.level, disabled: canMoveTo(cfg.nodes, node.id, t, cfg.maxLevel), current: node.parentId === n.id });
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
    const where = chosen.target.parentId ? `挂到「${chosen.label}」下` : `作为「${cfg.roots.find((r) => r.id === (chosen.target.goalId ?? null))?.label}」的一级`;
    const word = cfg.levelWord ?? ((l: number) => `${LEVELS[l] ?? `${l} 级`}`);
    return [`「${cfg.title(node) || "（未命名）"}」${count ? `及下级 ${count} 条` : ""}${where}，变成${word(moved.level)}`, cfg.previewNote?.(result.nodes, node.id)].filter(Boolean).join("；");
  }, [cfg, node, chosen]);
  const enabled = options.filter((o) => !o.disabled);
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const i = enabled.findIndex((o) => o.key === choice);
    const next = enabled[(i + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length];
    if (next) setChoice(next.key);
  };

  return (
    <Dialog open={!!node} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>把「{node ? cfg.title(node) || "（未命名）" : ""}」移动到…</DialogTitle>
          <DialogDescription>选一个新的上级，下级一起移动。键盘用 ↑↓ 选、Enter 确定。</DialogDescription>
        </DialogHeader>
        <div role="listbox" aria-label="新的上级" tabIndex={0} onKeyDown={onKey} className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto rounded-lg border p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                choice === o.key ? "bg-brand text-brand-foreground" : o.disabled ? "text-muted-foreground" : "hover:bg-accent",
                o.level === 0 && "font-semibold",
              )}
              style={{ paddingLeft: `${0.5 + o.level * 1}rem` }}
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.current ? <span className="shrink-0 text-xs opacity-80">现在在这里</span> : o.disabled ? <span className="shrink-0 text-[11px]">{o.disabled}</span> : null}
            </button>
          ))}
        </div>
        <p className={cn("min-h-10 rounded-md px-3 py-2 text-sm", preview ? "bg-muted" : "text-muted-foreground")} aria-live="polite">
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

export type MindField<T> = { key: keyof T & string; label: string; placeholder?: string };

type MindProps<T extends TreeItem> = {
  cfg: TreeConfig<T>;
  readOnly: boolean;
  invalid: Set<string>;
  /** Editable fields, edited together (design: 路径、衡量指标、指标值三项一起改). */
  fields: MindField<T>[];
  patch: (id: string, values: Partial<T>) => void;
  /** Second line of a node, e.g. “新增售气量 300 万方”. */
  detail: (node: T) => ReactNode;
  /** Small tag above the title, e.g. “提高客户价值 › 开发新客户”. */
  tag?: (node: T) => string | null | undefined;
  /** Orange corner when the children don't add up (推不回来). */
  rollUp?: (node: T) => { ok: boolean; text: string } | null;
  /** Roots shown at the left, each with its level-1 nodes. */
  rootCards: { root: TreeRoot; nodes: T[]; onAdd?: () => void; badge?: string }[];
  emptyHint?: ReactNode;
  side?: ReactNode;
  /** The editor's header chrome (title, views …); the map adds its toolbar and zoom to it. */
  chrome?: EditorChrome;
};

/** 思维导图: a left-to-right tree of the same nodes as the table (role=tree). */
export function TreeMindMap<T extends TreeItem>({ cfg, readOnly, invalid, fields, patch, detail, tag, rollUp, rootCards, emptyHint, side, chrome }: MindProps<T>) {
  const actions = useTreeActions(cfg);
  const session = useEditSession();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ key: string; ok: boolean; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const tree = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const visible = useMemo(() => {
    const out: T[] = [];
    const walk = (n: T) => {
      out.push(n);
      if (!collapsed.has(n.id)) for (const c of childrenOf(cfg.nodes, n.id)) walk(c);
    };
    for (const r of rootCards) for (const n of r.nodes) walk(n);
    return out;
  }, [cfg.nodes, rootCards, collapsed]);
  const ordered = useMemo(() => {
    const out: T[] = [];
    const walk = (n: T) => {
      out.push(n);
      for (const c of childrenOf(cfg.nodes, n.id)) walk(c);
    };
    for (const r of rootCards) for (const n of r.nodes) walk(n);
    return out;
  }, [cfg.nodes, rootCards]);

  // Keep keyboard focus on the selected node after an operation re-renders the tree.
  useEffect(() => {
    if (!selected || editing) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-mm-id="${CSS.escape(selected)}"]`);
    if (el && document.activeElement !== el && !el.contains(document.activeElement)) el.focus({ preventScroll: false });
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
    if (key === "F2" && !readOnly) return handled(), setEditing(n.id);
    if (key === "F10" && event.shiftKey && !readOnly) return handled(), setMoving(n.id);
    if (alt && !readOnly) {
      if (key === "ArrowLeft") return handled(), after(actions.outdent(n.id));
      if (key === "ArrowRight") return handled(), after(actions.indent(n.id));
      if (key === "ArrowUp") return handled(), after(actions.up(n.id));
      if (key === "ArrowDown") return handled(), after(actions.down(n.id));
    }
    if (!readOnly && n.level < cfg.maxLevel && (key === "Tab" || (key === "Enter" && (event.ctrlKey || event.metaKey) && event.shiftKey))) return handled(), after(actions.child(n.id), true);
    if (!readOnly && key === "Enter") return handled(), after(actions.sibling(n.id), true);
    if (!readOnly && (key === "Delete" || key === "Backspace")) {
      handled();
      const i = visible.findIndex((x) => x.id === n.id);
      const fallback = visible[i - 1]?.id ?? visible[i + 1]?.id ?? null;
      if (actions.remove(n.id) !== null || !cfg.nodes.some((x) => x.id === n.id)) setSelected(fallback);
      return;
    }
    const i = visible.findIndex((x) => x.id === n.id);
    if (key === "ArrowDown") return handled(), setSelected(visible[i + 1]?.id ?? n.id);
    if (key === "ArrowUp") return handled(), setSelected(visible[i - 1]?.id ?? n.id);
    if (key === "ArrowLeft") {
      handled();
      if (childrenOf(cfg.nodes, n.id).length && !collapsed.has(n.id)) setCollapsed(new Set([...collapsed, n.id]));
      else if (n.parentId) setSelected(n.parentId);
      return;
    }
    if (key === "ArrowRight") {
      handled();
      if (collapsed.has(n.id)) setCollapsed(new Set([...collapsed].filter((x) => x !== n.id)));
      else setSelected(childrenOf(cfg.nodes, n.id)[0]?.id ?? n.id);
    }
  };

  const dropOn = (key: string, target: MoveTarget, label: string) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!drag) return;
      const problem = canMoveTo(cfg.nodes, drag, target, cfg.maxLevel);
      if (!problem) event.preventDefault();
      if (drop?.key !== key) setDrop({ key, ok: !problem, text: problem ?? `松手：放到「${label}」下` });
    },
    onDragLeave: () => setDrop((d) => (d?.key === key ? null : d)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      if (drag && !canMoveTo(cfg.nodes, drag, target, cfg.maxLevel)) after(actions.moveTo(drag, target));
      setDrag(null);
      setDrop(null);
    },
  });

  // The header toolbar acts on the selected node (design 10: one toolbar for map and table).
  const sel = selected && cfg.nodes.some((n) => n.id === selected) ? selected : null;
  const selNode = sel ? cfg.nodes.find((n) => n.id === sel)! : null;
  const visibleIndex = sel ? visible.findIndex((x) => x.id === sel) : -1;
  useEditorChrome(
    chrome
      ? {
          ...chrome,
          tools: {
            selected: sel,
            selectedLabel: selNode ? cfg.title(selNode) || "（未命名）" : undefined,
            ...(sel && !readOnly
              ? {
                  child: selNode && selNode.level < cfg.maxLevel ? () => after(actions.child(sel), true) : undefined,
                  sibling: () => after(actions.sibling(sel), true),
                  indent: cfg.maxLevel > 1 ? () => after(actions.indent(sel)) : undefined,
                  outdent: cfg.maxLevel > 1 ? () => after(actions.outdent(sel)) : undefined,
                  up: () => after(actions.up(sel)),
                  down: () => after(actions.down(sel)),
                  moveTo: () => setMoving(sel),
                  split: () => after(actions.split(sel)),
                  merge: () => after(actions.merge(sel)),
                  remove: () => {
                    const fallback = visible[visibleIndex - 1]?.id ?? visible[visibleIndex + 1]?.id ?? null;
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
              const ratio = (host.clientWidth - 48) / (content.scrollWidth || 1);
              setZoom(Math.max(0.5, Math.min(1, Math.round(ratio * 10) / 10)));
            },
          },
        }
      : null,
    !!chrome,
  );

  const renderNode = (n: T): ReactNode => {
    const kids = childrenOf(cfg.nodes, n.id);
    const isCollapsed = collapsed.has(n.id);
    const roll = rollUp?.(n) ?? null;
    const isSelected = selected === n.id;
    const t = tag?.(n);
    const hiddenCount = isCollapsed ? subtree(cfg.nodes, n.id).size - 1 : 0;
    return (
      <li key={n.id} role="none">
        <div className="relative flex items-center">
          {isSelected && !readOnly && editing !== n.id ? (
            <div className="absolute -top-9 left-0 z-10 flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-md" role="toolbar" aria-label="节点工具条">
              {n.level < cfg.maxLevel ? (
                <Button size="xs" variant="ghost" onClick={() => after(actions.child(n.id), true)} title="新增下级（Tab）">
                  <CornerDownRight /> 下级
                </Button>
              ) : null}
              <Button size="xs" variant="ghost" onClick={() => after(actions.sibling(n.id), true)} title="新增同级（Enter）">
                <Plus /> 同级
              </Button>
              {session ? (
                <Button size="xs" variant="ghost" onClick={() => session.commentOn(n.id)} title="批注（Ctrl+Alt+M）">
                  <MessageSquarePlus /> 批注
                </Button>
              ) : null}
              <Button size="xs" variant="ghost" onClick={() => setMoving(n.id)} title="移动到…（Shift+F10）">
                <FolderInput /> 移动到…
              </Button>
              <TreeNodeMenu id={n.id} actions={actions} readOnly={readOnly} onMoveTo={setMoving} onEdit={setEditing} label={cfg.title(n) || "节点"} nest={cfg.maxLevel > 1} />
            </div>
          ) : null}
          <div
            role="treeitem"
            aria-level={n.level}
            aria-selected={isSelected}
            aria-expanded={kids.length ? !isCollapsed : undefined}
            aria-label={`${cfg.title(n) || "未命名"}${roll && !roll.ok ? `，${roll.text}` : ""}`}
            tabIndex={isSelected || (!selected && n === visible[0]) ? 0 : -1}
            data-anchor={n.id}
            data-mm-id={n.id}
            draggable={!readOnly && editing !== n.id}
            onDragStart={(event) => {
              setDrag(n.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", cfg.title(n));
            }}
            onDragEnd={() => {
              setDrag(null);
              setDrop(null);
            }}
            {...dropOn(n.id, { parentId: n.id }, cfg.title(n) || "（未命名）")}
            onClick={() => setSelected(n.id)}
            onDoubleClick={() => !readOnly && setEditing(n.id)}
            onKeyDown={(event) => onKey(event, n)}
            className={cn(
              "relative min-w-44 max-w-72 cursor-pointer rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-xs outline-none transition-[box-shadow,opacity]",
              isSelected && "ring-2 ring-brand",
              invalid.has(n.id) && "border-destructive/50",
              drag === n.id && "opacity-40",
              drop?.key === n.id && (drop.ok ? "outline-2 outline-offset-2 outline-dashed outline-brand" : "outline-2 outline-offset-2 outline-dashed outline-destructive"),
            )}
          >
            {editing === n.id ? (
              <NodeEditor node={n} fields={fields} onCancel={() => setEditing(null)} onSave={(values) => {
                patch(n.id, values);
                setEditing(null);
                setSelected(n.id);
              }} />
            ) : (
              <>
                {t ? <div className="mb-0.5 truncate text-[11px] text-muted-foreground">{t}</div> : null}
                <div className={cn("font-semibold", !cfg.title(n) && "text-muted-foreground")}>{cfg.title(n) || "（双击填写）"}</div>
                <div className="text-xs text-muted-foreground">{detail(n)}</div>
                {roll ? (
                  <div className={cn("mt-0.5 text-[11px]", roll.ok ? "text-status-done-foreground" : "font-semibold text-[color:var(--dz-ai)]")}>{roll.text}</div>
                ) : null}
                {roll && !roll.ok ? <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full" style={{ background: "var(--dz-ai)" }} /> : null}
              </>
            )}
            {drop?.key === n.id ? (
              <div className={cn("absolute top-full left-0 z-10 mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] text-white", drop.ok ? "bg-brand" : "bg-destructive")}>{drop.text}</div>
            ) : null}
          </div>
          {kids.length ? (
            <button
              type="button"
              aria-label={isCollapsed ? `展开 ${hiddenCount} 条` : "折叠"}
              onClick={() => setCollapsed(isCollapsed ? new Set([...collapsed].filter((x) => x !== n.id)) : new Set([...collapsed, n.id]))}
              className="ml-1 flex h-6 min-w-6 items-center justify-center rounded-full border bg-background px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? `+${hiddenCount}` : <Minus className="size-3" />}
            </button>
          ) : null}
        </div>
        {kids.length && !isCollapsed ? (
          <ul role="group" className="dz-mm-children">
            {kids.map(renderNode)}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div ref={box} className="dz-mm dz-dots min-w-0 flex-1 overflow-auto rounded-lg p-6 pt-12">
        <div ref={tree} role="tree" aria-label="思维导图" className="flex w-max flex-col gap-8" style={zoom === 1 ? undefined : { zoom }}>
          {rootCards.map(({ root, nodes, onAdd, badge }) => (
            <div key={root.id ?? "root"} data-mm-root={root.id ?? ""} className="flex items-center">
              <div
                className={cn("relative flex min-w-40 max-w-60 shrink-0 flex-col rounded-lg bg-brand px-3 py-2 text-brand-foreground", drop?.key === `root:${root.id}` && "outline-2 outline-offset-2 outline-dashed outline-gold")}
                {...dropOn(`root:${root.id}`, { parentId: null, goalId: root.id }, root.label)}
              >
                {badge ? <span className="mb-0.5 text-[10px] opacity-80">{badge}</span> : null}
                <span className="font-heading font-bold">{root.label}</span>
                {root.sub ? <span className="text-xs opacity-85">{root.sub}</span> : null}
                {onAdd && !readOnly ? (
                  <Button size="xs" variant="secondary" className="mt-1.5 self-start" onClick={onAdd}>
                    <Plus /> 一级
                  </Button>
                ) : null}
                {drop?.key === `root:${root.id}` ? <div className="absolute top-full left-0 z-10 mt-1 whitespace-nowrap rounded bg-brand px-1.5 py-0.5 text-[11px] text-white">{drop.text}</div> : null}
              </div>
              {nodes.length ? (
                <ul role="group" className="dz-mm-children">
                  {nodes.map(renderNode)}
                </ul>
              ) : (
                <span className="ml-6 text-xs text-muted-foreground">{emptyHint ?? "还没有下级"}</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground">
          点选节点出现工具条；双击或 F2 编辑；Tab 下级、Enter 同级；Alt+Shift+方向键 调层级和顺序；拖到别的节点上就换上级（松手前看提示）；Shift+F10 移动到…
        </p>
      </div>
      {side}
      <MoveToDialog cfg={cfg} nodeId={moving} actions={actions} onClose={() => setMoving(null)} orderedNodes={ordered} />
    </div>
  );
}

function NodeEditor<T extends TreeItem>({ node, fields, onSave, onCancel }: { node: T; fields: MindField<T>[]; onSave: (values: Partial<T>) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, String(node[f.key] ?? "")])));
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);
  const save = () => {
    const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== String(node[k as keyof T] ?? "")));
    if (Object.keys(changed).length) onSave(changed as Partial<T>);
    else onCancel();
  };
  return (
    <div
      className="flex flex-col gap-1"
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
      {fields.map((f, i) => (
        <label key={f.key} className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          {f.label}
          <Input
            ref={i === 0 ? first : undefined}
            aria-label={f.label}
            className="h-7 text-sm"
            placeholder={String(node[f.key] ?? "") || f.placeholder}
            value={values[f.key]}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
          />
        </label>
      ))}
      <span className="text-[10px] text-muted-foreground">Enter 保存 · Tab 下一项 · Esc 取消</span>
    </div>
  );
}
