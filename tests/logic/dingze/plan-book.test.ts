import { describe, expect, it } from "vitest";

import { emptyCharter, emptyPlanBookText, emptyStrategyContent, planNode, resourceRow } from "@dingze/shared";

import { buildCompanyPlanBook, buildDeptPlanBook, companySummary, sumAmounts } from "@/lib/dingze/plan-book";

const upstream = {
  "S1-07": {
    years: [2026, 2027],
    rows: [{ id: "y1", kpiId: null, theme: "做强车用气", name: "车用气销量", unit: "万方", values: { "2026": "1100" }, baseline: "", benchmark: "", challenge: "" }],
  },
  "S2-03-T": { year: 2026, strategyReview: "", lastPeriodIssues: "", goals: [{ id: "g1", purpose: "", task: "提升车用气销量", metric: "车用气销量", value: "1100", unit: "万方", perspective: "financial" as const, sourceRowId: "y1" }] },
  "S2-05": {
    rows: [
      { id: "u1", deptId: "org-2", deptName: "燃气运营部", role: "A" as const, purpose: "", task: "物流车队", metric: "销量", value: "700 万方", sourceRowId: null },
      { id: "u2", deptId: "org-1", deptName: "战略发展部", role: "A" as const, purpose: "", task: "站点审批", metric: "批复", value: "6 座", sourceRowId: null },
    ],
  },
  "S3-02": {
    screening: [],
    charters: [
      emptyCharter({ id: "c1", code: "2026OPSP001", name: "物流车队客户拓展", deptId: "org-2", deptName: "燃气运营部" }),
      emptyCharter({ id: "c2", code: "2026STRP001", name: "站点审批", deptId: "org-1", deptName: "战略发展部" }),
    ],
  },
  "S3-05": { scale: "month" as const, rows: [{ id: "r1", charterId: "c1", name: "2026OPSP001 物流车队客户拓展", nodes: [planNode({ time: "2026-03", name: "签约 20 家" })] }] },
  "S3-06": { rows: [resourceRow({ charterId: "c1", category: "finance", need: "80 万元", gap: "30 万元", major: true })] },
};

