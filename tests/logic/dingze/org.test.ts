import { describe, expect, it } from "vitest";

import { appendOrgNotice, describeOrgChange, orgKindFromName, orgKindLabel } from "@dingze/shared";

describe("organisation changes", () => {
  it("describes what a table would care about", () => {
    expect(describeOrgChange(null, { name: "客服中心", kind: "department" })).toBe("新增部门「客服中心」");
    expect(describeOrgChange({ name: "信息中心" }, null)).toBe("删除「信息中心」");
    expect(describeOrgChange({ name: "市场部", headId: 1, duty: "开发客户" }, { name: "市场营销部", headId: 2, duty: "开发客户" })).toBe("「市场部」改名为「市场营销部」；「市场营销部」负责人变更");
    expect(describeOrgChange({ name: "财务部", duty: "核算" }, { name: "财务部", duty: "核算、预算" })).toBe("「财务部」职责调整");
    expect(describeOrgChange({ name: "财务部", headId: null, headName: "" }, { name: "财务部", headId: null, headName: null })).toBeNull();
  });

  it("keeps the newest notices first", () => {
    let notice = "";
    for (let i = 1; i <= 7; i++) notice = appendOrgNotice(notice, `变更 ${i}`, "10-12");
    expect(notice.split("\n")).toHaveLength(5);
    expect(notice.split("\n")[0]).toBe("10-12 变更 7");
  });
});

describe("组织层级：企业自己的叫法", () => {
  it("keeps the built-in names as they are", () => {
    expect(orgKindFromName("公司")).toEqual({ kind: "company", kindName: null });
    expect(orgKindFromName("部门")).toEqual({ kind: "department", kindName: null });
    expect(orgKindFromName(" 团队 ")).toEqual({ kind: "team", kindName: null });
    expect(orgKindFromName("team")).toEqual({ kind: "team", kindName: null });
    expect(orgKindFromName("")).toEqual({ kind: "department", kindName: null });
    expect(orgKindFromName(undefined)).toEqual({ kind: "department", kindName: null });
  });

  it("records a custom level name and what it is used as", () => {
    expect(orgKindFromName("事业部")).toEqual({ kind: "department", kindName: "事业部" });
    expect(orgKindFromName("科室")).toEqual({ kind: "department", kindName: "科室" });
    expect(orgKindFromName("集团")).toEqual({ kind: "company", kindName: "集团" });
    expect(orgKindFromName("班组")).toEqual({ kind: "team", kindName: "班组" });
    expect(orgKindFromName("很".repeat(30)).kindName).toHaveLength(20);
  });

  it("shows the custom name first, and round-trips through the editor", () => {
    expect(orgKindLabel({ kind: "department", kindName: "事业部" })).toBe("事业部");
    expect(orgKindLabel({ kind: "team" })).toBe("团队");
    expect(orgKindLabel({ kind: null })).toBe("部门");
    for (const word of ["集团", "公司", "事业部", "中心", "部门", "科室", "团队", "班组"]) expect(orgKindLabel(orgKindFromName(word))).toBe(word);
  });

  it("names a new unit by its own level name in the change notice", () => {
    expect(describeOrgChange(null, { name: "华东事业部", kind: "department", kindName: "事业部" })).toBe("新增事业部「华东事业部」");
    expect(describeOrgChange(null, { name: "调度班", kind: "team" })).toBe("新增团队「调度班」");
  });
});
