import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ProposedChange, applyChanges, createAppliedProposals } from "@/lib/dingze/changes";
import {
  type FlushOutcome,
  type FlushState,
  flushStep,
  isRepeatedResult,
  proposalNote,
  proposalResultContent,
  useFlushSave,
} from "@/lib/dingze/proposal-save";

// 2026-11-17 反馈：点“确认修改”后又弹出一模一样的卡片。数字咨询师读表读的是服务端已保存的版本，
// 修改卡确认后以前只写页面草稿就回报成功，它再读表还是旧内容，于是把同一张卡再出一遍。

const idle: FlushState = { dirty: true, saving: false, canSave: true, inSync: true };

describe("flushStep", () => {
  it("saves a changed draft right away", () => {
    expect(flushStep(idle)).toBe("save");
  });
  it("waits for a save that is on its way", () => {
    expect(flushStep({ ...idle, saving: true })).toBe("wait");
    expect(flushStep({ ...idle, saving: true, dirty: false })).toBe("wait");
  });
  it("has nothing to do once the draft is saved", () => {
    expect(flushStep({ ...idle, dirty: false })).toBe("saved");
  });
  it("waits until the page has caught up with the server", () => {
    expect(flushStep({ ...idle, inSync: false })).toBe("wait");
  });
  it("gives up where the table cannot be saved", () => {
    expect(flushStep({ ...idle, canSave: false })).toBe("blocked");
  });
});

/** A page with a draft and a server that only knows what was saved, as `dingzeGetArtifact` sees it. */
function setup(initial: Partial<FlushState> = {}, timeoutMs?: number) {
  const server = { rev: 1, payload: "旧内容", fail: false };
  const page = { draft: "旧内容" };
  let finishSave: (() => void) | null = null;
  const saves: string[] = [];
  const save = () =>
    new Promise<{ rev: number } | null>((resolve) => {
      const payload = page.draft;
      saves.push(payload);
      finishSave = () => {
        finishSave = null;
        if (server.fail) return resolve(null);
        server.rev += 1;
        server.payload = payload;
        resolve({ rev: server.rev });
      };
    });
  const props = (state: Partial<FlushState> = {}) => ({ ...idle, dirty: page.draft !== server.payload, ...initial, ...state, rev: server.rev, save });
  const hook = renderHook((p: ReturnType<typeof props>) => useFlushSave(p, timeoutMs), { initialProps: props() });
  // As on the page: the card's write and the request to save it land in the same render.
  const confirm = (next: string) => {
    let outcome: FlushOutcome | undefined;
    act(() => {
      page.draft = next;
      void hook.result.current().then((o) => (outcome = o));
      hook.rerender(props());
    });
    return () => outcome;
  };
  return {
    server,
    saves,
    confirm,
    rerender: (state: Partial<FlushState> = {}) => hook.rerender(props(state)),
    unmount: hook.unmount,
    finishSave: async () => {
      await act(async () => finishSave?.());
    },
    get saving() {
      return finishSave !== null;
    },
  };
}

describe("useFlushSave", () => {
  afterEach(() => vi.useRealTimers());

  it("reports the write only once the server holds it", async () => {
    const t = setup();
    const outcome = t.confirm("新内容");

    // Saved at once, not after the autosave delay, and nothing is reported while it is on its way:
    // a read at this moment would still return the old content.
    expect(t.saves).toEqual(["新内容"]);
    expect(t.server.payload).toBe("旧内容");
    expect(outcome()).toBeUndefined();

    await t.finishSave();
    expect(t.server.payload).toBe("新内容");
    expect(outcome()).toEqual({ saved: true, rev: 2, wrote: true });
  });

  it("lets a save that was already running finish, then saves the write", async () => {
    const t = setup({ saving: true });
    const outcome = t.confirm("新内容");
    expect(t.saves).toEqual([]);

    // The running save was of the draft before the card; once it is back, the page waits for the
    // refetch and then saves what the card wrote.
    t.rerender({ saving: false, dirty: true, inSync: false });
    expect(t.saves).toEqual([]);
    t.rerender({ saving: false, dirty: true, inSync: true });
    expect(t.saves).toEqual(["新内容"]);
    await t.finishSave();
    expect(outcome()).toEqual({ saved: true, rev: 2, wrote: true });
  });

  it("reports the current version when nothing is left to save", async () => {
    const t = setup();
    const outcome = t.confirm("旧内容");
    await act(async () => {});
    expect(t.saves).toEqual([]);
    expect(outcome()).toEqual({ saved: true, rev: 1, wrote: false });
  });

  it("says so when the save fails", async () => {
    const t = setup();
    t.server.fail = true;
    const outcome = t.confirm("新内容");
    await t.finishSave();
    expect(outcome()).toEqual({ saved: false });
    expect(t.server.payload).toBe("旧内容");
  });

  it("says so when the table cannot be saved from here", async () => {
    const t = setup({ canSave: false });
    const outcome = t.confirm("新内容");
    await act(async () => {});
    expect(t.saves).toEqual([]);
    expect(outcome()).toEqual({ saved: false });
  });

  it("does not hold the conversation for a save that does not come back", async () => {
    vi.useFakeTimers();
    const t = setup({}, 8000);
    const outcome = t.confirm("新内容");
    expect(t.saving).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(outcome()).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(outcome()).toEqual({ saved: false });
  });

  it("does not leave a confirmation hanging when the page is left", async () => {
    const t = setup({ saving: true });
    const outcome = t.confirm("新内容");
    t.unmount();
    await act(async () => {});
    expect(outcome()).toEqual({ saved: false });
  });
});

