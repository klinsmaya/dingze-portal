import { expect, it } from "vitest";

import { impactList } from "@/lib/dingze/impact";

it("lists the direct downstream first, then the tables behind them, skipping ones not started", () => {
  const rows = impactList("S2-04", [
    { code: "S2-05", status: "locked", stale: true },
    { code: "S2-06", status: "locked", stale: true },
    { code: "S2-07", status: "in_progress", stale: false },
    { code: "S3-02", status: "not_started", stale: false },
    { code: "S3-08", status: "locked", stale: false },
  ]);
  expect(rows.map((r) => [r.code, r.depth])).toEqual([
    ["S2-05", 1],
    ["S2-06", 1],
    ["S2-07", 1],
    ["S3-08", 2],
  ]);
  expect(rows[0]).toMatchObject({ stale: true, statusLabel: "已定版" });
  expect(rows[3].via).toBeTruthy();
});
