import { expect, it } from "vitest";

import { ENTERPRISE_PROJECT_ROLES, canImportInto, importBasis, importBlocker } from "@dingze/shared";

// 企业自建项目与从已有项目带入（2026-10-16 甲方确认）。
it("takes the locked version when there is one, else the latest draft", () => {
  expect(importBasis({ code: "S1-01", status: "in_progress", currentRev: 6, lockedRev: 4 })).toEqual({ rev: 4, locked: true, label: "已定版 v4" });
  expect(importBasis({ code: "S1-01", status: "in_progress", currentRev: 3, lockedRev: null })).toEqual({ rev: 3, locked: false, label: "草稿 v3" });
});

it("only brings content into tables that have not gone to review", () => {
  const src = { code: "S2-03", status: "locked" as const, currentRev: 5, lockedRev: 5 };
  expect(importBlocker("S2-03", src, undefined)).toBeNull();
  expect(importBlocker("S2-03", src, "not_started")).toBeNull();
  expect(importBlocker("S2-03", src, "in_progress")).toBeNull();
  expect(importBlocker("S2-03", src, "step_done")).toMatch(/不能带入/);
  expect(importBlocker("S2-03", src, "locked")).toMatch(/不能带入/);
  expect(importBlocker("S2-03", { ...src, currentRev: 0, lockedRev: null }, undefined)).toMatch(/还没有内容/);
  expect(importBlocker("X-99", src, undefined)).toBe("未知的成果编号");
});

it("only the enterprise project lead (or ops) triggers an import", () => {
  expect(canImportInto("ent_lead", false)).toBe(true);
  expect(canImportInto("dept_head", false)).toBe(false);
  expect(canImportInto("lead_consultant", false)).toBe(false);
  expect(canImportInto(null, true)).toBe(true);
});

it("enterprise admins assign enterprise roles only", () => {
  expect(ENTERPRISE_PROJECT_ROLES).toEqual(["ent_lead", "dept_head", "member", "readonly"]);
});
