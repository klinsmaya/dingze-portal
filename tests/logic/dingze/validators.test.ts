import { describe, expect, it } from "vitest";

import {
  type PathNode,
  type RaciMatrix,
  type StrategyContent,
  emptyStrategyContent,
  hasBlockingIssues,
  validateArtifact,
  verifyRaci,
} from "@dingze/shared";

const fullHouse = (): StrategyContent => ({
  ...emptyStrategyContent("house"),
  mission: "让城市用上清洁、稳定、可负担的能源",
  vision: "成为本省领先的综合清洁能源服务商",
  values: "安全第一 · 客户至上",
  goals: { y1: "售气量增长 1000 万方", y3: "营收 12 亿", y5: "综合能源占比 40%" },
  battlefields: [{ id: "b1", name: "城市燃气与车用气", advantage: "站点网络密度", mustWin: "车用气新客户 700 万方" }],
  foundation: { organization: "点供事业部", mechanism: "项目考核", talent: "培养 20 名骨干" },
});

const fullSixfold = () => ({
  ...emptyStrategyContent("sixfold"),
  mission: "让城市用上清洁能源",
  vision: "区域领先的综合能源服务商",
  strategicGoals: "2030 年营收 30 亿",
  strategyChoice: "稳城燃、强光伏、育储能",
  stepsAndMeasures: "三步走",
  indicatorSystem: "收入、利润、人效",
});

describe("S1-01 strategy content", () => {
  it("blocks a complete strategy house while the six-part table is missing aspects (六分法 is P0)", () => {
    const content = { ...fullHouse(), strategicGoals: "2030 年营收 30 亿" };
    const errors = validateArtifact("S1-01", content).filter((i) => i.level === "error");
    expect(errors.map((e) => e.anchor)).toEqual(["strategyChoice", "stepsAndMeasures", "indicatorSystem"]);
  });

  it("counts “待补” as missing in the six-part table", () => {
    const content = { ...fullSixfold(), indicatorSystem: "待补" };
    expect(validateArtifact("S1-01", content)).toContainEqual(expect.objectContaining({ level: "error", anchor: "indicatorSystem" }));
  });

  it("only warns about a half-filled strategy house (P1)", () => {
    const content = { ...fullSixfold(), values: "客户第一" };
    const issues = validateArtifact("S1-01", content);
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("战略屋"))).toBe(true);
    expect(validateArtifact("S1-01", fullSixfold())).toEqual([]);
  });
});

const node = (id: string, parentId: string | null, level: number, amount: number | null, metric = "新增售气量"): PathNode => ({
  id, parentId, level, path: `路径 ${id}`, metric, value: amount === null ? "≥98%" : `${amount} 万方`, amount, unit: "万方",
});

describe("path system", () => {
  it("S2-03 starts with 定目标: no year goal blocks, and issues name their step", () => {
    const issues = validateArtifact("S2-03", { nodes: [] });
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", message: expect.stringContaining("定目标：至少确定一个公司级年度目标") }));
    const goal = { id: "g1", purpose: "支撑增长", task: "提升售气量", metric: "售气量", value: "1100 万方", unit: "万方", perspective: "financial" as const, sourceRowId: null };
    const withGoal = validateArtifact("S2-03", { nodes: [], targets: { year: 2026, strategyReview: "承接 S1-07", lastPeriodIssues: "", goals: [goal] } });
    expect(withGoal.some((i) => i.message.startsWith("定目标"))).toBe(false);
    expect(withGoal.every((i) => i.message.startsWith("找路径"))).toBe(true);
  });

  it("accepts children that add back up to their parent", () => {
    const nodes = [node("1", null, 1, 700), node("1.1", "1", 2, 500), node("1.2", "1", 2, 200)];
    expect(hasBlockingIssues(validateArtifact("S2-06", { nodes }))).toBe(false);
  });

  it("blocks children that do not add back up", () => {
    const nodes = [node("1", null, 1, 700), node("1.1", "1", 2, 500), node("1.2", "1", 2, 220)];
    const issues = validateArtifact("S2-06", { nodes });
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", anchor: "1", message: expect.stringContaining("推不回来") }));
  });

  it("does not compare children measured by a different metric", () => {
    const nodes = [node("1", null, 1, 700), node("1.1", "1", 2, 2000, "新增客户数量")];
    expect(validateArtifact("S2-06", { nodes }).some((i) => i.message.includes("推不回来"))).toBe(false);
  });

  it("requires a metric and a value on every path and caps the depth at four levels", () => {
    const nodes = [{ ...node("1", null, 1, 700), metric: "" }, node("x", "1", 5, null, "新增售气量")];
    const messages = validateArtifact("S2-06", { nodes }).map((i) => i.message);
    expect(messages.some((m) => m.includes("缺衡量指标"))).toBe(true);
    expect(messages.some((m) => m.includes("层级超出"))).toBe(true);
  });
});

