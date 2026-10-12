import { describe, expect, it } from "vitest";

import { addChild, addSibling, canMoveTo, indent, mergeWithNeighbour, move, moveTo, outdent, removeBranch, split } from "@/lib/dingze/tree-ops";

type N = { id: string; parentId: string | null; level: number; goalId?: string | null; path: string };
let seq = 0;
const make = (patch: Partial<N>): N => ({ id: `x${++seq}`, parentId: null, level: 1, goalId: null, path: "", ...patch });
const tree: N[] = [
  { id: "a", parentId: null, goalId: "g1", level: 1, path: "开发车用气新客户" },
  { id: "a1", parentId: "a", level: 2, path: "公交" },
  { id: "a2", parentId: "a", level: 2, path: "出租车" },
  { id: "b", parentId: null, goalId: "g1", level: 1, path: "开拓点供" },
];
const ok = <T,>(r: { ok: boolean; nodes?: T[]; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.nodes as T[];
};
const shape = (nodes: N[]) => nodes.map((n) => `${n.id}:${n.parentId ?? n.goalId}:${n.level}`).join(" ");

describe("tree operations", () => {
  it("adds a child after the whole branch and a sibling on the same goal", () => {
    const c = ok<N>(addChild(tree, "a", make, 4));
    expect(c[3]).toMatchObject({ parentId: "a", level: 2 });
    const s = ok<N>(addSibling(tree, "a", make));
    expect(s[3]).toMatchObject({ parentId: null, goalId: "g1", level: 1 });
    expect(addChild([{ ...tree[0], level: 4 }], "a", make, 4).ok).toBe(false);
  });

  it("indents under the sibling above and outdents back after the parent", () => {
    const i = ok<N>(indent(tree, "b", 4));
    expect(shape(i)).toBe("a:g1:1 a1:a:2 a2:a:2 b:a:2");
    expect(indent(tree, "a", 4).ok).toBe(false);
    const o = ok<N>(outdent(tree, "a1"));
    expect(o.find((n) => n.id === "a1")).toMatchObject({ parentId: null, goalId: "g1", level: 1 });
    expect(o.map((n) => n.id)).toEqual(["a", "a2", "a1", "b"]);
  });

  it("moves among siblings and to another parent with its branch", () => {
    expect(ok<N>(move(tree, "a2", -1)).map((n) => n.id)).toEqual(["a", "a2", "a1", "b"]);
    expect(move(tree, "a1", -1).ok).toBe(false);
    const m = ok<N>(moveTo(tree, "a", { parentId: "b" }, 4));
    expect(shape(m)).toBe("b:g1:1 a:b:2 a1:a:3 a2:a:3");
    expect(canMoveTo(tree, "a", { parentId: "a1" }, 4)).toContain("自己的下级");
    expect(canMoveTo(tree, "a", { parentId: "b" }, 2)).toContain("超过");
  });

  it("inserts a dragged branch in front of a sibling", () => {
    const front = ok<N>(moveTo(tree, "b", { parentId: null, goalId: "g1", before: "a" }, 4));
    expect(front.map((n) => n.id)).toEqual(["b", "a", "a1", "a2"]);
    const between = ok<N>(moveTo(tree, "b", { parentId: "a", before: "a2" }, 4));
    expect(shape(between)).toBe("a:g1:1 a1:a:2 b:a:2 a2:a:2");
    expect(canMoveTo(tree, "a1", { parentId: "a", before: "a2" }, 4)).toBe("已经在这里");
    expect(canMoveTo(tree, "a2", { parentId: "a", before: "a1" }, 4)).toBeNull();
  });

  it("splits, merges and removes branches", () => {
    const s = ok<N>(split(tree, "a1", make, (n) => ({ path: `${n.path}（拆）` })));
    expect(s[2]).toMatchObject({ parentId: "a", path: "公交（拆）" });
    const g = ok<N>(mergeWithNeighbour(tree, "a", (keep, gone) => ({ path: `${keep.path}、${gone.path}` })));
    expect(g.map((n) => n.id)).toEqual(["a", "a1", "a2"]);
    expect(g[0].path).toBe("开发车用气新客户、开拓点供");
    expect(ok<N>(removeBranch(tree, "a")).map((n) => n.id)).toEqual(["b"]);
  });
});
