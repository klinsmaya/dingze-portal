import { describe, expect, it } from "vitest";

import { orgSubtreeIds, parseOrgTable } from "@/lib/dingze/org-units";

describe("parseOrgTable", () => {
  it("reads 名称 | 上级 | 类型 | 负责人 | 职责 with parents first", () => {
    const text = ["名称\t上级\t类型\t负责人\t职责", "调度中心\t燃气运营部\t团队\t刘主管\t24 小时调度", "燃气运营部\t\t部门\t王经理\t输配运行、调度、巡检", "市场营销部"].join("\n");
    const { rows, problems } = parseOrgTable(text);
    expect(rows.map((r) => r.name)).toEqual(["燃气运营部", "调度中心", "市场营销部"]);
    expect(rows[1]).toMatchObject({ parent: "燃气运营部", kind: "team", head: "刘主管", duty: "24 小时调度" });
    expect(problems).toEqual([]);
  });

  it("takes the enterprise's own level names in the 类型 column", () => {
    const { rows } = parseOrgTable(["瀚川集团\t\t集团", "华东事业部\t瀚川集团\t事业部", "运营中心\t华东事业部\t中心", "调度班\t运营中心\t班组", "财务部\t瀚川集团"].join("\n"));
    expect(rows.map((r) => [r.name, r.kind, r.kindName])).toEqual([
      ["瀚川集团", "company", "集团"],
      ["华东事业部", "department", "事业部"],
      ["运营中心", "department", "中心"],
      ["调度班", "team", "班组"],
      ["财务部", "department", null],
    ]);
  });

  it("reports duplicates and loops instead of failing", () => {
    const { rows, problems } = parseOrgTable("甲\t乙\n乙\t甲\n甲\t");
    expect(rows.map((r) => r.name).sort()).toEqual(["乙", "甲"]);
    expect(problems.join("；")).toContain("重复");
    expect(problems.join("；")).toContain("绕成了圈");
  });
});

describe("orgSubtreeIds", () => {
  it("collects a unit and everything under it, however deep", () => {
    const units = [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
      { id: 4, parentId: 3 },
      { id: 5, parentId: 1 },
    ];
    expect([...orgSubtreeIds(units, 2)].sort()).toEqual([2, 3, 4]);
    expect([...orgSubtreeIds(units, 5)]).toEqual([5]);
  });
});
