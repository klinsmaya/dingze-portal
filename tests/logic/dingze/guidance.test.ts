import { describe, expect, it } from "vitest";

import { canMoveGap } from "@dingze/shared";

describe("guidance gap review", () => {
  it("allows the review moves and their reversals only", () => {
    expect(canMoveGap("open", "accepted")).toBe(true);
    expect(canMoveGap("open", "rejected")).toBe(true);
    expect(canMoveGap("open", "shipped")).toBe(false);
    expect(canMoveGap("accepted", "shipped")).toBe(true);
    expect(canMoveGap("rejected", "open")).toBe(true);
    expect(canMoveGap("shipped", "open")).toBe(false);
    expect(canMoveGap("shipped", "accepted")).toBe(true);
    expect(canMoveGap("accepted", "accepted")).toBe(false);
  });
});
