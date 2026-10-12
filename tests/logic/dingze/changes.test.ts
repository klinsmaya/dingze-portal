import { describe, expect, it } from "vitest";

import { emptyStrategyContent } from "@dingze/shared";

import { ChangePathError, applyChanges, describeValue } from "@/lib/dingze/changes";

const house = () => ({
  ...emptyStrategyContent("house"),
  battlefields: [{ id: "b1", name: "城市燃气", advantage: "", mustWin: "" }],
});

describe("applying proposed changes", () => {
  it("sets top-level and nested fields without touching the original", () => {
    const original = house();
    const next = applyChanges(original, [
      { path: "values", value: "安全第一" },
      { path: "goals.y3", value: "营收 12 亿" },
    ]);
    expect(next.values).toBe("安全第一");
    expect(next.goals).toEqual({ y1: "", y3: "营收 12 亿", y5: "" });
    expect(original.values).toBe("");
  });

  it("addresses array items by id and appends with +", () => {
    const next = applyChanges(house(), [
      { path: "battlefields.b1.mustWin", value: "车用气新客户 700 万方" },
      { path: "battlefields.+", value: { id: "b2", name: "储能", advantage: "", mustWin: "" } },
    ]);
    expect(next.battlefields.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(next.battlefields[0].mustWin).toBe("车用气新客户 700 万方");
  });

  it("rejects paths that do not exist instead of inventing structure", () => {
    expect(() => applyChanges(house(), [{ path: "battlefields.b9.name", value: "x" }])).toThrow(ChangePathError);
    expect(() => applyChanges(house(), [{ path: "nope.deep", value: "x" }])).toThrow(ChangePathError);
  });

  it("describes object values for the suggestion card", () => {
    expect(describeValue({ id: "b2", name: "储能", advantage: "示范项目", mustWin: "" })).toBe("储能 ｜ 示范项目");
  });

  it("splits, moves and removes tree items as one proposal (design 10 画面 6)", () => {
    const paths = {
      nodes: [
        { id: "a", parentId: null, goalId: "g", level: 1, path: "开发车用新客户", value: "700" },
        { id: "a1", parentId: "a", goalId: null, level: 2, path: "争取公共车辆用户", value: "200" },
        { id: "a1x", parentId: "a1", goalId: null, level: 3, path: "进行业务洽谈", value: "100%" },
        { id: "a2", parentId: "a", goalId: null, level: 2, path: "吸引加气客户", value: "500" },
      ],
    };
    const split = applyChanges(paths, [{ op: "split", path: "nodes.a1", value: [{ path: "争取公交车辆用户", value: "120" }, { path: "争取出租车队用户", value: "80" }] }]);
    expect(split.nodes.map((n) => n.path)).toEqual(["开发车用新客户", "争取公交车辆用户", "进行业务洽谈", "争取出租车队用户", "吸引加气客户"]);
    expect(split.nodes[3]).toMatchObject({ parentId: "a", level: 2, value: "80" });
    expect(split.nodes[2].parentId).toBe("a1");

    const moved = applyChanges(paths, [{ op: "move", path: "nodes.a1", value: { parentId: null, goalId: "g" } }]);
    expect(moved.nodes.find((n) => n.id === "a1")).toMatchObject({ parentId: null, goalId: "g", level: 1 });
    expect(moved.nodes.find((n) => n.id === "a1x")?.level).toBe(2);

    const removed = applyChanges(paths, [{ op: "remove", path: "nodes.a1" }]);
    expect(removed.nodes.map((n) => n.id)).toEqual(["a", "a2"]);
    expect(() => applyChanges(paths, [{ op: "split", path: "nodes.a1", value: [{ path: "只有一条" }] }])).toThrow(ChangePathError);
  });

  it("keeps a path's value and amount in step", () => {
    const paths = { nodes: [{ id: "a", parentId: null, goalId: "g", level: 1, path: "开发新客户", value: "1.0", amount: 1 }] };
    const split = applyChanges(paths, [{ op: "split", path: "nodes.a", value: [{ path: "绍兴", amount: 0.6 }, { path: "湖州", value: "0.4" }] }]);
    expect(split.nodes.map((n) => [n.value, n.amount])).toEqual([
      ["0.6", 0.6],
      ["0.4", 0.4],
    ]);
    const set = applyChanges(paths, [{ path: "nodes.a.value", value: "1.2" }]);
    expect(set.nodes[0].amount).toBe(1.2);
  });
});
