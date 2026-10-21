import { describe, expect, it } from "vitest";

import {
  type KpiScreening,
  type StrategyMap,
  breakdownRowsFromKpis,
  candidateTotal,
  candidatesFromIpooc,
  currentYearTargets,
  defaultBreakdownYears,
  emptyCandidate,
  emptyIpoocSheet,
  emptyKpi,
  emptyStrategyContent,
  kpisFromScreening,
  seedStrategyLogic,
  seedStrategyMap,
  validateArtifact,
  validateIpooc,
  validateKpiBreakdown,
  validateKpiScreening,
  validateStrategyKpis,
  validateStrategyLogic,
  validateStrategyMap,
} from "@dingze/shared";

const errors = (issues: { level: string; message: string }[]) => issues.filter((i) => i.level === "error").map((i) => i.message);

describe("strategy map (S1-02)", () => {
  const map: StrategyMap = {
    objectives: [
      { id: "f", perspective: "financial", title: "营收 12 亿", note: "" },
      { id: "c", perspective: "customer", title: "车用气客户增长", note: "" },
      { id: "p", perspective: "process", title: "站点网络加密", note: "" },
      { id: "l", perspective: "learning", title: "调度人才梯队", note: "" },
    ],
    links: [
      { id: "1", from: "l", to: "p", kind: "cause" },
      { id: "2", from: "p", to: "c", kind: "cause" },
      { id: "3", from: "c", to: "f", kind: "cause" },
    ],
  };

  it("accepts a map whose causes run bottom-up through all four perspectives", () => {
    expect(validateStrategyMap(map)).toEqual([]);
  });

  it("rejects downward causes and cross-layer synergy", () => {
    const bad = { ...map, links: [...map.links, { id: "4", from: "f", to: "c", kind: "cause" as const }, { id: "5", from: "p", to: "c", kind: "synergy" as const }] };
    expect(errors(validateStrategyMap(bad))).toEqual([
      expect.stringContaining("自下而上"),
      expect.stringContaining("同一层面"),
    ]);
  });

  it("needs at least three perspectives and some causal link", () => {
    const thin = { objectives: map.objectives.slice(0, 2), links: [] };
    expect(errors(validateStrategyMap(thin))).toEqual([
      expect.stringContaining("三个层面"),
      expect.stringContaining("纵向因果"),
    ]);
  });

  it("seeds objectives from the strategy house", () => {
    const house = {
      ...emptyStrategyContent("house"),
      goals: { y1: "", y3: "营收 12 亿", y5: "" },
      battlefields: [{ id: "b1", name: "城市燃气", advantage: "站点密度", mustWin: "" }],
    };
    expect(seedStrategyMap(house).objectives.map((o) => `${o.perspective}:${o.title}`)).toEqual([
      "financial:营收 12 亿",
      "customer:城市燃气",
      "process:站点密度",
    ]);
  });
});

describe("strategy logic (S1-03)", () => {
  it("requires a statement and at least one tactic per strategy", () => {
    expect(errors(validateStrategyLogic({ strategies: [{ id: "s", statement: "做强城市燃气", tactics: [] }], levelNote: "x" }))).toEqual([
      expect.stringContaining("还没有策略"),
    ]);
  });

  it("seeds one strategy per battlefield", () => {
    const house = { ...emptyStrategyContent("house"), battlefields: [{ id: "b1", name: "城市燃气", advantage: "", mustWin: "" }] };
    const logic = seedStrategyLogic(house);
    expect(logic.strategies.map((s) => s.statement)).toEqual(["城市燃气"]);
    expect(logic.strategies[0].tactics).toHaveLength(1);
  });
});

