import { describe, expect, it } from "vitest";

import {
  type ProjectCharterSet,
  charterFor,
  classify,
  dependencyCycle,
  emptyCharter,
  emptyScreening,
  nextCharterCode,
  planNode,
  planRowsFromCharters,
  priorityScore,
  resourceRow,
  resourceRowsFromCharters,
  screeningFrom,
  timeColumns,
  timeIndex,
  validateCharterSet,
  validateCompanyPlanBook,
  validateProgressPlan,
  validateResourceMatch,
  wbsPackage,
} from "@dingze/shared";

const errors = (issues: { level: string; message: string }[]) => issues.filter((i) => i.level === "error").map((i) => i.message);

const goodCharter = () =>
  emptyCharter({
    id: "c1",
    screeningId: "s1",
    code: "2026OPSP001",
    name: "物流车队客户拓展",
    objective: "车用气销量 700 万方",
    start: "2026-01",
    end: "2026-12",
    deliverables: "40 家签约车队",
    owner: "王经理",
    acceptance: { result: "销量 ≥700 万方", process: "", close: "" },
    resources: { fte: "3 人", budget: "80 万元", material: "2 台加气车" },
    wbs: [
      wbsPackage({ id: "w1", name: "客户名单", doneDefinition: "名单经部门评审", owner: "王经理" }),
      wbsPackage({ id: "w2", name: "签约", doneDefinition: "合同盖章", owner: "王经理", dependsOn: ["w1"] }),
    ],
  });

describe("project screening (项目化判定)", () => {
  it("classifies by the number of yes answers and waits for all four", () => {
    expect(classify({ crossDept: true, longRunning: true, reusable: false, risky: false })).toBe("P");
    expect(classify({ crossDept: false, longRunning: true, reusable: false, risky: false })).toBe("S");
    expect(classify({ crossDept: false, longRunning: false, reusable: false, risky: false })).toBe("R");
    expect(classify({ crossDept: true, longRunning: null, reusable: false, risky: false })).toBeNull();
  });

  it("screens S2-08 projects and department level-1 paths once each", () => {
    const projects = { projects: [{ id: "kp1", code: "KP-01", name: "物流车队客户拓展", theme: "做强车用气", objective: "700 万方", start: "2026-01", end: "2026-12", milestones: "", owner: "王经理", sourcePathIds: [] }] };
    const paths = { nodes: [{ id: "m1", parentId: null, goalId: "u1", level: 1, path: "重点物流园区开发", metric: "", value: "" }] };
    const items = screeningFrom(projects, paths);
    expect(items.map((i) => [i.sourceKind, i.name])).toEqual([["project", "物流车队客户拓展"], ["path", "重点物流园区开发"]]);
    expect(screeningFrom(projects, paths, items)).toEqual([]);
    expect(charterFor(items[0], projects, "2026OPSP001")).toMatchObject({ code: "2026OPSP001", theme: "做强车用气", owner: "王经理", start: "2026-01" });
  });
});

describe("project charters (S3-02) with WBS (S3-03)", () => {
  it("numbers charters by year, function and sequence", () => {
    expect(nextCharterCode(2026, "ops", [goodCharter()])).toBe("2026OPSP002");
    expect(nextCharterCode(2026, "MKT", [goodCharter()])).toBe("2026MKTP001");
  });

  it("weights the five priority factors 30/25/20/15/10", () => {
    expect(priorityScore({ fit: 5, roi: 4, urgency: 3, feasibility: 2, resources: 1 })).toBe(3.5);
    expect(priorityScore({ fit: 5, roi: null, urgency: 3, feasibility: 2, resources: 1 })).toBeNull();
  });

  it("requires a charter for every P item and a sound WBS", () => {
    const yes = { crossDept: true, longRunning: true, reusable: true, risky: false };
    const set: ProjectCharterSet = { screening: [emptyScreening({ id: "s1", name: "物流车队", answers: yes }), emptyScreening({ id: "s2", name: "站点", answers: yes })], charters: [goodCharter()] };
    expect(errors(validateCharterSet(set))).toEqual([expect.stringContaining("“站点”判定为项目，但还没有项目任务书")]);

    const cyclic = goodCharter();
    cyclic.wbs[0].dependsOn = ["w2"];
    cyclic.code = "OPS-1";
    expect(errors(validateCharterSet({ screening: [], charters: [cyclic] }))).toEqual([
      expect.stringContaining("项目编号应为"),
      expect.stringContaining("依赖形成了循环：客户名单 → 签约"),
    ]);
  });

  it("finds dependency cycles", () => {
    expect(dependencyCycle([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: [] }])).toEqual([]);
    expect(dependencyCycle([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }])).toEqual(["a", "b"]);
  });
});

