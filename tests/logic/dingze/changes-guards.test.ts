import { describe, expect, it } from "vitest";

import { ChangePathError, type ProposedChange, applyChanges, createAppliedProposals } from "@/lib/dingze/changes";
import { anchorCandidates } from "@/lib/dingze/locate";

// 验收 E D01：AI 给的内容没有经过格式检查，残缺的一条不能进表；D03：整表批注没有锚点。
describe("applyChanges guards", () => {
  const draft = { charters: [{ id: "c1", name: "加气站" }] };

  it("rejects an empty or scalar append into a row list", () => {
    expect(() => applyChanges(draft, [{ path: "charters.+", value: undefined }])).toThrow(ChangePathError);
    expect(() => applyChanges(draft, [{ path: "charters.+", value: "加气站二期" }])).toThrow(ChangePathError);
  });

  it("gives an appended row without an id a stable one", () => {
    const next = applyChanges(draft, [{ path: "charters.+", value: { name: "二期" } }]);
    expect(next.charters[1]).toEqual({ name: "二期", id: "ai2" });
  });

  it("keeps the row id when a whole row is replaced, and refuses a scalar", () => {
    const next = applyChanges(draft, [{ path: "charters.c1", value: { name: "改名" } }]);
    expect(next.charters[0]).toEqual({ name: "改名", id: "c1" });
    expect(() => applyChanges(draft, [{ path: "charters.c1", value: null }])).toThrow(ChangePathError);
  });
});

it("anchorCandidates has nothing for a whole-table anchor", () => {
  expect(anchorCandidates(undefined)).toEqual([]);
  expect(anchorCandidates(null)).toEqual([]);
});

it("validateArtifact reports an incomplete row instead of throwing", async () => {
  const { INCOMPLETE_ROW_MESSAGE, validateArtifact } = await import("@dingze/shared");
  const issues = validateArtifact("S3-02", { screening: [{ id: "s1" }], charters: [undefined] });
  expect(issues.map((i) => i.message)).toContain(INCOMPLETE_ROW_MESSAGE);
});

// 测试反馈 1：确认修改后对话中断，数字咨询师把同一张卡再出一遍，不能写两遍。
describe("createAppliedProposals", () => {
  const draft = { charters: [{ id: "c1", name: "加气站" }], goal: "" };
  const card: ProposedChange[] = [
    { path: "charters.+", label: "任务书", value: { name: "二期" } },
    { path: "goal", label: "目标", value: "三年翻番" },
  ];

  it("does not know a card it never wrote", () => {
    expect(createAppliedProposals().has(card, applyChanges(draft, card))).toBe(false);
  });

  it("recognises the same card again, whatever its labels or the key order", () => {
    const applied = createAppliedProposals();
    const next = applyChanges(draft, card);
    applied.record(card, next);
    expect(applied.has(card, next)).toBe(true);
    expect(applied.has([{ ...card[0], label: "新增任务书" }, card[1]], JSON.parse(JSON.stringify(next)))).toBe(true);
  });

  it("still recognises it after an unrelated edit, but not once its content is gone", () => {
    const applied = createAppliedProposals();
    const next = applyChanges(draft, card);
    applied.record(card, next);
    expect(applied.has(card, { ...next, note: "别处的修改" })).toBe(true);
    expect(applied.has(card, { ...next, charters: next.charters.slice(0, 1) })).toBe(false);
    expect(applied.has(card, { ...next, goal: "改掉了" })).toBe(false);
  });

  it("treats a different card as new", () => {
    const applied = createAppliedProposals();
    const next = applyChanges(draft, card);
    applied.record(card, next);
    expect(applied.has([{ path: "charters.+", value: { name: "三期" } }], next)).toBe(false);
  });
});