const matrix = (cells: Record<string, RaciMatrix["rows"][number]["cells"]>): RaciMatrix => ({
  columns: [
    { id: "ops", name: "运营部" },
    { id: "dispatch", name: "调度中心" },
    { id: "it", name: "信息部" },
  ],
  rows: Object.entries(cells).map(([id, c]) => ({ id, name: `项目 ${id}`, cells: c })),
});

describe("RACI matrix", () => {
  it("passes a row with exactly one A and at least one R", () => {
    const issues = validateArtifact("S2-04", matrix({ p1: { ops: ["A"], dispatch: ["R"], it: ["C"] } }));
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it.each([
    ["no A", { ops: ["R"], dispatch: ["C"] }, "没有 A"],
    ["two A", { ops: ["A"], dispatch: ["A"], it: ["R"] }, "有 2 个 A"],
    ["no R", { ops: ["A"], dispatch: ["C"] }, "没有 R"],
  ] as const)("blocks a row with %s", (_name, cells, text) => {
    const issues = validateArtifact("S2-04", matrix({ p1: cells as never }));
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", message: expect.stringContaining(text) }));
  });

  it("only warns about multiple R and R with A in one cell", () => {
    const issues = validateArtifact("S2-04", matrix({ p1: { ops: ["R", "A"], dispatch: ["R"] } }));
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.filter((i) => i.level === "warning").length).toBeGreaterThanOrEqual(2);
  });

  it("blocks R doubling as C / I in one cell (书：R 不兼任 C / I)", () => {
    const issues = validateArtifact("S2-04", matrix({ p1: { ops: ["A"], it: ["R", "C"] } }));
    expect(hasBlockingIssues(issues)).toBe(true);
    expect(issues.find((i) => i.level === "error")?.message).toContain("R 不兼任 C / I");
  });
});

describe("RACI 验证优化表 (表 3-18)", () => {
  const big = () =>
    matrix({
      p1: { ops: ["R"], dispatch: ["A"], it: ["R"] },
      p2: { ops: ["R"], dispatch: ["A"], it: ["C"] },
      p3: { ops: ["R"], dispatch: ["A"], it: ["C"] },
      p4: { ops: ["R", "A"], dispatch: ["C"], it: ["C"] },
    });
  const wide: RaciMatrix = {
    columns: ["ops", "dispatch", "it", "hr", "fin"].map((id) => ({ id, name: id })),
    rows: [{ id: "p1", name: "项目 p1", cells: { ops: ["A"], dispatch: ["R"], it: ["C"], hr: ["C"], fin: ["C"] } }],
  };

  it("counts the horizontal and vertical checks", () => {
    const v = verifyRaci(big());
    expect(v.horizontal).toMatchObject({ noR: 0, noA: 0, multiA: 0, multiR: 1, rWithCI: 0 });
    expect(v.verticalApplies).toBe(true);
    expect(v.vertical.rOverload).toEqual(["运营部"]);
    expect(v.vertical.aSprawl).toEqual(["调度中心"]);
    expect(v.vertical.noRA).toEqual([]);
  });

  it("warns, never blocks, on too many C, an overloaded R and a sprawling A", () => {
    const issues = validateArtifact("S2-04", wide);
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.map((i) => i.message)).toEqual(expect.arrayContaining([expect.stringContaining("顾问过多")]));
    const columnIssues = validateArtifact("S2-04", big());
    expect(hasBlockingIssues(columnIssues)).toBe(false);
    expect(columnIssues.map((i) => i.message)).toEqual(expect.arrayContaining([expect.stringContaining("执行超载"), expect.stringContaining("担任 A 的事项过多")]));
  });

  it("skips the column checks below four rows", () => {
    expect(verifyRaci(matrix({ p1: { ops: ["R", "A"] } })).verticalApplies).toBe(false);
  });
});
