import { describe, expect, it } from "vitest";

import { appendOrgNotice, describeOrgChange } from "@dingze/shared";

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
