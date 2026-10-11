import { describe, expect, it } from "vitest";

import {
  ARTIFACTS,
  type Actor,
  LifecycleError,
  type StateMap,
  getArtifactDef,
  isStageOpen,
  nextStatus,
  staleTargets,
  unlockInfo,
} from "@dingze/shared";

const lead: Actor = { projectRole: "ent_lead", isConsultAdmin: false };
const dept: Actor = { projectRole: "dept_head", isConsultAdmin: false };
const member: Actor = { projectRole: "member", isConsultAdmin: false };
const consultant: Actor = { projectRole: "lead_consultant", isConsultAdmin: false };
const coConsultant: Actor = { projectRole: "co_consultant", isConsultAdmin: false };
const admin: Actor = { projectRole: null, isConsultAdmin: true };

const lockedStage = (stage: "strategy" | "goal"): StateMap =>
  Object.fromEntries(
    ARTIFACTS.filter((a) => a.stage === stage).map((a) => [a.code, { status: "locked" as const }])
  );

describe("artifact lifecycle", () => {
  it("walks the normal path from draft to locked", () => {
    let status = nextStatus("save", "not_started", member);
    expect(status).toBe("in_progress");
    status = nextStatus("stepDone", status, dept);
    expect(status).toBe("step_done");
    status = nextStatus("submitReview", status, lead);
    expect(status).toBe("in_review");
    status = nextStatus("approve", status, consultant);
    expect(status).toBe("pending_confirm");
    status = nextStatus("confirm", status, lead);
    expect(status).toBe("locked");
  });

  it("only lets the enterprise project lead confirm", () => {
    expect(() => nextStatus("confirm", "pending_confirm", dept)).toThrow(LifecycleError);
    expect(() => nextStatus("confirm", "pending_confirm", consultant)).toThrow(LifecycleError);
  });

  it("does not let members finish a step or co-consultants approve", () => {
    expect(() => nextStatus("stepDone", "in_progress", member)).toThrow(/当前角色/);
    expect(() => nextStatus("approve", "in_review", coConsultant)).toThrow(/当前角色/);
  });

  it("refuses edits to a locked artifact until it is reopened with a reason", () => {
    expect(() => nextStatus("save", "locked", lead)).toThrow(/已定版/);
    expect(() => nextStatus("reopen", "locked", consultant)).toThrow(/原因/);
    expect(nextStatus("reopen", "locked", consultant, "质询后调整目标")).toBe("in_progress");
  });

  it("invalidates earlier confirmation when the enterprise edits again", () => {
    expect(nextStatus("save", "pending_confirm", lead)).toBe("in_progress");
    expect(nextStatus("save", "step_done", member)).toBe("in_progress");
  });

  it("keeps the review open while the consultant revises", () => {
    expect(nextStatus("save", "in_review", consultant)).toBe("in_review");
  });

  it("lets the consulting admin force a transition only with a reason", () => {
    expect(() => nextStatus("forceLock", "in_review", admin)).toThrow(/原因/);
    expect(nextStatus("forceLock", "in_review", admin, "训练营现场统一定版")).toBe("locked");
    expect(() => nextStatus("forceLock", "in_review", consultant, "x")).toThrow(/当前角色/);
  });
});