describe("IPOOC (S1-04)", () => {
  it("needs an indicator and flags missing SMART checks as a warning", () => {
    const sheet = emptyIpoocSheet("加密站点网络");
    expect(errors(validateIpooc({ sheets: [sheet] }))).toEqual([expect.stringContaining("还没有设计任何指标")]);
    sheet.rows.O2.indicator = "车用气销量增长率";
    const issues = validateIpooc({ sheets: [sheet] });
    expect(errors(issues)).toEqual([]);
    expect(issues.map((i) => i.message)).toContainEqual(expect.stringContaining("SMART"));
  });
});

describe("KPI screening (S1-05) and strategy KPIs (S1-06)", () => {
  const scored = (name: string, keep: boolean | null) => ({
    ...emptyCandidate(name),
    scores: { relevance: 5, measurability: 4, controllability: 3, motivation: 4 },
    keep,
  });

  it("totals four 1–5 scores and requires a conclusion", () => {
    expect(candidateTotal(scored("售气量", true))).toBe(16);
    expect(candidateTotal(emptyCandidate("x"))).toBeNull();
    expect(errors(validateKpiScreening({ candidates: [scored("售气量", null)] }))).toEqual([
      expect.stringContaining("保留或剔除"),
      expect.stringContaining("至少保留一个"),
    ]);
  });

  it("warns when more than six KPIs are kept", () => {
    const screening: KpiScreening = { candidates: Array.from({ length: 7 }, (_, i) => scored(`指标${i}`, true)) };
    expect(validateKpiScreening(screening).map((i) => i.message)).toContainEqual(expect.stringContaining("不超过 6 个"));
  });

  it("brings IPOOC indicators into screening and kept ones into the KPI table, without duplicates", () => {
    const sheet = emptyIpoocSheet("加密站点网络");
    sheet.rows.O2.indicator = "车用气销量增长率";
    sheet.rows.C.indicator = "单站建设成本";
    const candidates = candidatesFromIpooc({ sheets: [sheet] }, [emptyCandidate("单站建设成本")]);
    expect(candidates.map((c) => c.name)).toEqual(["车用气销量增长率"]);
    expect(candidates[0].origin).toBe("加密站点网络 · O 结果");

    const kpis = kpisFromScreening({ candidates: [{ ...candidates[0], keep: true }, scored("剔除的", false)] });
    expect(kpis.map((k) => [k.name, k.theme])).toEqual([["车用气销量增长率", "加密站点网络"]]);
  });

  it("requires definition, source and period for each strategy KPI", () => {
    expect(errors(validateStrategyKpis({ kpis: [emptyKpi("售气量")] }))).toEqual([expect.stringContaining("口径、数据来源、统计周期")]);
  });
});

describe("annual breakdown (S1-07)", () => {
  it("uses 前三后一 by default", () => {
    expect(defaultBreakdownYears(2026)).toEqual([2026, 2027, 2028, 2030]);
  });

  it("requires this year's value and points out KPIs not broken down", () => {
    const kpi = { ...emptyKpi("售气量"), id: "k1" };
    const other = { ...emptyKpi("利润总额"), id: "k2" };
    const [row] = breakdownRowsFromKpis({ kpis: [kpi] });
    const breakdown = { years: [2026, 2027, 2028, 2030], rows: [row] };
    const issues = validateKpiBreakdown(breakdown, { kpis: [kpi, other] });
    expect(errors(issues)).toEqual([expect.stringContaining("2026 年")]);
    expect(issues.map((i) => i.message)).toContainEqual(expect.stringContaining("“利润总额”还没有年度分解"));

    row.values = { "2026": "1100", "2027": "1300" };
    expect(errors(validateKpiBreakdown(breakdown))).toEqual([]);
    expect(currentYearTargets(breakdown)).toEqual([{ name: "售气量", unit: "", value: "1100", theme: "" }]);
  });

  it("is reached through the shared dispatcher with its upstream", () => {
    const issues = validateArtifact("S1-07", { years: [2026, 2026, 2027], rows: [] });
    expect(errors(issues)).toEqual([expect.stringContaining("不能重复"), expect.stringContaining("还没有要分解")]);
  });
});
