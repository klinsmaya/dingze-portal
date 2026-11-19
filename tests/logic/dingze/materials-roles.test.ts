import { describe, expect, it } from "vitest";

import { ATTACHMENT_PROMPT_CHARS, attachmentPrompt, canAccessMaterialsPage, canManageLibrary, type LibraryActor } from "@dingze/shared";

describe("资料库权限", () => {
  it.each<[string, LibraryActor & { isOps: boolean }, boolean, boolean]>([
    ["企业项目负责人", { projectRole: "ent_lead", isConsultAdmin: false, isEntAdmin: false, isOps: false }, true, true],
    ["项目咨询师", { projectRole: "consultant", isConsultAdmin: false, isEntAdmin: false, isOps: false }, true, true],
    ["咨询管理员", { projectRole: null, isConsultAdmin: true, isEntAdmin: false, isOps: false }, true, true],
    ["已入项企业管理员", { projectRole: "member", isConsultAdmin: false, isEntAdmin: true, isOps: false }, true, true],
    ["未入项企业管理员", { projectRole: "readonly", isConsultAdmin: false, isEntAdmin: true, isOps: false }, true, true],
    ["无项目角色企业管理员", { projectRole: null, isConsultAdmin: false, isEntAdmin: true, isOps: false }, true, true],
    ["纯运营", { projectRole: null, isConsultAdmin: false, isEntAdmin: false, isOps: true }, true, false],
    ["只读运营", { projectRole: "readonly", isConsultAdmin: false, isEntAdmin: false, isOps: true }, true, false],
    ["已入项运营", { projectRole: "member", isConsultAdmin: false, isEntAdmin: false, isOps: true }, true, false],
    ["已入项员工", { projectRole: "member", isConsultAdmin: false, isEntAdmin: false, isOps: false }, false, false],
    ["未入项员工", { projectRole: "readonly", isConsultAdmin: false, isEntAdmin: false, isOps: false }, false, false],
    ["无角色访问者", { projectRole: undefined, isConsultAdmin: false, isEntAdmin: false, isOps: false }, false, false],
    ["运营兼企业管理员", { projectRole: "readonly", isConsultAdmin: false, isEntAdmin: true, isOps: true }, true, true],
    ["运营兼咨询师", { projectRole: "consultant", isConsultAdmin: false, isEntAdmin: false, isOps: true }, true, true],
  ])("%s 的进入与管理权限分开", (_name, actor, access, manage) => {
    expect(canAccessMaterialsPage(actor)).toBe(access);
    expect(canManageLibrary(actor)).toBe(manage);
  });
});

describe("attachmentPrompt", () => {
  it("puts the text after the ask and caps it", () => {
    const text = "甲".repeat(ATTACHMENT_PROMPT_CHARS + 10);
    const prompt = attachmentPrompt({ fileName: "复盘.docx", table: "战略 KPI 表", text });
    expect(prompt).toContain("《复盘.docx》");
    expect(prompt).toContain("《战略 KPI 表》");
    expect(prompt).toContain(`只放前 ${ATTACHMENT_PROMPT_CHARS} 字`);
    expect(prompt.length).toBeLessThan(ATTACHMENT_PROMPT_CHARS + 300);
  });
  it("asks the model to read pictures when there is no text", () => {
    expect(attachmentPrompt({ fileName: "地图.png", table: "战略地图", text: "", pages: 1 })).toContain("附件是图片");
    expect(attachmentPrompt({ fileName: "扫描.pdf", table: "战略地图", text: "  ", pages: 3 })).toContain("共 3 页");
  });
});
