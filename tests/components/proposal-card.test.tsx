import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ProposedChange, applyChanges, createAppliedProposals } from "@/lib/dingze/changes";
import { proposalResultContent } from "@/lib/dingze/proposal-save";
import { ProposalRenderer } from "@/pages/projects/components/coach-panel";
import { type EditSession, EditSessionContext } from "@/pages/projects/components/edit-session";

// 2026-11-17 反馈：点“确认修改”后又弹出一模一样的卡片。同一组修改已经在草稿里时，重出的卡不再摆到
// 用户面前等确认，由页面替用户回掉（数字咨询师收到“已经写入，不要再出”），只留一行说明。

type Props = ComponentProps<typeof ProposalRenderer>;

const card: ProposedChange[] = [{ path: "strategyChoice", label: "策略选择", value: "稳盘与突破" }];
const empty = { strategyChoice: "", strategicGoals: "" };

function setup(draft: unknown = empty) {
  const applied = createAppliedProposals();
  const session = {
    code: "S1-01",
    draft,
    validate: () => [],
    nameOf: (path: string) => path,
    proposalWritten: (changes: ProposedChange[]) => applied.has(changes, draft),
    repeats: applied,
    setPreview: () => {},
    setPreviewDraft: () => {},
    activeComment: null,
    commentInfo: () => null,
    focusAnchor: null,
    chrome: { current: null },
  } as unknown as EditSession;
  const onApprove = vi.fn(() => Promise.resolve());
  const show = (callId: string, props: Partial<Props> = {}, part: Record<string, unknown> = {}) =>
    render(
      <EditSessionContext.Provider value={session}>
        <ProposalRenderer
          part={
            {
              type: "tool-executeFrontendTool",
              toolCallId: callId,
              state: "input-streaming",
              input: { toolId: "dingze-artifact-S1-01:dingzeProposeChanges", args: { summary: "写入策略选择", changes: card } },
              ...part,
            } as unknown as Props["part"]
          }
          onApprove={onApprove}
          onReject={vi.fn()}
          onRevise={vi.fn()}
          onEdit={vi.fn()}
          {...props}
        />
      </EditSessionContext.Provider>,
    );
  return { applied, onApprove, show };
}

const written = () => {
  const draft = applyChanges(empty, card);
  const t = setup(draft);
  t.applied.record(card, draft);
  return t;
};

describe("修改卡", () => {
  afterEach(cleanup);

  it("waits for the user when the change is not in the draft yet", () => {
    const t = setup();
    t.show("call-1");
    expect(screen.getByRole("button", { name: /确认修改/ })).toBeTruthy();
    expect(t.onApprove).not.toHaveBeenCalled();
  });

  it("answers a card that repeats a written one, and does not show it as a card", () => {
    const t = written();
    t.show("call-2");
    expect(t.onApprove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /确认修改/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("已替你跳过");
  });

  it("answers only once the round that issued it has ended", () => {
    const t = written();
    const view = t.show("call-2", { disabled: true });
    expect(t.onApprove).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /确认修改/ })).toBeNull();
    view.unmount();
    t.show("call-2");
    expect(t.onApprove).toHaveBeenCalledTimes(1);
  });

  it("does not answer the same call twice when the card is mounted again", () => {
    const t = written();
    t.show("call-2").unmount();
    t.show("call-2");
    expect(t.onApprove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("已替你跳过");
  });

  it("puts the card in front of the user when the consultant keeps issuing it", () => {
    const t = written();
    t.show("call-2").unmount();
    t.show("call-3").unmount();
    t.show("call-4");
    expect(t.onApprove).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: /确认修改/ })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("这是重复出的一张卡");
  });

  it("answers it just the same when it arrives complete", () => {
    const t = written();
    t.show("call-2", {}, { state: "input-available" });
    expect(t.onApprove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /确认修改/ })).toBeNull();
  });

  it("hands the card back when the answer does not get through", async () => {
    const t = written();
    t.onApprove.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    t.show("call-2");
    expect(await screen.findByRole("button", { name: /确认修改/ })).toBeTruthy();
    expect(t.onApprove).toHaveBeenCalledTimes(1);
  });

  it("shows the user the first sentence of the result, not the instructions for the consultant", () => {
    const t = setup();
    const output = proposalResultContent({ repeated: false, kept: true, flush: { saved: true, rev: 3, wrote: true }, blocking: [] });
    const view = t.show("call-1", {}, { state: "output-available", output });
    expect(view.container.textContent).toContain("已写入草稿");
    expect(view.container.textContent).toContain("保存为第 3 版");
    expect(view.container.textContent).not.toContain("dingzeGetArtifact");
  });

  it("shows a repeated card that was answered as one line", () => {
    const t = setup();
    const output = proposalResultContent({ repeated: true, kept: true, flush: { saved: true, rev: 3, wrote: false }, blocking: [] });
    const view = t.show("call-2", {}, { state: "output-available", output });
    expect(view.container.textContent).toContain("已替你跳过");
    expect(view.container.textContent).not.toContain("dingzeGetArtifact");
  });
});
