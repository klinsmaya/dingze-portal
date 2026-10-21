import { describe, expect, it } from "vitest";

import { aiDiffLabel, filterRegistry, registrySheet } from "@/lib/dingze/records";
import type { RegistryRow } from "@/lib/dingze/records-api";

const row = (code: string, patch: Partial<RegistryRow> = {}): RegistryRow => ({
  code,
  status: "not_started",
  stale: false,
  currentRev: 0,
  lockedRev: null,
  updatedAt: null,
  versions: { total: 0, ai: 0, enterprise: 0, consultant: 0 },
  lastEvent: null,
  aiDiff: null,
  ...patch,
});

describe("artifact registry", () => {
  const rows = [row("S1-01", { status: "locked", lockedRev: 3 }), row("S2-04", { status: "in_progress", stale: true }), row("S3-02")];

  it("filters by stage, by status and by 上游已变更", () => {
    expect(filterRegistry(rows, { stage: "goal", status: "all" }).map((r) => r.code)).toEqual(["S2-04"]);
    expect(filterRegistry(rows, { stage: "all", status: "locked" }).map((r) => r.code)).toEqual(["S1-01"]);
    expect(filterRegistry(rows, { stage: "all", status: "stale" }).map((r) => r.code)).toEqual(["S2-04"]);
  });

  it("describes the AI-draft-to-locked difference", () => {
    expect(aiDiffLabel(null)).toBe("—");
    expect(aiDiffLabel({ aiRev: 1, lockedRev: 4, added: 2, removed: 0, changed: 5 })).toBe("v1→v4 改 5 · 增 2");
    expect(aiDiffLabel({ aiRev: 2, lockedRev: 2, added: 0, removed: 0, changed: 0 })).toBe("v2→v2 未改动");
  });

  it("exports one row per artifact with stage, spec id and status", () => {
    const sheet = registrySheet(rows);
    expect(sheet.rows[0].slice(0, 5)).toEqual(["定战略责", "S1-01", expect.any(String), "P0", "已定版"]);
    expect(sheet.rows[1][5]).toBe("是");
  });
});
