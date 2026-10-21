import { describe, expect, it } from "vitest";

import type { CommentThread } from "@/lib/dingze/comments-api";
import { workflowContext } from "@/lib/dingze/coach-context";

const thread = (id: number, content: string, resolved = false): CommentThread => ({
  id,
  parentId: null,
  anchor: "strategicGoals",
  anchorLabel: "战略目标",
  content,
  mentions: [],
  rev: 1,
  resolved,
  resolvedAt: null,
  authorId: 1,
  author: "陈顾问",
  at: "2026-10-13T00:00:00Z",
  replies: [],
});

describe("workflowContext", () => {
  it("carries the return reason and open comments of a returned draft", () => {
    const c = workflowContext({
      status: "in_progress",
      lastEvent: { action: "returnToEdit", reason: "战略目标量化到 2030 年" },
      currentRev: 1,
      comments: [thread(1, "口径对齐十五五"), thread(2, "已改", true)],
    });
    expect(c.returned?.reason).toBe("战略目标量化到 2030 年");
    expect(c.confirmation).toContain("尚未定版");
    expect(c.openComments.map((x) => x.content)).toEqual(["口径对齐十五五"]);
  });

  it("tells a reopened draft from the confirmed version", () => {
    const c = workflowContext({ status: "in_progress", currentRev: 4, lockedRev: 3, stale: true, staleReason: "S2-03 已改" });
    expect(c.returned).toBeNull();
    expect(c.confirmation).toBe("当前是重开后的草稿 v4，尚未确认；上一次定版是 v3");
    expect(c.upstreamChanged).toBe("S2-03 已改");
  });
});