describe("unlocking", () => {
  it("opens the first table of the first stage only", () => {
    expect(unlockInfo(getArtifactDef("S1-01"), {}).unlocked).toBe(true);
    const s102 = unlockInfo(getArtifactDef("S1-02"), {});
    expect(s102.unlocked).toBe(false);
    expect(s102.waitingFor).toContain("S1-01");
  });

  it("unlocks the next table once the previous one reaches step done", () => {
    const states: StateMap = { "S1-01": { status: "step_done" } };
    expect(unlockInfo(getArtifactDef("S1-02"), states).unlocked).toBe(true);
  });

  it("does not let optional P1 worksheets block the strategy KPI table", () => {
    const states: StateMap = {
      "S1-01": { status: "locked" },
      "S1-02": { status: "locked" },
      "S1-03": { status: "step_done" },
    };
    expect(unlockInfo(getArtifactDef("S1-06"), states).unlocked).toBe(true);
    expect(unlockInfo(getArtifactDef("S1-05"), states).unlocked).toBe(false);
  });

  it("opens S2-03 (定目标) and S2-01 with the stage, then key projects and RACI together after S2-03", () => {
    const open: StateMap = lockedStage("strategy");
    expect(unlockInfo(getArtifactDef("S2-03"), open).unlocked).toBe(true);
    expect(unlockInfo(getArtifactDef("S2-01"), open).unlocked).toBe(true);
    expect(unlockInfo(getArtifactDef("S2-08"), open).unlocked).toBe(false);
    const states: StateMap = { ...lockedStage("strategy"), "S2-01": { status: "step_done" }, "S2-03": { status: "step_done" } };
    expect(unlockInfo(getArtifactDef("S2-08"), states).unlocked).toBe(true);
    expect(unlockInfo(getArtifactDef("S2-04"), states).unlocked).toBe(true);
    expect(unlockInfo(getArtifactDef("S2-05"), states).unlocked).toBe(false);
  });

  it("opens the next stage only after every P0 artifact is locked", () => {
    const states = lockedStage("strategy");
    expect(isStageOpen("goal", states)).toBe(true);
    states["S1-07"] = { status: "pending_confirm" };
    expect(isStageOpen("goal", states)).toBe(false);
    expect(unlockInfo(getArtifactDef("S2-03"), states).waitingFor).toContain("上一阶段");
  });

  it("keeps downstream tables open while a completed table is reopened", () => {
    const states: StateMap = { "S1-01": { status: "in_progress", everCompleted: true } };
    expect(unlockInfo(getArtifactDef("S1-02"), states).unlocked).toBe(true);
  });

  it("lets a consultant step exception stand in for step done", () => {
    const states: StateMap = { "S1-01": { status: "in_progress", exception: true } };
    expect(unlockInfo(getArtifactDef("S1-02"), states).unlocked).toBe(true);
  });

  it("marks started downstream artifacts as affected by an upstream change", () => {
    const states: StateMap = {
      "S1-01": { status: "locked" },
      "S1-02": { status: "in_progress" },
      "S1-03": { status: "not_started" },
    };
    expect(staleTargets("S1-01", states)).toEqual(["S1-02"]);
  });
});

describe("附录 B numbering", () => {
  it("lists 24 deliverables with unique numbers and no method worksheets", async () => {
    const { SPEC_ITEMS, ARTIFACTS } = await import("@dingze/shared");
    const ids = SPEC_ITEMS.map((i) => i.specId);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    expect(ids).toContain("S2-02");
    expect(SPEC_ITEMS.find((i) => i.specId === "S2-02")).toMatchObject({ kind: "derived" });
    expect(SPEC_ITEMS.find((i) => i.specId === "S3-09")).toMatchObject({ kind: "out" });
    const tables = ARTIFACTS.filter((a) => a.priority !== "method");
    expect(new Set(tables.map((a) => a.specId)).size).toBe(tables.length);
    expect(tables.every((a) => a.code === a.specId)).toBe(true);
  });
});

describe("step exceptions", () => {
  it("let an incomplete table move on but never skip the checks at review or 定版", async () => {
    const { validationApplies } = await import("@dingze/shared");
    expect(validationApplies("stepDone", true)).toBe(false);
    expect(validationApplies("stepDone", false)).toBe(true);
    expect(validationApplies("approve", true)).toBe(true);
    expect(validationApplies("confirm", true)).toBe(true);
    expect(validationApplies("forceLock", true)).toBe(true);
    expect(validationApplies("save", false)).toBe(false);
  });
});
