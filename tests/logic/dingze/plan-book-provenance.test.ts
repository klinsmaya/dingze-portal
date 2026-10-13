import { expect, it } from "vitest";

import { planBookProvenance } from "@/lib/dingze/plan-book-provenance";
import type { PlanBookSources } from "@/lib/dingze/records-api";

const base: PlanBookSources = {
  code: "S3-07",
  locked: true,
  rev: 2,
  payload: {},
  recorded: true,
  stale: false,
  staleReason: null,
  sources: [{ code: "S3-02", specId: "S3-02", name: "项目任务书", rev: 3, basis: "locked", basisLabel: "定版" }],
  payloads: {},
};
const project = { enterprise: "瀚川燃气", year: 2026, name: "2026 年度战略落地" };

it("names the locked plan book version and each source version", () => {
  const p = planBookProvenance(base, project, new Date("2026-10-13T08:00:00Z"));
  expect(p.lines[1]).toContain("定版 v2");
  expect(p.sources).toEqual([{ specId: "S3-02", name: "项目任务书", version: "v3 · 定版" }]);
});

it("warns when upstream changed after the lock and when sources were reconstructed", () => {
  const p = planBookProvenance({ ...base, recorded: false, stale: true, staleReason: "S3-02 已解锁重开" }, project);
  expect(p.lines.join("\n")).toContain("按计划书定版的时间回溯");
  expect(p.lines.join("\n")).toContain("仍是原批准内容");
});
