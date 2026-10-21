import { describe, expect, it } from "vitest";

import { flowLabel, flowPlan } from "@/lib/dingze/flow-plan";

const as = (projectRole: string, service: "guided" | "self" = "guided") => ({ projectRole: projectRole as never, isConsultAdmin: false, service });

describe("表头流程按钮（开营前 UX 改版 F1–F5、F11）", () => {
  it("gives each state one main action", () => {
    expect(flowPlan("in_progress", as("ent_lead")).primary).toBe("stepDone");
    expect(flowPlan("step_done", as("ent_lead")).primary).toBe("submitReview");
    expect(flowPlan("step_done", as("ent_lead", "self")).primary).toBe("selfReview");
    expect(flowPlan("in_review", as("lead_consultant"))).toMatchObject({ primary: "approve", others: ["returnToEdit"] });
    expect(flowPlan("pending_confirm", as("ent_lead"))).toMatchObject({ primary: "confirm", others: ["returnToEdit"] });
  });

  it("lets the enterprise lead reopen a locked table and greys it out for others", () => {
    expect(flowPlan("locked", as("ent_lead")).primary).toBe("reopen");
    expect(flowPlan("locked", as("dept_head"))).toMatchObject({ primary: null, blocked: "reopen" });
  });

  it("shows the enterprise a waiting note while the consultant reviews, with 撤回修改 beside it", () => {
    expect(flowPlan("in_review", as("ent_lead"))).toMatchObject({ primary: null, waiting: "等主咨询师复核", others: ["returnToEdit"] });
    expect(flowLabel("returnToEdit", "in_review", as("ent_lead"))).toBe("撤回修改");
    expect(flowLabel("returnToEdit", "in_review", as("lead_consultant"))).toBe("退回修改");
    expect(flowLabel("returnToEdit", "pending_confirm", as("ent_lead"))).toBe("退回修改");
  });

  it("greys out 确认定版 for everyone but the enterprise lead", () => {
    expect(flowPlan("pending_confirm", as("lead_consultant"))).toMatchObject({ primary: null, blocked: "confirm" });
    expect(flowPlan("pending_confirm", as("member"))).toMatchObject({ primary: null, blocked: "confirm", others: [] });
  });
});
