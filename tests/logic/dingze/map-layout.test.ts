import { describe, expect, it } from "vitest";

import type { MapObjective, Perspective } from "@dingze/shared";

import { LANE_HEIGHT, layoutStrategyMap, linkLines } from "@/lib/dingze/map-layout";

const objective = (id: string, perspective: Perspective): MapObjective => ({ id, perspective, title: id, note: "" });

describe("strategy map layout", () => {
  it("keeps every node inside its perspective lane without overlaps", () => {
    const objectives = [
      ...Array.from({ length: 6 }, (_, i) => objective(`c${i}`, "customer")),
      objective("f", "financial"),
      objective("l", "learning"),
    ];
    const { nodes } = layoutStrategyMap({ objectives, links: [] }, 800);
    for (const node of nodes) {
      const lane = ["financial", "customer", "process", "learning"].indexOf(objectives.find((o) => o.id === node.id)!.perspective);
      expect(node.y).toBeGreaterThanOrEqual(lane * LANE_HEIGHT);
      expect(node.y + node.h).toBeLessThanOrEqual((lane + 1) * LANE_HEIGHT);
      expect(node.x + node.w).toBeLessThanOrEqual(800);
    }
    const customer = nodes.filter((n) => n.id.startsWith("c")).sort((a, b) => a.x - b.x);
    for (let i = 1; i < customer.length; i++) expect(customer[i].x).toBeGreaterThanOrEqual(customer[i - 1].x + customer[i - 1].w);
  });
});

describe("map link lines", () => {
  it("spreads several arrows into one objective along its edge", () => {
    const byId = new Map([
      ["top", { x: 100, y: 0, w: 200, h: 60 }],
      ["a", { x: 0, y: 120, w: 100, h: 60 }],
      ["b", { x: 300, y: 120, w: 100, h: 60 }],
      ["c", { x: 120, y: 120, w: 100, h: 60 }],
    ]);
    const lines = linkLines(
      [
        { id: "l1", from: "a", to: "top", kind: "cause" },
        { id: "l2", from: "b", to: "top", kind: "cause" },
        { id: "l3", from: "a", to: "c", kind: "synergy" },
        { id: "l4", from: "a", to: "gone", kind: "cause" },
      ],
      byId
    );
    const into = lines.filter((l) => l.kind === "cause").map((l) => [l.x2, l.y2]);
    expect(into).toEqual([
      [100 + 200 / 3, 60],
      [100 + 400 / 3, 60],
    ]);
    expect(lines.find((l) => l.id === "l1")).toMatchObject({ x1: 50, y1: 120 });
    expect(lines.find((l) => l.id === "l3")).toMatchObject({ x1: 100, x2: 120 });
    expect(lines.some((l) => l.id === "l4")).toBe(false);
  });
});
