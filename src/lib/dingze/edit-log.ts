import { type DiffEntry, diffPayloads } from "@dingze/shared";

// 修改记录 (design 10 §7 “修改 = 命令”): every edit — typed, structural, pasted or confirmed from a
// digital-consultant card — becomes one command with before / after per path, its source and the
// comment it answers. Undo of any single command reverts exactly its paths; the list is the log.

export type Via = "edit" | "structure" | "chat" | "paste" | "undo" | "import";

export const VIA_LABELS: Record<Via, string> = { edit: "直接改", structure: "调结构", chat: "对话", paste: "粘贴", undo: "撤销", import: "导入" };

export type Command = {
  id: string;
  at: string;
  via: Via;
  label: string;
  by?: string;
  commentId?: number | null;
  changes: DiffEntry[];
};

export type CommandMeta = { via?: Via; label?: string; commentId?: number | null; by?: string };

let seq = 0;
const newId = () => `c${Date.now().toString(36)}${(seq = (seq + 1) % 1e6).toString(36)}`;

/** Text for a value in a change line: strings as-is, rows by their text fields. */
export function preview(value: unknown, max = 40): string {
  let text: string;
  if (value === undefined || value === null || value === "") text = "空";
  else if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else if (Array.isArray(value)) text = value.map((v) => preview(v, 20)).join("、");
  else
    text =
      Object.entries(value as Record<string, unknown>)
        .filter(([k, v]) => k !== "id" && !k.endsWith("Id") && (typeof v === "string" || typeof v === "number") && v !== "")
        .map(([, v]) => String(v))
        .slice(0, 3)
        .join(" ｜ ") || "一行";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** A readable one-line summary of a set of changes. */
export function describeChanges(changes: DiffEntry[], nameOf: (path: string) => string = (p) => p): string {
  if (changes.length === 0) return "无改动";
  const added = changes.filter((c) => c.kind === "added");
  const removed = changes.filter((c) => c.kind === "removed");
  const changed = changes.filter((c) => c.kind === "changed");
  if (changes.length === 1) {
    const c = changes[0];
    if (c.kind === "added") return `新增「${preview(c.after)}」`;
    if (c.kind === "removed") return `删除「${preview(c.before)}」`;
    return `「${nameOf(c.path)}」${preview(c.before, 24)} → ${preview(c.after, 24)}`;
  }
  return [added.length && `新增 ${added.length} 项`, removed.length && `删除 ${removed.length} 项`, changed.length && `改 ${changed.length} 处`].filter(Boolean).join("，");
}

export function buildCommand(before: unknown, after: unknown, meta: CommandMeta = {}, nameOf?: (path: string) => string): Command | null {
  const changes = diffPayloads(before, after);
  if (changes.length === 0) return null;
  return { id: newId(), at: new Date().toISOString(), via: meta.via ?? "edit", label: meta.label ?? describeChanges(changes, nameOf), by: meta.by, commentId: meta.commentId ?? null, changes };
}

const COALESCE_MS = 1500;

/** Typing in one cell becomes one command: merge into the previous one when it is the same edit. */
export function appendCommand(log: Command[], before: unknown, after: unknown, meta: CommandMeta, nameOf?: (path: string) => string): Command[] {
  const last = log[log.length - 1];
  const fresh = buildCommand(before, after, meta, nameOf);
  if (!fresh) return log;
  // Same field(s) edited again: the earlier entry may have filled an empty cell ("added").
  const samePaths = (a: DiffEntry[], b: DiffEntry[]) =>
    a.length === b.length && a.every((x, i) => x.path === b[i].path && x.kind !== "removed" && b[i].kind !== "removed" && !(x.kind === "added" && typeof x.after === "object"));
  if (
    last &&
    (meta.via ?? "edit") === "edit" &&
    last.via === "edit" &&
    !meta.label &&
    (last.commentId ?? null) === (meta.commentId ?? null) &&
    Date.now() - Date.parse(last.at) < COALESCE_MS &&
    samePaths(last.changes, fresh.changes)
  ) {
    const changes = last.changes.map((c, i) => ({ ...c, kind: fresh.changes[i].kind === "removed" ? "removed" : c.kind, after: fresh.changes[i].after }));
    return [...log.slice(0, -1), { ...last, at: fresh.at, changes, label: describeChanges(changes, nameOf) }];
  }
  return [...log, fresh];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Value at a diff path (array items addressed by id). */
export function getAt(payload: unknown, path: string): unknown {
  let cur: unknown = payload;
  for (const seg of path.split(".").filter(Boolean)) {
    if (Array.isArray(cur)) cur = cur.find((x) => isObj(x) && x.id === seg);
    else if (isObj(cur)) cur = cur[seg];
    else return undefined;
  }
  return cur;
}

/** Set (or, with `remove`, delete) the value at a diff path; arrays are addressed by id, missing items appended. */
function setPath(payload: unknown, segments: string[], value: unknown, remove: boolean): unknown {
  const [head, ...rest] = segments;
  if (Array.isArray(payload)) {
    const index = payload.findIndex((x) => isObj(x) && x.id === head);
    if (!rest.length) {
      if (remove) return index < 0 ? payload : payload.filter((_, i) => i !== index);
      if (index < 0) return [...payload, value];
      return payload.map((x, i) => (i === index ? value : x));
    }
    if (index < 0) return payload;
    return payload.map((x, i) => (i === index ? setPath(x, rest, value, remove) : x));
  }
  const record: Obj = isObj(payload) ? payload : {};
  if (!rest.length) {
    if (remove) {
      const { [head]: _gone, ...others } = record;
      return others;
    }
    return { ...record, [head]: value };
  }
  return { ...record, [head]: setPath(record[head], rest, value, remove) };
}

/** Undo one command: put every path it touched back to its `before`. */
export function revertCommand<T>(payload: T, command: Command): T {
  let next: unknown = payload;
  for (const c of [...command.changes].reverse()) {
    const segments = c.path.split(".").filter(Boolean);
    if (c.kind === "added") next = setPath(next, segments, undefined, true);
    else next = setPath(next, segments, c.before, false);
  }
  return next as T;
}

/** Later commands that touched the same paths (or rows) as `command`, which an undo would override. */
export function laterConflicts(log: Command[], command: Command): Command[] {
  const index = log.findIndex((c) => c.id === command.id);
  const paths = command.changes.map((c) => c.path);
  const overlaps = (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
  return log.slice(index + 1).filter((c) => c.changes.some((x) => paths.some((p) => overlaps(p, x.path))));
}

/** The row ids and field paths a set of changes touches, for highlighting with data-anchor. */
export function anchorsOf(changes: DiffEntry[]): string[] {
  const out = new Set<string>();
  for (const c of changes) {
    const parts = c.path.split(".").filter(Boolean);
    out.add(c.path);
    for (let i = parts.length - 1; i > 0; i--) out.add(parts.slice(0, i).join("."));
    for (const part of parts) out.add(part);
  }
  return [...out];
}
