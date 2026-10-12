import { type ReactNode, createContext, useContext, useEffect, useRef } from "react";

import type { Issue } from "@dingze/shared";

import { anchorOptions } from "@/lib/dingze/comment-anchors";
import type { Command, CommandMeta } from "@/lib/dingze/edit-log";

// One editing session of a table, shared by the workspace, the editors' chrome, the comments
// panel, the change log and the digital consultant's change cards (design 10).

export type RevisionState = { on: boolean; baseRev: number | null; basePayload: unknown; baseLabel: string };

export type EditSession = {
  code: string;
  draft: unknown;
  readOnly: boolean;
  issues: Issue[];
  /** Write a new draft, recorded as one command in the change log. */
  commit: (next: unknown, meta?: CommandMeta) => void;
  /** Unsaved commands since the last save, oldest first. */
  log: Command[];
  undoCommand: (command: Command) => void;
  /** A comment being worked on (“按批注修改”): later edits are linked to it. */
  activeComment: number | null;
  setActiveComment: (id: number | null) => void;
  /** Anchors an unconfirmed AI change card would touch (amber preview). */
  preview: string[];
  setPreview: (anchors: string[]) => void;
  /** 修改卡预览 (design 10 画面 6): the canvas shows this payload read-only, numbered items amber. */
  previewDraft: { payload: unknown; items: { anchor: string; no: number }[] } | null;
  setPreviewDraft: (preview: { payload: unknown; items: { anchor: string; no: number }[] } | null) => void;
  /** 修订 (design 10 画面 7): what a cell was in the compared version and who changed it. */
  revisionCell: (key: string) => { kind: "changed" | "added"; before?: string; by?: string } | null;
  /** 对比 vN：改 a 处 · 增 b 行 · 删 c 行 · d 人. */
  revisionStats: () => { label: string; changed: number; added: number; removed: number; people: number } | null;
  /** Number and author of a comment, for “这次修改会附在批注③下”. */
  commentInfo: (id: number) => { no: number; author: string } | null;
  /** 圈选: anchors picked for a group comment. */
  selecting: boolean;
  setSelecting: (on: boolean) => void;
  selection: string[];
  toggleSelection: (anchor: string) => void;
  clearSelection: () => void;
  focusAnchor: string | null;
  revision: RevisionState;
  /** Turn 修订 on against a saved version (null: the previous one), or off. */
  compareWith: (rev: number | null, on: boolean) => Promise<void>;
  versions: { rev: number; by: string; at: string; kind: string }[];
  /** Checks a payload the way the editor does (for a change card's 影响). */
  validate: (payload: unknown) => Issue[];
  /** Human name of a payload path, e.g. “开拓点供新业务 · 指标值”. */
  nameOf: (path: string) => string;
  openPanel: (tab: "coach" | "comments" | "changes") => void;
  /** Label the next edit coming through the editor's onChange (e.g. 调结构 · 移动到…). */
  nextMeta: (meta: CommandMeta) => void;
  /** Open the comment composer on a row / node / cell. */
  commentOn: (anchor: string) => void;
  /** What the open editor contributes to the workspace header (views, title, toolbar). */
  chrome: { current: EditorChrome | null };
  publishChrome: (signature: string) => void;
};

export type EditorView = { key: string; label: string; icon?: ReactNode };

/** Structure actions on the selected node / row; missing ones show disabled. */
export type EditorTools = {
  selected: string | null;
  selectedLabel?: string;
  child?: () => void;
  sibling?: () => void;
  indent?: () => void;
  outdent?: () => void;
  up?: () => void;
  down?: () => void;
  moveTo?: () => void;
  split?: () => void;
  merge?: () => void;
  remove?: () => void;
};

