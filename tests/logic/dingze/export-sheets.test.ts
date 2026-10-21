import { describe, expect, it } from "vitest";

import { emptyCharter, emptyStrategyContent, resourceRow, wbsPackage } from "@dingze/shared";

import { artifactSheets } from "@/lib/dingze/export/sheets";
import { exportFileName } from "@/lib/dingze/export/xlsx";

describe("artifact export sheets", () => {
  it("merges the strategy cell over its tactics, as in 表 2-7", () => {
    const [sheet] = artifactSheets(
      "S1-03",
      {
        strategies: [
          { id: "s1", statement: "做强车用气", tactics: [{ id: "t1", text: "加密站点", path: "" }, { id: "t2", text: "拓展车队", path: "" }] },
          { id: "s2", statement: "培育工业点供", tactics: [{ id: "t3", text: "开发园区客户", path: "" }] },
        ],
        levelNote: "",
      },
      { "S1-01": { ...emptyStrategyContent("house"), mission: "让城市用上清洁能源" } }
    );
    expect(sheet.rows.slice(2)).toEqual([
      ["做强车用气", "加密站点", ""],
      ["做强车用气", "拓展车队", ""],
      ["培育工业点供", "开发园区客户", ""],
    ]);
    expect(sheet.merges).toContainEqual([2, 0, 3, 0]);
    expect(sheet.rows[0][0]).toBe("使命：让城市用上清洁能源");
  });

  it("keeps year values numeric when they are numbers and text otherwise", () => {
    const [sheet] = artifactSheets("S1-07", {
      years: [2026, 2027],
      rows: [{ id: "y", kpiId: null, theme: "", name: "售气量", unit: "万方", values: { "2026": "1100", "2027": "待补" }, baseline: "", benchmark: "≥1600", challenge: "1250" }],
    });
    expect(sheet.columns.map((c) => c.header)).toEqual(["战略主题 / 要点", "战略 KPI", "单位", "2026 年", "2027 年", "基准值", "标杆值", "挑战值"]);
    expect(sheet.rows[0]).toEqual(["", "售气量", "万方", 1100, "待补", "", "≥1600", 1250]);
  });

  it("exports 六分法 for S1-01, and the house only when it was filled in", () => {
    expect(artifactSheets("S1-01", emptyStrategyContent("house")).map((s) => s.name)).toEqual(["战略简约六分法"]);
    expect(artifactSheets("S1-01", { ...emptyStrategyContent("sixfold"), values: "客户第一" }).map((s) => s.name)).toEqual(["战略简约六分法", "战略屋"]);
  });

  it("has nothing to export for unknown codes or empty payloads", () => {
    expect(artifactSheets("S3-07", { a: 1 })).toEqual([]);
    expect(artifactSheets("S1-02", null)).toEqual([]);
  });

  it("builds file names without characters Windows rejects", () => {
    expect(exportFileName("DZ/测试", "S1-07", "战略 KPI 3—5 年年度分解表", 3)).toBe("DZ_测试-S1-07-战略 KPI 3—5 年年度分解表-v3.xlsx");
  });
});

describe("path system export (表 3-9 / 表 3-10)", () => {
  const goals = { year: 2026, strategyReview: "", lastPeriodIssues: "", goals: [{ id: "g1", purpose: "", task: "提升售气量", metric: "售气量", value: "1100 万方", unit: "", perspective: "financial" as const, sourceRowId: null }] };
  const node = (id: string, parentId: string | null, level: number, path: string, value: string, perspective?: "financial" | "customer") => ({
    id,
    parentId,
    goalId: parentId ? null : "g1",
    level,
    path,
    metric: "销量",
    value,
    amount: null,
    unit: "",
    perspective,
  });
  const system = {
    nodes: [
      node("a", null, 1, "车用气增收", "800", "financial"),
      node("b", "a", 2, "物流车队", "500"),
      node("c", "a", 2, "网约车", "300"),
      node("d", null, 1, "工业点供", "300", "customer"),
    ],
  };

  it("puts one row per leaf with goal and parent cells merged over their leaves", () => {
    const [targetSheet, tree, decode] = artifactSheets("S2-03", { ...system, targets: goals });
    expect(targetSheet.name).toContain("年度目标");
    expect(tree.columns.map((c) => c.header)).toEqual(["目标", "目标值", "一级路径", "衡量指标", "指标值", "二级路径", "衡量指标", "指标值"]);
    expect(tree.rows).toEqual([
      ["提升售气量", "售气量 1100 万方", "车用气增收", "销量", 800, "物流车队", "销量", 500],
      [null, null, null, null, null, "网约车", "销量", 300],
      [null, null, "工业点供", "销量", 300, null, null, null],
    ]);
    expect(tree.merges).toEqual(expect.arrayContaining([[0, 2, 1, 2], [0, 0, 2, 0], [0, 1, 2, 1]]));
    expect(decode.rows.map((r) => r[0])).toEqual(["财务", null, "客户"]);
  });
});

describe("S3 action sheets", () => {
  const set = {
    screening: [],
    charters: [
      emptyCharter({
        id: "pc1",
        code: "2026OPSP001",
        name: "物流车队拓展",
        wbs: [
          wbsPackage({ id: "w1", name: "客户开发" }),
          wbsPackage({ id: "w2", parentId: "w1", level: 2, name: "名单梳理" }),
          wbsPackage({ id: "w3", name: "合同签订", dependsOn: ["w1"] }),
        ],
      }),
    ],
  };

  it("numbers WBS packages by outline and resolves dependencies to those numbers", () => {
    const [, , wbs] = artifactSheets("S3-02", set);
    expect(wbs.rows.map((r) => [r[2], r[3], r[7]])).toEqual([
      ["1", "客户开发", ""],
      ["1.1", "名单梳理", ""],
      ["2", "合同签订", "1"],
    ]);
  });

  it("writes a declared-unneeded resource category as 无 and labels rows by charter", () => {
    const match = { rows: [resourceRow({ charterId: "pc1", category: "it", none: true }), resourceRow({ category: "finance", need: "50 万", major: true })] };
    const [s] = artifactSheets("S3-06", match, { "S3-02": set });
    expect(s.rows[0].slice(0, 3)).toEqual(["2026OPSP001 物流车队拓展", "信息化（信息化 / 数据）", "无"]);
    expect(s.rows[1][0]).toBe("未关联项目");
    expect(s.rows[1][7]).toBe("是");
  });
});
