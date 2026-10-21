import { describe, expect, it } from "vitest";

import { ChangePathError, applyChanges } from "@/lib/dingze/changes";
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
