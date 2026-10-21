import { expect, it } from "vitest";

import type { ArtifactOverview } from "@/lib/dingze/api";
import { buildRoute } from "@/lib/dingze/route";

const row = (code: string, status: ArtifactOverview["status"], unlocked: boolean): ArtifactOverview => ({
  code,
  status,
  stale: false,
  staleReason: null,
  exception: false,
  currentRev: status === "not_started" ? 0 : 1,
  updatedAt: null,
  unlock: { unlocked } as ArtifactOverview["unlock"],
});

// 验收 E D04：跳过可选的 S1-04 时，“第三步 筛选战略 KPI”直达 S1-06，不进被 S1-04 锁住的 S1-05。
it("step 3 links to S1-06 while S1-05 is locked behind a skipped S1-04", () => {
  const artifacts = [row("S1-03", "locked", true), row("S1-04", "not_started", true), row("S1-05", "not_started", false), row("S1-06", "not_started", true)];
  const step = buildRoute("strategy", artifacts, { code: "S1-03" }).tasks.flatMap((t) => t.steps).find((s) => s.key === "s1-kpi");
  expect(step?.to).toEqual({ code: "S1-06" });
});

it("step 3 goes to S1-05 once it is open", () => {
  const artifacts = [row("S1-04", "step_done", true), row("S1-05", "not_started", true), row("S1-06", "not_started", true)];
  const step = buildRoute("strategy", artifacts, { code: "S1-03" }).tasks.flatMap((t) => t.steps).find((s) => s.key === "s1-kpi");
  expect(step?.to).toEqual({ code: "S1-05" });
});

// 开营前 UX 改版 F8：S1-06 已定版、可选的 S1-05 没做时，左栏第三步写“已定版”，与表头一致。
it("step 3 reads 已定版 when its required table is locked and the optional one was never started", () => {
  const step = (s105: ArtifactOverview["status"]) =>
    buildRoute("strategy", [row("S1-05", s105, true), row("S1-06", "locked", true)], { code: "S1-06" })
      .tasks.flatMap((t) => t.steps)
      .find((s) => s.key === "s1-kpi");
  expect(step("not_started")?.state).toBe("final");
  expect(step("not_started")?.badge).toBe("已定版");
  expect(step("in_progress")?.state).toBe("doing");
});
