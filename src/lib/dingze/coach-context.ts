import { type ArtifactStatus, STATUS_LABELS } from "@dingze/shared";

import type { CommentThread } from "./comments-api";

// What the digital consultant must know about the table's place in the flow, beyond its content
// (验收 D04 / E D07): whether it was returned and why, open comments, which version is a draft and
// which is confirmed. Structural validation passing says nothing about these.

export type WorkflowFacts = {
  status: ArtifactStatus;
  /** The last lifecycle event, from the project overview. */
  lastEvent?: { action: string; reason?: string | null; by?: string | null; at?: string | null } | null;
  stale?: boolean;
  staleReason?: string | null;
  currentRev?: number | null;
  stepDoneRev?: number | null;
  lockedRev?: number | null;
  comments?: CommentThread[];
};

const clip = (s: string, n = 200) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function workflowContext(f: WorkflowFacts) {
  const returned = f.status === "in_progress" && !!f.lastEvent && ["returnToEdit", "forceReturn"].includes(f.lastEvent.action);
  const open = (f.comments ?? []).filter((c) => !c.resolved);
  const confirmation =
    f.status === "locked"
      ? `已定版 v${f.lockedRev ?? "?"}：这是企业确认过的版本`
      : f.lockedRev
        ? `当前是重开后的草稿 v${f.currentRev ?? "?"}，尚未确认；上一次定版是 v${f.lockedRev}`
        : `尚未定版：表里的内容都是草稿（v${f.currentRev ?? 0}），不是企业已确认的事实`;
  return {
    statusLabel: STATUS_LABELS[f.status],
    returned: returned ? { reason: f.lastEvent?.reason || "（退回时没有写原因，请看批注）", by: f.lastEvent?.by ?? null, at: f.lastEvent?.at ?? null } : null,
    confirmation,
    versions: { current: f.currentRev ?? null, stepDone: f.stepDoneRev ?? null, locked: f.lockedRev ?? null },
    upstreamChanged: f.stale ? f.staleReason || "上游表有改动" : null,
    openComments: open.slice(0, 12).map((c) => ({
      where: c.anchorLabel || "整张表",
      author: c.author,
      content: clip(c.content),
      replies: c.replies.map((r) => `${r.author}：${clip(r.content, 120)}`),
    })),
    openCommentCount: open.length,
    rules: [
      "回答前先看 returned、openComments 和 confirmation：退回原因和批注就在这里，不要说“没有退回原因”。",
      "结构校验没有问题，不代表业务上已通过；退回、批注和待确认状态以这里为准。",
      "引用表里的数字时，说明它是草稿还是已定版、出自哪个字段；未定版的内容不能说成已确定的事实。",
    ],
  };
}
