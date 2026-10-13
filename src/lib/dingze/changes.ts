// Apply a digital consultant's proposed changes to an artifact draft.
// Paths are dot-separated; array items are addressed by their `id`, and `+`
// appends a new item, e.g. `goals.y3`, `battlefields.b1.mustWin`, `battlefields.+`.
// Structural ops (design 10 画面 6) address one array item, e.g. `nodes.n3`:
//   remove — the item, and in a tree (items with parentId) its whole branch;
//   split  — value is a list of field sets: the item becomes that many siblings, children stay
//            with the first;
//   move   — value is { parentId, goalId? }: the branch moves there, levels follow.

import { parseAmount } from "@dingze/shared";

import { type TreeItem, moveTo, removeBranch } from "./tree-ops";

export type ChangeOp = "set" | "remove" | "split" | "move";

export type ProposedChange = {
  path: string;
  /** Human-readable cell name shown on the suggestion card. */
  label?: string;
  value?: unknown;
  op?: ChangeOp;
};

export class ChangePathError extends Error {}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** An appended row without an id gets a stable one, so preview and confirmed write agree. */
function withId(list: unknown[], value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const row = value as Record<string, unknown>;
  if (typeof row.id === "string" && row.id) return row;
  const taken = new Set(list.map((x) => (x && typeof x === "object" ? (x as { id?: unknown }).id : undefined)));
  let n = list.length + 1;
  while (taken.has(`ai${n}`)) n++;
  return { ...row, id: `ai${n}` };
}

function setAt(target: unknown, segments: string[], value: unknown, fullPath: string): unknown {
  const [head, ...rest] = segments;
  if (Array.isArray(target)) {
    // A row list (objects with ids) only takes whole rows: the AI's output is not schema-checked,
    // and a half-streamed or partial value would otherwise break the editor and the validators.
    const rows = target.some((item) => item && typeof item === "object");
    if (head === "+") {
      if (rest.length) throw new ChangePathError(`“${fullPath}”：追加时不能再带下级路径`);
      if (value === undefined || value === null || value === "") throw new ChangePathError(`“${fullPath}”：追加的内容是空的`);
      if (rows && (typeof value !== "object" || Array.isArray(value))) throw new ChangePathError(`“${fullPath}”：这里要追加一整条，而不是一个值`);
      return [...target, withId(target, value)];
    }
    const index = target.findIndex((item) => item && typeof item === "object" && (item as { id?: unknown }).id === head);
    if (index < 0) throw new ChangePathError(`“${fullPath}”：找不到 id 为 ${head} 的条目`);
    if (!rest.length && (value === null || typeof value !== "object" || Array.isArray(value))) {
      throw new ChangePathError(`“${fullPath}”：这里要换成一整条，而不是一个值`);
    }
    const next = [...target];
    next[index] = rest.length ? setAt(target[index], rest, value, fullPath) : { ...(value as object), id: head };
    return next;
  }
  if (target === null || typeof target !== "object") {
    throw new ChangePathError(`“${fullPath}”：路径不存在`);
  }
  const record = target as Record<string, unknown>;
  if (!rest.length) return { ...record, [head]: value };
  if (!(head in record)) throw new ChangePathError(`“${fullPath}”：路径不存在`);
  return { ...record, [head]: setAt(record[head], rest, value, fullPath) };
}

type Item = TreeItem & Record<string, unknown>;

/** The array an item path points into, and the item's id: `nodes.n3` → (nodes, "n3"). */
function itemAt(root: unknown, path: string): { list: Item[]; id: string; listPath: string[] } {
  const segments = path.split(".");
  const id = segments.pop()!;
  let list: unknown = root;
  for (const s of segments) {
    if (Array.isArray(list)) list = list.find((x) => x && typeof x === "object" && (x as { id?: unknown }).id === s);
    else if (list && typeof list === "object") list = (list as Record<string, unknown>)[s];
    else list = undefined;
  }
  if (!Array.isArray(list)) throw new ChangePathError(`“${path}”：不是表里的一条`);
  if (!list.some((x) => x && typeof x === "object" && (x as { id?: unknown }).id === id)) throw new ChangePathError(`“${path}”：找不到 id 为 ${id} 的条目`);
  return { list: list as Item[], id, listPath: segments };
}

