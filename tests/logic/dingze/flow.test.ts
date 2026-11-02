import { describe, expect, it } from "vitest";

import { ARTIFACTS, type ArtifactStatus } from "@dingze/shared";

import type { ArtifactOverview } from "@/lib/dingze/api";
import { flowSteps } from "@/lib/dingze/flow";
import { stageEntryCode, stageProgress } from "@/lib/dingze/progress";
import { SAMPLE_CODES } from "@/lib/dingze/sample";
import { samplePayloads } from "@/lib/dingze/sample-data";

const make = (overrides: Record<string, Partial<ArtifactOverview>> = {}): ArtifactOverview[] =>
  ARTIFACTS.map((a) => ({
    code: a.code,
    status: "not_started" as ArtifactStatus,
    stale: false,
    staleReason: null,
    exception: false,
    currentRev: 0,
    updatedAt: null,
    unlock: { unlocked: a.stage === "strategy" && (a.code === "S1-01" || a.priority === "method") },
    ...overrides[a.code],
  }));

const lockStage = (stage: string) =>
  Object.fromEntries(ARTIFACTS.filter((a) => a.stage === stage).map((a) => [a.code, { status: "locked" as ArtifactStatus, unlock: { unlocked: true } }]));

const flow = (artifacts: ArtifactOverview[], materialsReady = false) =>
  flowSteps({ stages: stageProgress(artifacts), materialsReady, materialCount: materialsReady ? 2 : 0, started: artifacts.some((a) => a.status !== "not_started") });

describe("customer flow", () => {
  it("starts a fresh project at 上传资料, with 战略解码 open and the rest locked", () => {
    const steps = flow(make());
    expect(steps.map((s) => s.label)).toEqual(["上传资料", "战略解码", "目标分解", "计划制定", "下载成果"]);
    expect(steps.map((s) => s.state)).toEqual(["current", "todo", "locked", "locked", "locked"]);
  });

  it("lets the customer skip materials once they start filling tables", () => {
    const steps = flow(make({ "S1-01": { status: "in_progress", unlock: { unlocked: true } } }));
    expect(steps[0].state).toBe("todo");
    expect(steps[1].state).toBe("current");
  });

  it("moves to 目标分解 once every 战略解码 gate table is 定版", () => {
    const artifacts = make({ ...lockStage("strategy"), "S2-03": { unlock: { unlocked: true } } });
    const steps = flow(artifacts, true);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "locked", "locked"]);
  });

  it("ends at 下载成果 when all three stages are 定版", () => {
    const steps = flow(make({ ...lockStage("strategy"), ...lockStage("goal"), ...lockStage("action") }), true);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "done", "current"]);
  });

  it("sends a stage tab to the first open table that is not 定版 yet", () => {
    expect(stageEntryCode(make(), "strategy")).toBe("S1-01");
    expect(stageEntryCode(make({ "S1-01": { status: "locked", unlock: { unlocked: true } }, "S1-02": { unlock: { unlocked: true } } }), "strategy")).toBe("S1-02");
    // Nothing open yet: the stage's first table, which shows why it is locked.
    expect(stageEntryCode(make(), "goal")).toBe(ARTIFACTS.find((a) => a.stage === "goal" && a.priority !== "method")!.code);
  });
});

describe("sample project", () => {
  it("lists exactly the tables the demo seed has", () => {
    expect(Object.keys(samplePayloads()).sort()).toEqual([...SAMPLE_CODES].sort());
  });
});