describe("proposalResultContent", () => {
  const saved: FlushOutcome = { saved: true, rev: 3, wrote: true };

  it("tells the consultant which version holds the write and not to issue the card again", () => {
    const content = proposalResultContent({ repeated: false, kept: true, flush: saved, blocking: ["六分法缺“战略目标”"] });
    expect(content).toContain("保存为第 3 版");
    expect(content).toContain("dingzeGetArtifact 读到的就是第 3 版");
    expect(content).toContain("不要再出同样的修改卡");
    expect(content).toContain("还有 1 处必须改：六分法缺“战略目标”");
    expect(isRepeatedResult(content)).toBe(false);
  });

  it("warns that a read still returns the old content while the draft is unsaved", () => {
    const content = proposalResultContent({ repeated: false, kept: true, flush: { saved: false }, blocking: [] });
    expect(content).toContain("还没有保存到服务器");
    expect(content).toContain("不要因为读到旧内容就认为没有写入");
    expect(content).toContain("不要再出同样的修改卡");
    expect(content).toContain("没有必须改的问题");
  });

  it("marks a repeated card as such", () => {
    const content = proposalResultContent({ repeated: true, kept: true, flush: saved, blocking: [] });
    expect(isRepeatedResult(content)).toBe(true);
    expect(content).toContain("本次没有重复写入");
    expect(isRepeatedResult(proposalResultContent({ repeated: true, kept: true, flush: { saved: false }, blocking: [] }))).toBe(true);
    // Results written before this change read the same way.
    expect(isRepeatedResult("这组修改此前已经写入草稿，本次没有重复写入。不要再出同样的修改卡，直接继续下一步。")).toBe(true);
  });

  it("does not claim a write that is no longer in the draft", () => {
    const content = proposalResultContent({ repeated: false, kept: false, flush: { saved: true, rev: 3, wrote: false }, blocking: [] });
    expect(content).not.toContain("保存为第");
    expect(content).toContain("先问用户");
  });

  it("lists at most five remaining issues", () => {
    const content = proposalResultContent({ repeated: false, kept: true, flush: saved, blocking: ["a", "b", "c", "d", "e", "f", "g"] });
    expect(content).toContain("还有 7 处必须改：a；b；c；d；e 等。");
  });

  it("shows the user only the first sentence", () => {
    expect(proposalNote(proposalResultContent({ repeated: false, kept: true, flush: saved, blocking: [] }))).toBe(
      "用户已确认，这组修改已写入草稿并保存为第 3 版。",
    );
    expect(proposalNote(proposalResultContent({ repeated: false, kept: true, flush: { saved: false }, blocking: [] }))).toBe(
      "用户已确认，这组修改已写入页面上的草稿。",
    );
    expect(proposalNote("用户已确认，内容已写入草稿（系统会自动保存）。")).toBe("用户已确认，内容已写入草稿（系统会自动保存）。");
    expect(proposalNote("没有句号")).toBe("没有句号");
  });
});

describe("answering a repeated card for the user", () => {
  const draft = { strategyChoice: "", stepsAndMeasures: "" };
  const card: ProposedChange[] = [
    { path: "strategyChoice", label: "策略选择", value: "稳盘与突破" },
    { path: "stepsAndMeasures", label: "步骤举措", value: "两步走" },
  ];
  const written = () => {
    const applied = createAppliedProposals();
    applied.record(card, applyChanges(draft, card));
    return applied;
  };

  it("answers each call once", () => {
    const applied = written();
    expect(applied.canAnswerRepeat(card, "call-1")).toBe(true);
    expect(applied.answerRepeat(card, "call-1")).toBe(true);
    expect(applied.repeatAnswered("call-1")).toBe(true);
    // The card is mounted again (the chat refreshes its messages): the same call is not answered twice.
    expect(applied.canAnswerRepeat(card, "call-1")).toBe(false);
    expect(applied.answerRepeat(card, "call-1")).toBe(false);
  });

  it("stops after two repeats of the same card, so a loop ends up in front of the user", () => {
    const applied = written();
    expect(applied.answerRepeat(card, "call-1")).toBe(true);
    expect(applied.answerRepeat(card, "call-2")).toBe(true);
    expect(applied.answerRepeat(card, "call-3")).toBe(false);
    expect(applied.repeatAnswered("call-3")).toBe(false);
  });

  it("hands the card back to the user when the answer did not get through", () => {
    const applied = written();
    applied.answerRepeat(card, "call-1");
    applied.repeatFailed("call-1");
    expect(applied.repeatAnswered("call-1")).toBe(false);
    expect(applied.canAnswerRepeat(card, "call-1")).toBe(false);
  });

  it("starts counting again once the card is written anew", () => {
    const applied = written();
    applied.answerRepeat(card, "call-1");
    applied.answerRepeat(card, "call-2");
    applied.record(card, applyChanges(draft, card));
    expect(applied.answerRepeat(card, "call-3")).toBe(true);
  });

  it("needs a call id", () => {
    expect(written().answerRepeat(card, "")).toBe(false);
  });
});
