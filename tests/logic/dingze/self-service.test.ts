import { describe, expect, it } from "vitest";

import { canPerform, missingSelfReview, nextAction, nextStatus, selfReviewChecklist } from "@dingze/shared";

const lead = { projectRole: "ent_lead" as const, isConsultAdmin: false };

describe("自助 projects", () => {
  it("replace consultant review with the enterprise lead's 自查复核 and let them reopen", () => {
    expect(canPerform("selfReview", { ...lead, service: "self" })).toBe(true);
    expect(canPerform("selfReview", lead)).toBe(false);
    expect(canPerform("submitReview", { ...lead, service: "self" })).toBe(false);
    expect(canPerform("approve", { projectRole: "lead_consultant", isConsultAdmin: false, service: "self" })).toBe(false);
    expect(canPerform("reopen", { ...lead, service: "self" })).toBe(true);
    expect(canPerform("reopen", lead)).toBe(false);
    expect(nextStatus("selfReview", "step_done", { ...lead, service: "self" })).toBe("pending_confirm");
    expect(canPerform("confirm", { projectRole: "dept_head", isConsultAdmin: false, service: "self" })).toBe(false);
  });

  it("builds the checklist from the book's gate, pitfalls and open suggestions", () => {
    const items = selfReviewChecklist("S2-04", ["“二期扩容”的 C 偏多"]);
    expect(items.map((i) => i.kind)).toEqual(["gate", "gate", "pitfall", "pitfall", "warning"]);
    expect(items[0].text).toBe("每行唯一 A ＋ 明确 R");
    const answers = items.map((i, n) => ({ key: i.key, ok: n !== 4, note: "" }));
    expect(missingSelfReview(items, answers).map((i) => i.kind)).toEqual(["warning"]);
    answers[4].note = "二期扩容涉及部门多，C 多是有意的";
    expect(missingSelfReview(items, answers)).toEqual([]);
  });

  it("points the enterprise lead to 自查复核 instead of 提交顾问审", () => {
    const steps = [{ code: "S1-01", status: "step_done" as const, stale: false, unlocked: true }];
    expect(nextAction(steps, "ent_lead", "self").label).toBe("自查复核：" + nextAction(steps, "ent_lead", "self").label.split("：")[1]);
    expect(nextAction(steps, "ent_lead").label.startsWith("提交顾问审")).toBe(true);
  });
});
