import { expect, it } from "vitest";

import { confirmSummary } from "@/lib/dingze/confirm-summary";

it("lists what changed since the last lock and which tables build on this one", () => {
  const s = confirmSummary("S3-02", { charters: [{ id: "c1", name: "加气站", budget: "5400 万" }] }, { rev: 3, payload: { charters: [{ id: "c1", name: "加气站", budget: "6400 万" }] } });
  expect(s.firstLock).toBe(false);
  expect(s.changes).toEqual([{ where: "charters.c1.budget", kind: "changed", before: "6400 万", after: "5400 万" }]);
  expect(s.downstream.some((d) => d.startsWith("S3-05"))).toBe(true);
});

it("a first lock has no diff", () => {
  expect(confirmSummary("S1-01", { strategicGoals: "x" }, null).firstLock).toBe(true);
});
