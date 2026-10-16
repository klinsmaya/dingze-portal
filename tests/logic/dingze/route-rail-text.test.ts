import { expect, it } from "vitest";

import type { ArtifactOverview } from "@/lib/dingze/api";
import { buildRoute, codeLabel, waitingText } from "@/lib/dingze/route";

// 左栏步骤行（参考稿）：右侧表号，第二行说清锁住时在等什么。
it("joins a step's tables into one short code", () => {
  expect(codeLabel(["S2-01", "S2-03"])).toBe("S2-01/03");
  expect(codeLabel(["S2-08"])).toBe("S2-08");
  expect(codeLabel([])).toBe("");
});

it("shortens the unlock reason to fit one rail line", () => {
  expect(waitingText("S2-08 关键项目清单“本步完成”后解锁")).toBe("S2-08 本步完成后解锁");
  expect(waitingText("上一阶段全部 P0 成果定版后开启")).toBe("上一阶段定版后开启");
  expect(waitingText(undefined)).toBe("前面的表本步完成后解锁");
});

it("a locked step carries its waiting text and table codes", () => {
  const row = (code: string, unlocked: boolean, waitingFor?: string): ArtifactOverview => ({
    code,
    status: "not_started",
    stale: false,
    staleReason: null,
    exception: false,
    currentRev: 0,
    updatedAt: null,
    unlock: { unlocked, waitingFor } as ArtifactOverview["unlock"],
  });
  const steps = buildRoute("goal", [row("S2-03", true), row("S2-01", true), row("S2-08", true), row("S2-04", false, "S2-08 关键项目清单“本步完成”后解锁")], { code: "S2-03" }).tasks.flatMap((t) => t.steps);
  const raci = steps.find((s) => s.key === "s2-raci")!;
  expect(raci.state).toBe("locked");
  expect(raci.waiting).toBe("S2-08 本步完成后解锁");
  expect(steps.find((s) => s.key === "s2-path")!.codeLabel).toBe("S2-01/03");
});