describe("plan books", () => {
  it("has eight chapters with entered text and same-source tables copied from upstream", () => {
    const book = buildCompanyPlanBook({ enterprise: "DZ测试燃气", year: 2026, text: { ...emptyPlanBookText(), summary: "全年聚焦车用气" }, upstream });
    expect(book.chapters.map((c) => c.no)).toEqual(["一", "二", "三", "四", "五", "六", "七", "八"]);
    expect(book.chapters[0].blocks).toEqual(
      expect.arrayContaining([
        { kind: "heading", text: "1.1 总体战略目标与愿景承接" },
        { kind: "heading", text: "补充说明（企业录入，不改动定版数字）", entered: true },
        { kind: "text", text: "全年聚焦车用气", entered: true },
        { kind: "heading", text: "1.2 本年度关键 KPI" },
        { kind: "heading", text: "1.3 本年度关键项目清单及关键节点" },
      ])
    );
    expect(book.chapters[1].blocks).toEqual([{ kind: "text", text: "（待企业填写）", entered: true }]);
    const kpi = book.chapters[3].blocks[1];
    expect(kpi).toEqual({ kind: "table", headers: ["战略主题", "战略 KPI", "本年度目标"], rows: [["做强车用气", "车用气销量", "1100 万方"]] });
    const resources = book.chapters[5].blocks[0];
    expect(resources.kind === "table" && resources.rows[0]).toEqual(["物流车队客户拓展", "财务", "80 万元", "", "30 万元（重大）", "", ""]);
  });

  it("summarises chapter one from the locked tables instead of entered text", () => {
    const book = buildCompanyPlanBook({ enterprise: "DZ", year: 2026, text: emptyPlanBookText(), upstream });
    expect(book.chapters[0].source).toBe("same");
    const summary = book.chapters[0].blocks[1];
    expect(summary.kind === "text" && !summary.entered && summary.text.split("\n")).toEqual([
      "2026 年战略 KPI 目标 1 项：车用气销量 1100 万方",
      "靠 2 个关键项目做成（物流车队客户拓展、站点审批）",
      "资源缺口 1 项，其中重大缺口 1 项",
    ]);
    expect(book.chapters[0].blocks.some((b) => b.kind === "heading" && b.text.startsWith("补充说明"))).toBe(false);
    const dept = buildDeptPlanBook({ enterprise: "DZ", year: 2026, dept: { deptId: "org-2", deptName: "燃气运营部" }, text: emptyPlanBookText(), upstream });
    const line = dept.chapters[0].blocks[1];
    expect(line.kind === "text" && line.text).toContain("靠 1 个牵头项目做成（物流车队客户拓展）");
  });

  it("does not repeat a goal's value when its name already states it", () => {
    const goals = (task: string, value: string, unit: string) => ({
      ...upstream,
      "S2-03": { ...(upstream["S2-03"] ?? {}), targets: { goals: [{ id: "g1", task, metric: "", value, unit }] } },
    });
    const line = (task: string, value: string, unit: string) =>
      companySummary(goals(task, value, unit) as never, 2026).find((l) => l.startsWith("公司级年度目标")) ?? "";
    expect(line("重大安全事故为零", "0", "起")).toBe("公司级年度目标 1 项：重大安全事故为零");
    expect(line("营业收入达到 20.5 亿元", "20.5", "亿元")).toBe("公司级年度目标 1 项：营业收入达到 20.5 亿元");
    expect(line("新增售气量", "6000", "万方")).toBe("公司级年度目标 1 项：新增售气量 6000 万方");
  });

  it("adds up project budgets only when every amount shares a unit", () => {
    expect(sumAmounts(["80 万元", "30.5 万元"])).toBe("110.5 万元");
    expect(sumAmounts(["80 万元", "30 元"])).toBeNull();
    expect(sumAmounts(["80 万元", ""])).toBeNull();
    expect(sumAmounts([])).toBeNull();
  });

  it("puts the strategy house and map into chapter one as figures", () => {
    const plain = buildCompanyPlanBook({ enterprise: "DZ", year: 2026, text: emptyPlanBookText(), upstream });
    expect(plain.chapters[0].blocks.some((b) => b.kind === "figure")).toBe(false);
    const book = buildCompanyPlanBook({
      enterprise: "DZ",
      year: 2026,
      text: emptyPlanBookText(),
      upstream: {
        ...upstream,
        "S1-01": { ...emptyStrategyContent("house"), mission: "让能源更清洁" },
        "S1-02": { objectives: [{ id: "o1", perspective: "financial" as const, title: "营收 10 亿", note: "" }], links: [] },
      },
    });
    const figures = book.chapters[0].blocks.filter((b) => b.kind === "figure");
    expect(figures.map((f) => f.kind === "figure" && f.caption)).toEqual(["图 1-1 战略简约六分法表（S1-01）", "图 1-2 战略地图（S1-02）"]);
    expect(figures[0].kind === "figure" && figures[0].diagram.svg).toContain("让能源更清洁");
    expect(book.chapters[0].blocks.findIndex((b) => b.kind === "figure")).toBeLessThan(book.chapters[0].blocks.findIndex((b) => b.kind === "heading" && b.text.startsWith("1.2")));
  });

  it("keeps a department book to what that department leads", () => {
    const book = buildDeptPlanBook({ enterprise: "DZ测试燃气", year: 2026, dept: { deptId: "org-1", deptName: "战略发展部" }, text: emptyPlanBookText(), upstream });
    expect(book.title).toBe("DZ测试燃气 战略发展部 2026 年度经营计划书");
    const undertaking = book.chapters[3].blocks[1];
    expect(undertaking.kind === "table" && undertaking.rows.map((r) => r[2])).toEqual(["站点审批"]);
    const projects = book.chapters[4].blocks[0];
    expect(projects.kind === "table" && projects.rows.map((r) => r[0])).toEqual(["2026STRP001"]);
    expect(book.chapters[5].blocks).toEqual([{ kind: "note", text: "本部门牵头项目没有资源匹配结果" }]);
  });
});
