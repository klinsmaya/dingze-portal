import { describe, expect, it } from "vitest";

import { ATTACHMENT_PROMPT_CHARS, attachmentPrompt, canManageLibrary } from "@dingze/shared";

describe("资料库权限", () => {
  it("企业项目负责人、咨询师、咨询管理员能管资料库，普通员工不能", () => {
    expect(canManageLibrary("ent_lead", false)).toBe(true);
    expect(canManageLibrary("lead_consultant", false)).toBe(true);
    expect(canManageLibrary("co_consultant", false)).toBe(true);
    expect(canManageLibrary(null, true)).toBe(true);
    expect(canManageLibrary("member", false)).toBe(false);
    expect(canManageLibrary("dept_head", false)).toBe(false);
    expect(canManageLibrary("readonly", false)).toBe(false);
    expect(canManageLibrary(null, false)).toBe(false);
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
