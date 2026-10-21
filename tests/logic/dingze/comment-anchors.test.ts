import { describe, expect, it } from "vitest";

import { anchorOptions } from "@/lib/dingze/comment-anchors";

describe("comment anchors", () => {
  it("lists every labelled row, nested ones included", () => {
    const payload = {
      charters: [{ id: "pc1", code: "2026OPSP001", name: "物流车队客户拓展", wbs: [{ id: "w1", name: "客户名单梳理" }, { id: "w2", name: "" }] }],
      screening: [{ id: "sc1", name: "物流车队", renamed: "签约 40 家" }],
    };
    expect(anchorOptions(payload)).toEqual([
      { id: "pc1", label: "物流车队客户拓展", group: "任务书" },
      { id: "w1", label: "客户名单梳理", group: "WBS" },
      { id: "sc1", label: "物流车队", group: "项目化判定" },
    ]);
  });

  it("offers the strategy house cells as fields", () => {
    const options = anchorOptions({ mission: "m", goals: { y1: "", y3: "", y5: "" }, battlefields: [{ id: "b1", name: "城燃" }] });
    expect(options.map((o) => o.id)).toEqual(["mission", "goals.y1", "goals.y3", "goals.y5", "b1"]);
  });

  it("ignores payloads without rows", () => {
    expect(anchorOptions({ foo: "x" })).toEqual([]);
    expect(anchorOptions(null)).toEqual([]);
  });
});