describe("progress plan (S3-05) with nodes (S3-04)", () => {
  const charters: ProjectCharterSet = { screening: [], charters: [goodCharter()] };

  it("imports one row per charter with a node per level-1 work package", () => {
    const [row] = planRowsFromCharters(charters);
    expect(row.name).toBe("2026OPSP001 物流车队客户拓展");
    expect(row.nodes.map((n) => [n.name, n.acceptance])).toEqual([["客户名单", "名单经部门评审"], ["签约", "合同盖章"]]);
  });

  it("maps months and quarters onto one timeline", () => {
    expect(timeIndex("2026-03")! < timeIndex("2026-Q2")!).toBe(true);
    expect(timeIndex("2026-Q1")).toBe(timeIndex("2026-03"));
    expect(timeColumns("quarter", 2026)).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
  });

  it("checks the four elements, the scale, vague wording and dependency order", () => {
    const a = planNode({ id: "a", time: "2026-06", name: "签约 20 家", deliverable: "20 份合同", acceptance: "合同盖章", owner: "王经理" });
    const b = planNode({ id: "b", time: "2026-03", name: "持续推进", deliverable: "持续优化客户结构", acceptance: "完成", owner: "王经理", dependsOn: ["a"] });
    const c = planNode({ id: "c", time: "2026-Q4", name: "复盘", deliverable: "复盘报告", acceptance: "报告评审通过" });
    const issues = validateProgressPlan({ scale: "month", rows: [{ id: "r", charterId: "c1", name: "物流车队", nodes: [a, b, c] }] }, charters);
    expect(errors(issues)).toHaveLength(2);
    expect(errors(issues)).toEqual(expect.arrayContaining([expect.stringContaining("时间应写成“2026-03”"), expect.stringContaining("早于它依赖的“签约 20 家”")]));
    expect(issues.map((i) => i.message)).toContainEqual(expect.stringContaining("“持续优化”这类不可验收"));
  });
});

describe("resource match (S3-06)", () => {
  const charters: ProjectCharterSet = { screening: [], charters: [goodCharter()] };

  it("maps the charter's 三分法 onto the four categories", () => {
    const rows = resourceRowsFromCharters(charters);
    expect(rows.map((r) => [r.category, r.need])).toEqual([["people", "3 人"], ["finance", "80 万元"], ["material", "2 台加气车"], ["it", ""]]);
    expect(resourceRowsFromCharters(charters, rows)).toEqual([]);
  });

  it("only warns about missing categories, but a major gap needs owner and approach", () => {
    const major = resourceRow({ charterId: "c1", category: "finance", need: "80 万元", stock: "50 万元", gap: "30 万元", major: true });
    const issues = validateResourceMatch({ rows: [major, resourceRow({ charterId: "c1", category: "it", none: true })] }, charters);
    expect(errors(issues)).toEqual([expect.stringContaining("补齐方式和责任人")]);
    expect(issues.map((i) => i.message)).toContainEqual(expect.stringContaining("还没有人、物料类资源"));
  });
});

describe("plan books (S3-07)", () => {
  it("requires the chapters only the enterprise can write", () => {
    expect(errors(validateCompanyPlanBook({ text: { summary: "", lastYear: "", environment: "x", risks: "", notDo: "", dictionaryNote: "" } }))).toEqual([
      "公司级计划书还缺：二 上年度总结概述、七 风险评估与应对措施",
    ]);
  });
});

describe("charter codes as the book writes them", () => {
  it.each(["2026OPSP001", "2024HR-P001", "2026-RP001"])("accepts %s", (code) => {
    const c = goodCharter();
    c.code = code;
    expect(errors(validateCharterSet({ screening: [], charters: [c] }))).toEqual([]);
  });

  it("still rejects codes without the P and serial", () => {
    const c = goodCharter();
    c.code = "KP-01";
    expect(errors(validateCharterSet({ screening: [], charters: [c] }))).toEqual([expect.stringContaining("项目编号应为")]);
  });
});
