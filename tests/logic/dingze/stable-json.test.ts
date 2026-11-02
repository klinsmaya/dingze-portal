import { describe, expect, it } from "vitest";

import { samePayload } from "@/lib/dingze/stable-json";

describe("payload comparison", () => {
  it("ignores key order, as jsonb does not keep it", () => {
    expect(samePayload({ coreUser: { who: "a", need: "b" }, statement: "s" }, { statement: "s", coreUser: { need: "b", who: "a" } })).toBe(true);
  });
  it("still sees real changes, including array order", () => {
    expect(samePayload({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(samePayload({ a: "x" }, { a: "y" })).toBe(false);
  });
});
