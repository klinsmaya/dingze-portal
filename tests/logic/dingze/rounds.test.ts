import { expect, it } from "vitest";

import { lockRounds, roundOf } from "@/lib/dingze/rounds";

it("numbers each lock and places every revision in a round", () => {
  const rounds = lockRounds([
    { action: "save", rev: 2, at: "2026-10-18T01:00:00Z", by: "张总" },
    { action: "confirm", rev: 4, at: "2026-10-18T09:00:00Z", by: "张总" },
    { action: "reopen", rev: 4, at: "2026-10-25T01:00:00Z", by: "张总" },
    { action: "confirm", rev: 7, at: "2026-11-02T01:00:00Z", by: "张总" },
  ]);
  expect([...rounds.entries()].map(([rev, r]) => [rev, r.label])).toEqual([
    [4, "第 1 次定版"],
    [7, "第 2 次定版（优化）"],
  ]);
  expect(roundOf(2, rounds)).toBe("首次定版前");
  expect(roundOf(4, rounds)).toBe("");
  expect(roundOf(5, rounds)).toBe("优化第 1 轮");
  expect(roundOf(8, rounds)).toBe("优化第 2 轮");
});
