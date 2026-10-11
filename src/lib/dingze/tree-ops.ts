// 调结构 (design 10 §3): one set of tree operations for every flat tree in the tables — company
// and department paths (S2-03 / S2-06, roots hang on a goal) and WBS packages (S3-02). Nodes keep
// their order in the array; siblings are the nodes with the same parent (or, for roots, the same
// goal). Every operation is pure and returns the next list, or an error in plain words.

export type TreeItem = { id: string; parentId: string | null; level: number; goalId?: string | null };

export type TreeResult<T> = { ok: true; nodes: T[]; focus?: string } | { ok: false; error: string };

const fail = <T>(error: string): TreeResult<T> => ({ ok: false, error });

const groupOf = (n: TreeItem) => n.parentId ?? `goal:${n.goalId ?? ""}`;

export function siblings<T extends TreeItem>(nodes: T[], node: T): T[] {
  const key = groupOf(node);
  return nodes.filter((n) => groupOf(n) === key);
}

export function childrenOf<T extends TreeItem>(nodes: T[], id: string): T[] {
  return nodes.filter((n) => n.parentId === id);
}

/** The node and everything under it. */
export function subtree<T extends TreeItem>(nodes: T[], id: string): Set<string> {
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

/** Depth-first order (sibling order kept), so each branch stays together in the array. */
export function normalize<T extends TreeItem>(nodes: T[]): T[] {
  const ids = new Set(nodes.map((n) => n.id));
  const out: T[] = [];
  const seen = new Set<string>();
  const visit = (n: T) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    out.push(n);
    for (const c of nodes) if (c.parentId === n.id) visit(c);
  };
  for (const n of nodes) if (!n.parentId || !ids.has(n.parentId)) visit(n);
  for (const n of nodes) if (!seen.has(n.id)) out.push(n);
  return out;
}

/** Levels below the node, counting the node itself as 1. */
function depth<T extends TreeItem>(nodes: T[], id: string): number {
  const kids = childrenOf(nodes, id);
  return 1 + (kids.length ? Math.max(...kids.map((k) => depth(nodes, k.id))) : 0);
}

/** Shift a subtree by `delta` levels. */
function shift<T extends TreeItem>(nodes: T[], ids: Set<string>, delta: number): T[] {
  return nodes.map((n) => (ids.has(n.id) ? { ...n, level: n.level + delta } : n));
}

/** Put the node right after `afterId` in the array (or first in the list when null). */
function placeAfter<T extends TreeItem>(nodes: T[], id: string, afterId: string | null): T[] {
  const node = nodes.find((n) => n.id === id);
  if (!node) return nodes;
  const rest = nodes.filter((n) => n.id !== id);
  const index = afterId ? rest.findIndex((n) => n.id === afterId) + 1 : 0;
  return [...rest.slice(0, index), node, ...rest.slice(index)];
}

/** The last node of the subtree in array order, so a new sibling lands after the whole branch. */
function lastOfBranch<T extends TreeItem>(nodes: T[], id: string): string {
  const ids = subtree(nodes, id);
  let last = id;
  for (const n of nodes) if (ids.has(n.id)) last = n.id;
  return last;
}

export function addChild<T extends TreeItem>(nodes: T[], id: string, make: (patch: Partial<T>) => T, maxLevel: number): TreeResult<T> {
  const parent = nodes.find((n) => n.id === id);
  if (!parent) return fail("找不到这一项");
  if (parent.level >= maxLevel) return fail(`最多分到 ${maxLevel} 级`);
  const child = make({ parentId: parent.id, level: parent.level + 1, goalId: null } as Partial<T>);
  const after = lastOfBranch(nodes, id);
  const index = nodes.findIndex((n) => n.id === after) + 1;
  return { ok: true, nodes: [...nodes.slice(0, index), child, ...nodes.slice(index)], focus: child.id };
}

export function addSibling<T extends TreeItem>(nodes: T[], id: string, make: (patch: Partial<T>) => T): TreeResult<T> {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("找不到这一项");
  const sibling = make({ parentId: node.parentId, level: node.level, goalId: node.parentId ? null : (node.goalId ?? null) } as Partial<T>);
  const after = lastOfBranch(nodes, id);
  const index = nodes.findIndex((n) => n.id === after) + 1;
  return { ok: true, nodes: [...nodes.slice(0, index), sibling, ...nodes.slice(index)], focus: sibling.id };
}

/** Up / down among its siblings. */
export function move<T extends TreeItem>(nodes: T[], id: string, delta: -1 | 1): TreeResult<T> {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("找不到这一项");
  const sibs = siblings(nodes, node);
  const at = sibs.findIndex((n) => n.id === id);
  const other = sibs[at + delta];
  if (!other) return fail(delta < 0 ? "已经是第一条" : "已经是最后一条");
  if (delta < 0) {
    const rest = nodes.filter((n) => n.id !== id);
    const index = rest.findIndex((n) => n.id === other.id);
    return { ok: true, nodes: normalize([...rest.slice(0, index), node, ...rest.slice(index)]), focus: id };
  }
  return { ok: true, nodes: normalize(placeAfter(nodes, id, other.id)), focus: id };
}

