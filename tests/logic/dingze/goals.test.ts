import { describe, expect, it } from "vitest";

import {
  type DecodeMap,
  type GoalTargets,
  type RaciTable,
  cardWeight,
  emptyGoal,
  emptyScorecardItem,
  emptyTheme,
  goalsFromBreakdown,
  orderedPaths,
  parseAmount,
  pathNode,
  pathsFromDecodeMap,
  projectsFromPaths,
  raciRowsFrom,
  scorecardsFromUndertakings,
  themeGoal,
  toggleRaciLetter,
  undertakingsFromRaci,
  validateArtifact,
  validateDecodeMap,
  validateGoalPathSystem,
  validateGoalTargets,
  validateScorecards,
} from "@dingze/shared";

const errors = (issues: { level: string; message: string }[]) => issues.filter((i) => i.level === "error").map((i) => i.message);

describe("annual goals (S2-03 第一步 定目标)", () => {
  it("takes this year's values from the S1-07 breakdown and never invents them", () => {
    const breakdown = {
      years: [2026, 2027],
      rows: [
        { id: "y1", kpiId: null, theme: "做强车用气", name: "车用气销量", unit: "万方", values: { "2026": "1100" }, baseline: "", benchmark: "", challenge: "" },
        { id: "y2", kpiId: null, theme: "", name: "利润总额", unit: "亿元", values: { "2027": "2" }, baseline: "", benchmark: "", challenge: "" },
      ],
    };
    const goals = goalsFromBreakdown(breakdown, 2026);
    expect(goals.map((g) => [g.metric, g.value, g.purpose])).toEqual([["车用气销量", "1100", "支撑“做强车用气”"]]);
    expect(goalsFromBreakdown(breakdown, 2026, goals)).toEqual([]);
  });

  it("requires task, metric and value", () => {
    expect(errors(validateGoalTargets({ year: 2026, strategyReview: "x", lastPeriodIssues: "", goals: [emptyGoal({ metric: "售气量" })] }))).toEqual([
      expect.stringContaining("缺任务、指标值"),
    ]);
  });
});

describe("decode map (S2-01) and import into the path system (S2-03)", () => {
  const goal = emptyGoal({ id: "g1", task: "提升售气量", metric: "售气量", value: "1100 万方" });
  const targets: GoalTargets = { year: 2026, strategyReview: "", lastPeriodIssues: "", goals: [goal] };
  const fin = emptyTheme("financial", { id: "f", title: "车用气增收", metric: "车用气销量", value: "800 万方", goalId: "g1" });
  const cus = emptyTheme("customer", { id: "c", title: "物流车队客户", metric: "签约车队", value: "40 家", supports: ["f"] });
  const pro = emptyTheme("process", { id: "p", title: "站点加密", metric: "新建站点", value: "6 座", supports: ["c"] });
  const lea = emptyTheme("learning", { id: "l", title: "站长梯队", metric: "合格站长", value: "12 人", supports: ["p"] });
  const map: DecodeMap = { valueGap: { target: "1100", baseline: "900", gap: "200 万方" }, themes: [fin, cus, pro, lea] };

  it("accepts four layers chained up to a goal and rejects downward support", () => {
    expect(errors(validateDecodeMap(map, targets))).toEqual([]);
    const bad = { ...map, themes: [...map.themes, emptyTheme("customer", { id: "x", title: "反向", supports: ["l"] })] };
    expect(errors(validateDecodeMap(bad, targets))).toEqual([expect.stringContaining("更上一层")]);
  });

  it("finds a theme's goal through its support chain and imports themes as level-1 paths", () => {
    expect(themeGoal(map, "l")).toBe("g1");
    const system = pathsFromDecodeMap(map, targets, { nodes: [] });
    expect(system.nodes.map((n) => [n.level, n.goalId, n.perspective, n.path, n.amount])).toEqual([
      [1, "g1", "financial", "车用气增收", 800],
      [1, "g1", "customer", "物流车队客户", 40],
      [1, "g1", "process", "站点加密", 6],
      [1, "g1", "learning", "站长梯队", 12],
    ]);
    expect(pathsFromDecodeMap(map, targets, system).nodes).toHaveLength(4);
  });
});

