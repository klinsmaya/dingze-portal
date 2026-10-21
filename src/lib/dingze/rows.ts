import type { Issue } from "@dingze/shared";

/** Replace the item with `id` by merging `patch`. */
export function patchById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

/** Move an item one place up (-1) or down (+1). */
export function moveById<T extends { id: string }>(items: T[], id: string, delta: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Anchors that carry a blocking issue, for highlighting cells and rows. */
export function errorAnchors(issues: Issue[]): Set<string> {
  return new Set(issues.filter((i) => i.level === "error" && i.anchor).map((i) => i.anchor as string));
}
