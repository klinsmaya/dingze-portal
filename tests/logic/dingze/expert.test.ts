import { describe, expect, it } from "vitest";

import { canExpertAct, canRequestExpert } from "@dingze/shared";

const none = { isAdmin: false, isApplicant: false, isExpert: false, projectRole: null };

describe("expert requests", () => {
  it("lets admins assign and experts schedule and answer, in order", () => {
    expect(canExpertAct("assign", "submitted", { ...none, isAdmin: true })).toBe(true);
    expect(canExpertAct("assign", "submitted", { ...none, isApplicant: true, projectRole: "ent_lead" })).toBe(false);
    expect(canExpertAct("schedule", "submitted", { ...none, isExpert: true })).toBe(false);
    expect(canExpertAct("schedule", "accepted", { ...none, isExpert: true })).toBe(true);
    expect(canExpertAct("answer", "scheduled", { ...none, isExpert: true })).toBe(true);
    expect(canExpertAct("answer", "scheduled", { ...none, projectRole: "lead_consultant" })).toBe(false);
    expect(canExpertAct("answer", "closed", { ...none, isAdmin: true })).toBe(false);
  });

  it("lets the applicant or the enterprise lead close an answered request, and the applicant withdraw before", () => {
    expect(canExpertAct("close", "answered", { ...none, projectRole: "ent_lead" })).toBe(true);
    expect(canExpertAct("close", "answered", { ...none, projectRole: "member" })).toBe(false);
    expect(canExpertAct("close", "scheduled", { ...none, isApplicant: true })).toBe(false);
    expect(canExpertAct("cancel", "scheduled", { ...none, isApplicant: true })).toBe(true);
    expect(canExpertAct("cancel", "answered", { ...none, isApplicant: true })).toBe(false);
  });

  it("keeps read-only members from filing", () => {
    expect(canRequestExpert("readonly", false)).toBe(false);
    expect(canRequestExpert("member", false)).toBe(true);
    expect(canRequestExpert(null, true)).toBe(true);
    expect(canRequestExpert(null, false)).toBe(false);
  });
});
