import { createContext, useContext } from "react";

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
};

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
