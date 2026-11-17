// What happens to a change card after 确认修改.
//
// The digital consultant reads a table through `dingzeGetArtifact`, which returns the version saved
// on the server. A confirmed card used to be written to the page's draft only and reported as done
// at once, with autosave following seconds later: the consultant's next read still showed the table
// without the change, so it issued the same card again. The write is therefore saved before the
// result goes back, and the result says which version holds it.

import { useCallback, useEffect, useRef, useState } from "react";

/** How long a confirmed card waits for its save before reporting “not saved yet”. */
export const FLUSH_TIMEOUT_MS = 8000;

export type FlushState = {
  /** The draft differs from what was last saved. */
  dirty: boolean;
  /** A save is on its way. */
  saving: boolean;
  /** The user may save this table right now. */
  canSave: boolean;
  /** The draft is based on the server's latest version (no refetch pending, nobody else saved). */
  inSync: boolean;
};

/**
 * The next move towards “the draft is on the server”:
 * - `wait`: a save is running, or the page has not caught up with the server yet;
 * - `saved`: nothing is left to save;
 * - `blocked`: it cannot be saved from here;
 * - `save`: save now.
 */
export function flushStep(state: FlushState): "wait" | "saved" | "blocked" | "save" {
  if (state.saving) return "wait";
  if (!state.dirty) return "saved";
  if (!state.canSave) return "blocked";
  if (!state.inSync) return "wait";
  return "save";
}

export type FlushOutcome =
  | {
      saved: true;
      rev: number;
      /** This flush saved the draft itself; `false` when nothing was left to save. */
      wrote: boolean;
    }
  | { saved: false };

/**
 * Returns `flush()`: saves the draft without waiting for autosave and resolves once it is on the
 * server, or once it is clear that it will not get there in time. It never rejects.
 */
export function useFlushSave(
  state: FlushState & {
    /** The revision the draft is based on. */
    rev: number;
    /** Saves the draft; resolves `null` when the save failed. */
    save: () => Promise<{ rev: number } | null>;
  },
  timeoutMs = FLUSH_TIMEOUT_MS,
) {
  const pending = useRef<{ busy: boolean; finish: (outcome: FlushOutcome) => void } | null>(null);
  const [, kick] = useState(0);

  // Runs after every render: the edit that asked for the flush and the request itself land in the
  // same render, so the state seen here already includes that edit.
  useEffect(() => {
    const entry = pending.current;
    if (!entry || entry.busy) return;
    const step = flushStep(state);
    if (step === "wait") return;
    if (step === "saved") return entry.finish({ saved: true, rev: state.rev, wrote: false });
    if (step === "blocked") return entry.finish({ saved: false });
    entry.busy = true;
    state.save().then(
      (result) => entry.finish(result ? { saved: true, rev: result.rev, wrote: true } : { saved: false }),
      () => entry.finish({ saved: false }),
    );
  });
  useEffect(() => () => pending.current?.finish({ saved: false }), []);

  return useCallback(
    () =>
      new Promise<FlushOutcome>((resolve) => {
        pending.current?.finish({ saved: false });
        const entry = {
          busy: false,
          finish(outcome: FlushOutcome) {
            if (pending.current === entry) pending.current = null;
            window.clearTimeout(timer);
            resolve(outcome);
          },
        };
        const timer = window.setTimeout(() => entry.finish({ saved: false }), timeoutMs);
        pending.current = entry;
        kick((n) => n + 1);
      }),
    [timeoutMs],
  );
}

export type ProposalOutcome = {
  /** The card's content was already in the draft: nothing was written this time. */
  repeated: boolean;
  /** The content is still in the draft after the save (not undone or replaced meanwhile). */
  kept: boolean;
  flush: FlushOutcome;
  /** 必须改 issues left on the table after the write. */
  blocking: string[];
};

const NO_REISSUE = "这张修改卡到此结束：不要再出同样的修改卡，也不要为了核对重新出卡，直接接着往下走。";

/**
 * What the consultant is told after 确认修改. The first sentence is also what the card shows the
 * user (see `proposalNote`), so it stays free of tool names.
 */
export function proposalResultContent({ repeated, kept, flush, blocking }: ProposalOutcome): string {
  if (!kept) {
    return "用户已确认，但这组修改随后又被改动（被撤销，或被别人保存的版本替换）。表里现在的内容以 dingzeGetArtifact 读到的为准；先问用户要不要重新写入，不要直接重出修改卡。";
  }
  const head = repeated
    ? flush.saved
      ? `这组修改此前已经写入草稿（已保存为第 ${flush.rev} 版），本次没有重复写入。`
      : "这组修改此前已经写入草稿，本次没有重复写入。"
    : flush.saved
      ? `用户已确认，这组修改已写入草稿并保存为第 ${flush.rev} 版。`
      : "用户已确认，这组修改已写入页面上的草稿。";
  const where = flush.saved
    ? `dingzeGetArtifact 读到的就是第 ${flush.rev} 版，里面已经有这组修改。`
    : "草稿还没有保存到服务器（稍后自动保存），此时 dingzeGetArtifact 读到的仍是保存前的旧内容，以这条结果为准，不要因为读到旧内容就认为没有写入。";
  const left = blocking.length
    ? `写入后这张表还有 ${blocking.length} 处必须改：${blocking.slice(0, 5).join("；")}${blocking.length > 5 ? " 等" : ""}。`
    : "写入后这张表没有必须改的问题。";
  return `${head}${where}${NO_REISSUE}${left}`;
}

/** The part of a successful result shown under the card: its first sentence. */
export function proposalNote(content: string): string {
  const end = content.indexOf("。");
  return end < 0 ? content : content.slice(0, end + 1);
}

/** A result saying the card repeated one that was already written. */
export function isRepeatedResult(content: unknown): boolean {
  return typeof content === "string" && content.startsWith("这组修改此前已经写入草稿");
}