/** 降一级: becomes the last child of the sibling above it. */
export function indent<T extends TreeItem>(nodes: T[], id: string, maxLevel: number): TreeResult<T> {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("找不到这一项");
  const sibs = siblings(nodes, node);
  const above = sibs[sibs.findIndex((n) => n.id === id) - 1];
  if (!above) return fail("上面没有同级，不能降级");
  if (above.level + depth(nodes, id) > maxLevel) return fail(`降级后会超过 ${maxLevel} 级`);
  const ids = subtree(nodes, id);
  let next = shift(nodes, ids, 1).map((n) => (n.id === id ? { ...n, parentId: above.id, goalId: null } : n));
  const lastChild = childrenOf(next, above.id).filter((c) => c.id !== id).pop();
  next = placeAfter(next, id, lastChild ? lastOfBranch(next, lastChild.id) : above.id);
  return { ok: true, nodes: normalize(next), focus: id };
}

/** 升一级: becomes the sibling right after its parent. */
export function outdent<T extends TreeItem>(nodes: T[], id: string): TreeResult<T> {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("找不到这一项");
  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : undefined;
  if (!parent) return fail("已经是第一级");
  const ids = subtree(nodes, id);
  const anchor = lastOfBranch(nodes, parent.id);
  let next = shift(nodes, ids, -1).map((n) =>
    n.id === id ? { ...n, parentId: parent.parentId, goalId: parent.parentId ? null : (parent.goalId ?? null) } : n,
  );
  next = placeAfter(next, id, anchor === id ? parent.id : anchor);
  return { ok: true, nodes: normalize(next), focus: id };
}

export type MoveTarget = { parentId: string | null; goalId?: string | null };

/** Where a node may go: any node outside its own branch that still leaves room for its levels. */
export function canMoveTo<T extends TreeItem>(nodes: T[], id: string, target: MoveTarget, maxLevel: number): string | null {
  const node = nodes.find((n) => n.id === id);
  if (!node) return "找不到这一项";
  if (target.parentId) {
    if (subtree(nodes, id).has(target.parentId)) return "不能移到自己的下级里";
    const parent = nodes.find((n) => n.id === target.parentId);
    if (!parent) return "找不到目标";
    if (parent.level + depth(nodes, id) > maxLevel) return `移过去会超过 ${maxLevel} 级`;
    if (node.parentId === parent.id) return "已经在这里";
  } else if (!node.parentId && (node.goalId ?? null) === (target.goalId ?? null)) return "已经在这里";
  return null;
}

/** 移动到… / 拖到别的上级: the branch moves with it, levels follow the new parent. */
export function moveTo<T extends TreeItem>(nodes: T[], id: string, target: MoveTarget, maxLevel: number): TreeResult<T> {
  const problem = canMoveTo(nodes, id, target, maxLevel);
  if (problem) return fail(problem);
  const node = nodes.find((n) => n.id === id)!;
  const parent = target.parentId ? nodes.find((n) => n.id === target.parentId)! : null;
  const level = parent ? parent.level + 1 : 1;
  const ids = subtree(nodes, id);
  let next = shift(nodes, ids, level - node.level).map((n) =>
    n.id === id ? { ...n, parentId: parent?.id ?? null, goalId: parent ? null : (target.goalId ?? null) } : n,
  );
  const lastSibling = (parent ? childrenOf(next, parent.id) : next.filter((n) => !n.parentId && (n.goalId ?? null) === (target.goalId ?? null)))
    .filter((n) => n.id !== id)
    .pop();
  next = placeAfter(next, id, lastSibling ? lastOfBranch(next, lastSibling.id) : (parent?.id ?? null));
  return { ok: true, nodes: normalize(next), focus: id };
}

/** 删除: the node and its branch. */
export function removeBranch<T extends TreeItem>(nodes: T[], id: string): TreeResult<T> {
  const ids = subtree(nodes, id);
  return { ok: true, nodes: nodes.filter((n) => !ids.has(n.id)) };
}

/** 拆成两条: a copy right below it; the children stay with the first. */
export function split<T extends TreeItem>(nodes: T[], id: string, make: (patch: Partial<T>) => T, copy: (node: T) => Partial<T>): TreeResult<T> {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("找不到这一项");
  const twin = make({ ...copy(node), parentId: node.parentId, level: node.level, goalId: node.parentId ? null : (node.goalId ?? null) } as Partial<T>);
  const after = lastOfBranch(nodes, id);
  const index = nodes.findIndex((n) => n.id === after) + 1;
  return { ok: true, nodes: [...nodes.slice(0, index), twin, ...nodes.slice(index)], focus: twin.id };
}

/** 和相邻同级合并: the next sibling (or the previous one) folds into this node; its children move over. */
export function mergeWithNeighbour<T extends TreeItem>(nodes: T[], id: string, combine: (keep: T, gone: T) => Partial<T>): TreeResult<T> {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("找不到这一项");
  const sibs = siblings(nodes, node);
  const at = sibs.findIndex((n) => n.id === id);
  const other = sibs[at + 1] ?? sibs[at - 1];
  if (!other) return fail("没有相邻的同级可以合并");
  const next = nodes
    .filter((n) => n.id !== other.id)
    .map((n) => (n.id === id ? { ...n, ...combine(n, other) } : n.parentId === other.id ? { ...n, parentId: id } : n));
  return { ok: true, nodes: next, focus: id };
}