export type EditorChrome = {
  /** Book title for the current view, without 《》. */
  title?: string;
  /** Small chip next to the title, e.g. “S2-02 · 思维导图”. */
  chip?: string;
  views?: EditorView[];
  view?: string;
  setView?: (key: string) => void;
  /** Secondary layout choice inside a view, e.g. 表 3-10 / 表 3-9. */
  variants?: { key: string; label: string }[];
  variant?: string;
  setVariant?: (key: string) => void;
  tools?: EditorTools;
  zoom?: { value: number; set: (value: number) => void; fit: () => void; minimap?: boolean; setMinimap?: (on: boolean) => void };
  /** 合计核对 for a payload (路径 下级合计), shown on a change card before / after. */
  checks?: (payload: unknown) => { id: string; label: string; ok: boolean | null; text: string }[];
  /** Changes when the editor's `extra` controls change state, so the header re-renders. */
  extraKey?: string;
  /** Shown at the left of the status bar, e.g. “合计 1000 / 1000”“推得回来 3 处”. */
  summary?: { tone: "ok" | "warn" | "muted"; text: string }[];
  /** Extra buttons at the right end of the toolbar (e.g. 从 Excel 粘贴). */
  extra?: ReactNode;
};

/**
 * Editors call this every render with their current chrome; the header re-renders only when
 * the visible part (views, selection, zoom …) changes.
 */
export function useEditorChrome(chrome: EditorChrome | null, enabled = true) {
  const session = useContext(EditSessionContext);
  const mine = useRef<EditorChrome | null>(null);
  const signature = chrome
    ? JSON.stringify({
        t: chrome.title,
        c: chrome.chip,
        v: chrome.views?.map((x) => x.key),
        cv: chrome.view,
        va: chrome.variants?.map((x) => x.key),
        cva: chrome.variant,
        s: chrome.tools?.selected,
        sl: chrome.tools?.selectedLabel,
        tk: chrome.tools ? Object.keys(chrome.tools).filter((k) => typeof (chrome.tools as Record<string, unknown>)[k] === "function") : null,
        z: chrome.zoom?.value,
        m: chrome.zoom?.minimap,
        su: chrome.summary,
        x: chrome.extra ? (chrome.extraKey ?? true) : false,
      })
    : "";
  if (session && enabled) {
    session.chrome.current = chrome;
    mine.current = chrome;
  }
  useEffect(() => {
    if (enabled) session?.publishChrome(signature);
  }, [session, signature, enabled]);
  // Leaving (or handing over to a child view): clear only what this editor put there.
  useEffect(() => {
    if (enabled) return;
    if (session && mine.current && session.chrome.current === mine.current) session.chrome.current = null;
    mine.current = null;
  }, [enabled, session]);
  useEffect(
    () => () => {
      if (session && mine.current && session.chrome.current === mine.current) {
        session.chrome.current = null;
        session.publishChrome("");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

export const EditSessionContext = createContext<EditSession | null>(null);

export function useEditSession(): EditSession | null {
  return useContext(EditSessionContext);
}

const FIELD_NAMES: Record<string, string> = {
  value: "指标值",
  metric: "衡量指标",
  path: "路径",
  name: "名称",
  title: "标题",
  task: "任务",
  purpose: "目的",
  unit: "单位",
  owner: "责任人",
  start: "开始时间",
  end: "结束时间",
  objective: "目标",
  deliverable: "成果",
  acceptance: "验收标准",
  statement: "战略",
  text: "内容",
  note: "备注",
  weight: "权重",
  target: "力争值",
  floor: "保底值",
  advantage: "如何致胜",
  mustWin: "必赢之战",
  milestones: "关键节点",
  need: "需求",
  stock: "存量",
  gap: "缺口",
  remedy: "补齐方式",
  cells: "格子",
  level: "层级",
  parentId: "上级",
  goalId: "挂到的目标",
  perspective: "层面",
  status: "状态",
  "#order": "顺序",
  time: "时间",
  phase: "阶段",
};

/** Builds `nameOf` for a payload: row label (from comment anchors) plus the field's name. */
export function pathNamer(payload: unknown): (path: string) => string {
  const rows = new Map(anchorOptions(payload).map((o) => [o.id, o.label]));
  return (path: string) => {
    if (rows.has(path)) return rows.get(path)!;
    const parts = path.split(".").filter(Boolean);
    let row = "";
    let fieldIndex = -1;
    parts.forEach((p, i) => {
      if (rows.has(p)) {
        row = rows.get(p)!;
        fieldIndex = i + 1;
      }
    });
    const rest = fieldIndex >= 0 ? parts.slice(fieldIndex) : parts;
    const field = rest.map((p) => FIELD_NAMES[p] ?? rows.get(p) ?? p).join(" · ");
    return [row, field].filter(Boolean).join(" · ") || path;
  };
}
