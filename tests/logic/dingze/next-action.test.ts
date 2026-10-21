import { describe, expect, it } from "vitest";

import { ARTIFACTS, type ArtifactProgress, collaborationStatus, nextAction, stageGateCodes } from "@dingze/shared";

const all = (patch: Record<string, Partial<ArtifactProgress>> = {}): ArtifactProgress[] =>
  ARTIFACTS.map((a) => ({ code: a.code, status: "not_started", stale: false, unlocked: a.stage === "strategy", lastEvent: null, ...patch[a.code] }));

describe("next action", () => {
  it("tells a new enterprise lead which table to start, by its plain name", () => {
    const a = nextAction(all(), "ent_lead");
    expect(a).toMatchObject({ kind: "fill", code: "S1-01" });
    expect(a.label).toBe("开始填：战略一页纸（六分法 / 战略屋）");
  });

  it("puts 定版 first for the enterprise lead and review first for the lead consultant", () => {
    const steps = all({ "S1-01": { status: "pending_confirm" }, "S1-02": { status: "in_review" } });
    expect(nextAction(steps, "ent_lead")).toMatchObject({ kind: "confirm", code: "S1-01" });
    expect(nextAction(steps, "lead_consultant")).toMatchObject({ kind: "review", code: "S1-02" });
  });

  it("brings a returned table back with the reason", () => {
    const steps = all({ "S1-01": { status: "in_progress", lastEvent: { action: "returnToEdit", reason: "战略目标没写年份" } } });
    const a = nextAction(steps, "dept_head");
    expect(a).toMatchObject({ kind: "returned", code: "S1-01" });
    expect(a.hint).toContain("战略目标没写年份");
  });

  it("says the consultant is reviewing when nothing is left to fill", () => {
    const steps = all({ "S1-01": { status: "in_review" } }).map((s) => (s.code === "S1-01" ? s : { ...s, unlocked: false }));
    expect(nextAction(steps, "ent_lead")).toMatchObject({ kind: "waiting", code: "S1-01" });
  });

  it("sends a finished project to the plan book export and read-only members to the progress view", () => {
    const locked = Object.fromEntries(["strategy", "goal", "action"].flatMap((s) => stageGateCodes(s as "strategy")).map((c) => [c, { status: "locked" as const }]));
    expect(nextAction(all(locked), "ent_lead")).toMatchObject({ kind: "deliver", code: null });
    expect(nextAction(all(), "readonly")).toMatchObject({ kind: "view" });
  });
});

describe("collaboration status", () => {
  const base: ArtifactProgress = { code: "S1-01", status: "in_review", stale: false, unlocked: true, lastEvent: null };
  it("shows enterprise members where the table is", () => {
    expect(collaborationStatus(base, "ent_lead")?.text).toBe("等主咨询师复核，审完会通知你");
    expect(collaborationStatus({ ...base, status: "pending_confirm" }, "ent_lead")?.text).toBe("顾问已审过，待你定版");
    // Who moved it there, and when.
    expect(collaborationStatus({ ...base, lastEvent: { action: "submitReview", by: "孙经理", at: "2026-10-11T08:00:00Z" } }, "ent_lead")?.text).toBe(
      "等主咨询师复核（孙经理 10-11 提交），审完会通知你",
    );
    expect(collaborationStatus({ ...base, status: "in_progress", lastEvent: { action: "returnToEdit", reason: "补年份" } }, "member")?.text).toBe("已退回修改：补年份");
    expect(collaborationStatus({ ...base, status: "locked" }, "member")?.tone).toBe("done");
    expect(collaborationStatus({ ...base, status: "in_progress" }, "member")).toBeNull();
  });
});
