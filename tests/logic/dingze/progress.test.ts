import { describe, expect, it } from "vitest";

import { ARTIFACTS, STAGES, type ArtifactStatus, stageGateCodes } from "@dingze/shared";

import type { ArtifactOverview } from "@/lib/dingze/api";
import { nextStep, stageBlockers, stageProgress, todosFor } from "@/lib/dingze/progress";

const make = (overrides: Record<string, Partial<ArtifactOverview>>): ArtifactOverview[] =>
  ARTIFACTS.map((a) => ({
    code: a.code,
    status: "not_started" as ArtifactStatus,
    stale: false,
    staleReason: null,
    exception: false,
    currentRev: 0,
    updatedAt: null,
    unlock: { unlocked: a.code === "S1-01" || a.priority === "method" && a.stage === "strategy" },
    ...overrides[a.code],
  }));

describe("project progress", () => {
  it("points a new project at the six-part table / strategy house", () => {
    expect(nextStep(make({}))?.code).toBe("S1-01");
  });

  it("moves on once a step is done and skips optional P1 worksheets", () => {
    const artifacts = make({
      "S1-01": { status: "locked" },
      "S1-02": { status: "locked", unlock: { unlocked: true } },
      "S1-03": { status: "step_done", unlock: { unlocked: true } },
      "S1-04": { unlock: { unlocked: true } },
      "S1-06": { unlock: { unlocked: true } },
    });
    expect(nextStep(artifacts)?.code).toBe("S1-06");
  });

  it("counts locked P0 artifacts per stage", () => {
    const [strategy, goal] = stageProgress(make({ "S1-01": { status: "locked" }, "S1-02": { status: "in_review" } }));
    expect(strategy).toMatchObject({ gateTotal: 5, locked: 1, inProgress: 1, open: true, complete: false });
    expect(goal.open).toBe(false);
  });

  it("shows confirmations to the project lead and reviews to consultants", () => {
    const artifacts = make({
      "S1-01": { status: "pending_confirm" },
      "S1-02": { status: "in_review" },
      "S1-03": { status: "in_progress", stale: true, staleReason: "S1-01 有新版本" },
    });
    expect(todosFor(artifacts, "ent_lead").map((t) => t.kind)).toEqual(["confirm", "stale"]);
    expect(todosFor(artifacts, "lead_consultant").map((t) => t.kind)).toEqual(["review", "stale"]);
    expect(todosFor(artifacts, "readonly")).toEqual([]);
  });
});

// 测试反馈 3：点还没开启的阶段，要知道前面哪几张必做表没定版、第一张是哪张。
describe("stageBlockers", () => {
  const [first, second, third] = STAGES.map((s) => s.key);
  const gate1 = stageGateCodes(first);
  const lockAll = (codes: string[]) => Object.fromEntries(codes.map((c) => [c, { status: "locked" as ArtifactStatus }]));

  it("has nothing for the first stage", () => {
    expect(stageBlockers(make({}), first)).toBeNull();
  });

  it("lists the previous stage's 必做 tables that are not 定版, in book order", () => {
    const artifacts = make({ [gate1[0]]: { status: "locked" }, [gate1[1]]: { status: "in_review" } });
    expect(stageBlockers(artifacts, second)).toEqual({ stage: first, codes: gate1.slice(1) });
  });

  it("points the third stage at the earliest stage that is still open work", () => {
    expect(stageBlockers(make({}), third)).toEqual({ stage: first, codes: gate1 });
    const gate2 = stageGateCodes(second);
    expect(stageBlockers(make(lockAll(gate1)), third)).toEqual({ stage: second, codes: gate2 });
  });

  it("is null once everything before the stage is 定版", () => {
    expect(stageBlockers(make(lockAll(gate1)), second)).toBeNull();
  });
});
