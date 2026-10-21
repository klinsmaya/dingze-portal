import { describe, expect, it } from "vitest";

import {
  type GoalPathSystem,
  type KeyProjectList,
  type ProjectCharterSet,
  type RaciTable,
  chartersVsSources,
  emptyCharter,
  goalsVsBreakdown,
  kpisVsScreening,
  pathsVsDecodeMap,
  raciVsSources,
  scorecardsVsUndertaking,
  undertakingVsRaci,
} from "@dingze/shared";
import { applyChanges } from "@/lib/dingze/changes";

// 客户反馈 2026-10-15：各工具产出要连贯、可承接。带入后上游改了，下游要看得出来并能一键跟上。

const breakdown = { years: [2026], rows: [{ id: "b1", kpiId: null, theme: "做强车用气", name: "车用气销量", unit: "万方", values: { "2026": "1200" }, baseline: "", benchmark: "" }] };

describe("上下游连贯性", () => {
  it("flags an S2-03 goal that drifted from S1-07 and fixes it in one click", () => {
    const system: GoalPathSystem = {
      nodes: [],
      targets: { year: 2026, strategyReview: "", lastPeriodIssues: "", goals: [{ id: "g1", purpose: "", task: "做大车用气", metric: "车用气销量", value: "1100", unit: "万方", perspective: "financial", sourceRowId: "b1" }] },
    };
    const [issue] = goalsVsBreakdown(system, breakdown as never);
    expect(issue.message).toContain("1100 ≠ S1-07 的 2026 年 1200");
    expect(issue.zone).toBe("targets");
    const fixed = applyChanges(system, issue.fix!.changes);
    expect(goalsVsBreakdown(fixed, breakdown as never)).toEqual([]);
  });

  it("asks for RACI rows for every key project and follows renames", () => {
    const projects: KeyProjectList = { projects: [{ id: "p1", code: "", name: "物流车队签约", theme: "", objective: "", start: "", end: "", milestones: "", owner: "", sourcePathIds: [] }, { id: "p2", code: "", name: "加气站", theme: "", objective: "", start: "", end: "", milestones: "", owner: "", sourcePathIds: [] }] };
    const raci: RaciTable = { columns: [{ id: "d1", name: "运营部" }], rows: [{ id: "r1", name: "物流车队", cells: { d1: ["A"] }, sourceId: "p1", sourceKind: "project" }] };
    const issues = raciVsSources(raci, projects, undefined);
    expect(issues.map((i) => i.message).join("|")).toContain("加气站 还没有分配 RACI 责任");
    const rename = issues.find((i) => i.fix)!;
    expect(applyChanges(raci, rename.fix!.changes).rows[0].name).toBe("物流车队签约");
  });

  it("wants departments to undertake their R cells too, and notices a changed role", () => {
    const raci: RaciTable = { columns: [{ id: "d1", name: "运营部" }, { id: "d2", name: "市场部" }], rows: [{ id: "r1", name: "物流车队", cells: { d1: ["A"], d2: ["R"] }, sourceId: null, sourceKind: "manual" }] };
    const table = { rows: [{ id: "u1", deptId: "d1", deptName: "运营部", role: "R" as const, purpose: "", task: "物流车队", metric: "", value: "", sourceRowId: "r1" }] };
    const messages = undertakingVsRaci(table, raci).map((i) => i.message);
    expect(messages.some((m) => m.includes("市场部是“物流车队”的 R"))).toBe(true);
    expect(messages.some((m) => m.includes("现在是 A"))).toBe(true);
  });

  it("lists undertakings missing from the scorecards", () => {
    const table = { rows: [{ id: "u1", deptId: "d1", deptName: "运营部", role: "A" as const, purpose: "", task: "物流车队", metric: "", value: "", sourceRowId: null }] };
    expect(scorecardsVsUndertaking({ cards: [] }, table)[0].message).toContain("运营部 · 物流车队 还没有上计分卡");
  });

  it("keeps a charter's lead department on the RACI A and its dates on the key project", () => {
    const projects: KeyProjectList = { projects: [{ id: "p1", code: "", name: "物流车队", theme: "", objective: "", start: "2026-01", end: "2026-12", milestones: "", owner: "王经理", sourcePathIds: [] }] };
    const raci: RaciTable = { columns: [{ id: "d1", name: "运营部" }, { id: "d2", name: "市场部" }], rows: [{ id: "r1", name: "物流车队", cells: { d2: ["A"] }, sourceId: "p1", sourceKind: "project" }] };
    const set: ProjectCharterSet = {
      screening: [{ id: "s1", sourceId: "p1", sourceKind: "project", name: "物流车队" } as never],
      charters: [{ ...emptyCharter({ id: "c1", name: "物流车队", deptId: "d1", deptName: "运营部", start: "2026-02", end: "2026-12", owner: "王经理" }), screeningId: "s1" }],
    };
    const issues = chartersVsSources(set, projects, raci);
    const dates = issues.find((i) => i.message.includes("开始时间"))!;
    const lead = issues.find((i) => i.message.includes("牵头部门"))!;
    const fixed = applyChanges(applyChanges(set, dates.fix!.changes), lead.fix!.changes);
    expect(fixed.charters[0]).toMatchObject({ start: "2026-01", deptId: "d2", deptName: "市场部" });
    expect(chartersVsSources(fixed, projects, raci)).toEqual([]);
  });

  it("follows the decode map into imported paths and screening into KPIs", () => {
    const system: GoalPathSystem = { nodes: [{ id: "n1", parentId: null, level: 1, path: "新客户", metric: "", value: "1000", amount: 1000, unit: "", themeId: "t1" }] };
    const map = { valueGap: { target: "", baseline: "", gap: "" }, themes: [{ id: "t1", perspective: "financial" as const, category: "", title: "开发新客户", metric: "", value: "1200", supports: [], goalId: null }] };
    const [issue] = pathsVsDecodeMap(system, map);
    expect(applyChanges(system, issue.fix!.changes).nodes[0]).toMatchObject({ path: "开发新客户", value: "1200" });
    const kpis = { kpis: [{ id: "k1", theme: "", name: "售气量", candidateId: "c1", definition: "", unit: "", source: "", period: "", owner: "" }] };
    const screening = { candidates: [{ id: "c1", name: "售气量", origin: "", scores: { relevance: 5, measurability: 5, controllability: 5, motivation: 5 }, keep: false, reason: "" }] };
    expect(kpisVsScreening(kpis, screening)[0].message).toContain("已被剔除");
  });
});
