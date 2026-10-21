import { describe, expect, it } from "vitest";

import { aggregateUsage, projectIdFromWorkContext } from "@dingze/shared";

describe("digital consultant usage", () => {
  it("reads the project from the page context of a message", () => {
    expect(projectIdFromWorkContext([{ type: "page", content: { projectId: 7, code: "S1-01" } }])).toBe(7);
    expect(projectIdFromWorkContext([{ content: { title: "x" } }, { content: { projectId: "12" } }])).toBe(12);
    expect(projectIdFromWorkContext(null)).toBeNull();
    expect(projectIdFromWorkContext([{ content: { projectId: "abc" } }])).toBeNull();
  });

  it("sums turns, tokens and users per project, with a 30-day window", () => {
    const now = Date.parse("2026-10-09T00:00:00Z");
    const sessions: Record<string, number> = { a: 1, b: 1, c: 2 };
    const usage = aggregateUsage(
      [
        { sessionId: "a", userId: 10, occurredAt: "2026-10-08T10:00:00Z", inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        { sessionId: "b", userId: 11, occurredAt: "2026-07-01T10:00:00Z", inputTokens: 50, outputTokens: 10, totalTokens: null },
        { sessionId: "a", userId: 10, occurredAt: "2026-10-01T10:00:00Z", inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        { sessionId: "c", userId: 12, occurredAt: "2026-10-02T10:00:00Z", totalTokens: 5 },
        { sessionId: "unknown", userId: 12, occurredAt: "2026-10-02T10:00:00Z", totalTokens: 999 },
      ],
      (id) => sessions[id],
      now
    );
    expect(usage.get(1)).toEqual({ turns: 3, inputTokens: 151, outputTokens: 31, totalTokens: 182, turns30: 2, tokens30: 122, users: 2, lastAt: "2026-10-08T10:00:00.000Z" });
    expect(usage.get(2)?.turns).toBe(1);
    expect([...usage.keys()].sort()).toEqual([1, 2]);
  });
});