/** Stable ids for split-off items, so a preview and the confirmed write number the same items. */
const twinId = (list: Item[], id: string, k: number) => {
  let candidate = `${id}-s${k}`;
  while (list.some((x) => x.id === candidate)) candidate += "x";
  return candidate;
};

/**
 * Path nodes keep the number of `value` in `amount` (for 推得回来). A change that gives only one of
 * them updates the other, so a proposal never leaves the two disagreeing.
 */
function withAmount(item: Item, given: Record<string, unknown>): Item {
  if (!("amount" in item)) return item;
  if ("value" in given && !("amount" in given)) return { ...item, amount: parseAmount(String(given.value ?? "")) };
  if ("amount" in given && !("value" in given) && typeof given.amount === "number") return { ...item, value: String(given.amount) };
  return item;
}

function applyOne(next: unknown, change: ProposedChange): unknown {
  const op = change.op ?? "set";
  if (op === "set") {
    const out = setAt(next, change.path.split("."), clone(change.value), change.path);
    const field = change.path.split(".").pop();
    if (field !== "value" && field !== "amount") return out;
    // Keep value / amount of the item in step.
    const itemPath = change.path.split(".").slice(0, -1).join(".");
    try {
      const { list, id, listPath } = itemAt(out, itemPath);
      const items = list.map((x) => (x.id === id ? withAmount(x, { [field]: change.value }) : x));
      return listPath.length ? setAt(out, listPath, items, change.path) : items;
    } catch {
      return out;
    }
  }
  const { list, id, listPath } = itemAt(next, change.path);
  let items: Item[];
  if (op === "remove") {
    const result = list.some((x) => "parentId" in x) ? removeBranch(list, id) : null;
    items = result?.ok ? result.nodes : list.filter((x) => x.id !== id);
  } else if (op === "move") {
    const target = (change.value ?? {}) as { parentId?: string | null; goalId?: string | null };
    const result = moveTo(list, id, { parentId: target.parentId ?? null, goalId: target.goalId ?? null }, 9);
    if (!result.ok) throw new ChangePathError(`“${change.path}”：${result.error}`);
    items = result.nodes;
  } else if (op === "split") {
    const parts = Array.isArray(change.value) ? (change.value as Record<string, unknown>[]) : [];
    if (parts.length < 2) throw new ChangePathError(`“${change.path}”：拆分至少要两条`);
    const index = list.findIndex((x) => x.id === id);
    const original = list[index];
    const twins = parts.slice(1).map((p, k) => withAmount({ ...clone(original), ...clone(p), id: twinId(list, id, k + 1), parentId: original.parentId, level: original.level, goalId: original.goalId } as Item, p));
    // After the original's branch, so the new siblings come right below it.
    let end = index;
    const branch = new Set([id]);
    for (let i = index + 1; i < list.length; i++) {
      if (list[i].parentId && branch.has(list[i].parentId as string)) {
        branch.add(list[i].id);
        end = i;
      }
    }
    items = [...list.slice(0, index), withAmount({ ...original, ...clone(parts[0]), id } as Item, parts[0]), ...list.slice(index + 1, end + 1), ...twins, ...list.slice(end + 1)];
  } else throw new ChangePathError(`“${change.path}”：不认识的操作 ${String(op)}`);
  return listPath.length ? setAt(next, listPath, items, change.path) : items;
}

export function applyChanges<T>(payload: T, changes: ProposedChange[]): T {
  let next: unknown = clone(payload);
  for (const change of changes) {
    if (typeof change.path !== "string" || !change.path.trim()) throw new ChangePathError("修改缺少路径");
    next = applyOne(next, change);
  }
  return next as T;
}

export const OP_LABELS: Record<ChangeOp, string> = { set: "修改", remove: "删除", split: "拆分", move: "移动" };

export function describeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key, v]) => key !== "id" && typeof v === "string" && v)
      .map(([, v]) => v)
      .join(" ｜ ");
  }
  return String(value ?? "");
}