describe("path system (S2-03)", () => {
  const goals = [{ id: "g1", label: "提升售气量" }];
  const root = pathNode({ id: "a", goalId: "g1", path: "车用气增收", metric: "销量", value: "800 万方", amount: 800, unit: "万方" });

  it("checks 推得回来 and that every goal has paths", () => {
    const kids = [
      pathNode({ id: "b", parentId: "a", level: 2, path: "物流车队", metric: "销量", value: "500 万方", amount: 500, unit: "万方" }),
      pathNode({ id: "c", parentId: "a", level: 2, path: "网约车", metric: "销量", value: "200 万方", amount: 200, unit: "万方" }),
    ];
    expect(errors(validateGoalPathSystem({ nodes: [root, ...kids] }, goals))).toEqual([expect.stringContaining("推不回来：下级合计 700，本级 800")]);
    expect(errors(validateGoalPathSystem({ nodes: [] }, goals))).toEqual(["还没有任何路径"]);
    expect(errors(validateGoalPathSystem({ nodes: [{ ...root, goalId: null }] }, goals))).toEqual([
      expect.stringContaining("没有挂到年度目标"),
      expect.stringContaining("还没有一级路径"),
    ]);
  });

  it("orders paths depth-first under each goal", () => {
    const b = pathNode({ id: "b", parentId: "a", level: 2, path: "物流车队" });
    const d = pathNode({ id: "d", goalId: "g1", path: "工业点供" });
    expect(orderedPaths([b, d, root], ["g1"]).map((n) => n.id)).toEqual(["d", "a", "b"]);
  });

  it("parses leading amounts", () => {
    expect(parseAmount("1100 万方")).toBe(1100);
    expect(parseAmount("≥95%")).toBeNull();
  });
});

describe("projects, RACI, undertaking and scorecards", () => {
  const system = {
    nodes: [
      pathNode({ id: "a", goalId: "g1", path: "车用气增收", metric: "销量", value: "800 万方" }),
      pathNode({ id: "b", parentId: "a", level: 2, path: "物流车队", metric: "销量", value: "500 万方" }),
    ],
  };

  it("proposes projects at the chosen 立项层级 with the source path kept", () => {
    const [project] = projectsFromPaths(system, 2);
    expect([project.code, project.name, project.objective, project.sourcePathIds]).toEqual(["KP-01", "物流车队", "销量 500 万方", ["b"]]);
    expect(projectsFromPaths(system, 2, [project])).toEqual([]);
  });

  it("keeps a single A per row when toggling", () => {
    let table: RaciTable = {
      columns: [{ id: "d1", name: "燃气运营部" }, { id: "d2", name: "市场部" }],
      rows: raciRowsFrom({ paths: system.nodes }),
    };
    const rowId = table.rows[0].id;
    table = toggleRaciLetter(table, rowId, "d1", "A");
    table = toggleRaciLetter(table, rowId, "d2", "A");
    table = toggleRaciLetter(table, rowId, "d1", "R");
    expect(table.rows[0].cells).toEqual({ d1: ["R"], d2: ["A"] });
    expect(errors(validateArtifact("S2-04", { columns: table.columns, rows: [table.rows[0]] }))).toEqual([]);
  });

  it("turns A/R cells into department undertakings, then into weighted scorecards", () => {
    const raci: RaciTable = {
      columns: [{ id: "d1", name: "燃气运营部" }, { id: "d2", name: "市场部" }],
      rows: [{ id: "r1", name: "物流车队", cells: { d1: ["A"], d2: ["R"] }, sourceId: "b", sourceKind: "path" }],
    };
    const rows = undertakingsFromRaci(raci, (id) => (id === "b" ? { metric: "销量", value: "500 万方", purpose: "承接车用气增收" } : null));
    expect(rows.map((r) => [r.deptName, r.role, r.metric, r.value])).toEqual([
      ["燃气运营部", "A", "销量", "500 万方"],
      ["市场部", "R", "销量", "500 万方"],
    ]);
    const set = scorecardsFromUndertakings({ rows }, { cards: [] });
    expect(set.cards.map((c) => [c.deptName, c.items.length])).toEqual([["燃气运营部", 1], ["市场部", 1]]);
    expect(errors(validateScorecards(set))).toContainEqual(expect.stringContaining("权重合计是 0"));

    const card = { id: "d1", deptId: "d1", deptName: "燃气运营部", items: [emptyScorecardItem({ task: "物流车队", metric: "销量", target: "500", weight: 60 }), emptyScorecardItem({ task: "安全", metric: "事故", target: "0", weight: 40 })] };
    expect(cardWeight(card)).toBe(100);
    expect(errors(validateScorecards({ cards: [card] }))).toEqual([]);
  });
});
