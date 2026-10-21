import { describe, expect, it } from "vitest";

import { parseOrgTable } from "@/lib/dingze/org-units";

describe("parseOrgTable", () => {
  it("reads 名称 | 上级 | 类型 | 负责人 | 职责 with parents first", () => {
    const text = ["名称\t上级\t类型\t负责人\t职责", "调度中心\t燃气运营部\t团队\t刘主管\t24 小时调度", "燃气运营部\t\t部门\t王经理\t输配运行、调度、巡检", "市场营销部"].join("\n");
    const { rows, problems } = parseOrgTable(text);
    expect(rows.map((r) => r.name)).toEqual(["燃气运营部", "调度中心", "市场营销部"]);
    expect(rows[1]).toMatchObject({ parent: "燃气运营部", kind: "team", head: "刘主管", duty: "24 小时调度" });
    expect(problems).toEqual([]);
  });

  it("reports duplicates and loops instead of failing", () => {
    const { rows, problems } = parseOrgTable("甲\t乙\n乙\t甲\n甲\t");
    expect(rows.map((r) => r.name).sort()).toEqual(["乙", "甲"]);
    expect(problems.join("；")).toContain("重复");
    expect(problems.join("；")).toContain("绕成了圈");
  });
});
