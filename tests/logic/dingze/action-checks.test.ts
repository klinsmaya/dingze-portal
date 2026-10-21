import { describe, expect, it } from "vitest";

import { validateProgressPlan, validateResourceMatch } from "@dingze/shared";

// 验收意见 A07 / A08 的反例。
describe("action-stage checks", () => {
  it("flags a node after the charter end and a verify after production", () => {
    const charters = { screening: [], charters: [{ id: "c1", name: "加气站", end: "2026-11" }] } as never;
    const node = (id: string, time: string, name: string) => ({ id, phase: "", time, name, deliverable: "站点", acceptance: "验收报告", owner: "孙工", status: "todo", dependsOn: [] });
    const plan = { scale: "month", rows: [{ id: "r1", charterId: "c1", name: "加气站", nodes: [node("n1", "2026-09", "4 座投运"), node("n2", "2026-10", "安全验收"), node("n3", "2027-01", "复盘")] }] } as never;
    const msgs = validateProgressPlan(plan, charters).map((i) => i.message);
    expect(msgs.some((m) => m.includes("晚于任务书的结束时间"))).toBe(true);
    expect(msgs.some((m) => m.includes("先投产后验证"))).toBe(true);
  });

  it("checks gap = need − stock when they are numbers in one unit", () => {
    const row = { id: "x", charterId: null, category: "finance", need: "800 万元", stock: "500 万元", gap: "200 万元", approach: "贷款", owner: "财务部", none: false, major: false };
    const msgs = validateResourceMatch({ rows: [row] } as never).map((i) => i.message);
    expect(msgs.some((m) => m.includes("缺口应为 300万元"))).toBe(true);
  });
});
