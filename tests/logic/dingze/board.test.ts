import { describe, expect, it } from "vitest";

import { boardBucket, waitingDays } from "@dingze/shared";

describe("consultant board", () => {
  it("puts each status in the bucket the consultant acts on", () => {
    expect(boardBucket("in_review", false)).toBe("review");
    expect(boardBucket("step_done", false)).toBe("submit");
    expect(boardBucket("pending_confirm", false)).toBe("confirm");
    expect(boardBucket("in_progress", false)).toBe("working");
    expect(boardBucket("locked", false)).toBeNull();
    expect(boardBucket("not_started", false)).toBeNull();
  });

  it("flags upstream changes first, even on locked artifacts", () => {
    expect(boardBucket("in_review", true)).toBe("stale");
    expect(boardBucket("locked", true)).toBe("stale");
    expect(boardBucket("archived", true)).toBeNull();
  });

  it("counts whole days waited", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    expect(waitingDays("2026-10-07T13:00:00Z", now)).toBe(1);
    expect(waitingDays(null, now)).toBeNull();
    expect(waitingDays("not a date", now)).toBeNull();
  });
});
