import { describe, expect, it } from "vitest";

import { diffPayloads, summarizeDiff } from "@dingze/shared";

describe("payload diff", () => {
  it("matches array rows by id, so reordering is not a change", () => {
    const a = { rows: [{ id: "r1", name: "甲" }, { id: "r2", name: "乙" }] };
    const b = { rows: [{ id: "r2", name: "乙" }, { id: "r1", name: "甲" }] };
    expect(diffPayloads(a, b)).toEqual([]);
  });

  it("reports changed fields by path and whole rows as added or removed", () => {
    const a = { title: "旧", rows: [{ id: "r1", name: "甲", value: "1" }, { id: "r2", name: "乙" }] };
    const b = { title: "新", rows: [{ id: "r1", name: "甲", value: "2" }, { id: "r3", name: "丙" }] };
    const entries = diffPayloads(a, b);
    expect(entries.map((e) => [e.path, e.kind])).toEqual([
      ["title", "changed"],
      ["rows.r1.value", "changed"],
      ["rows.r2", "removed"],
      ["rows.r3", "added"],
    ]);
    expect(summarizeDiff(entries)).toEqual({ added: 1, removed: 1, changed: 2 });
  });

  it("treats an emptied field as removed and blank-to-blank as unchanged", () => {
    expect(diffPayloads({ a: "x", b: "" }, { a: "", b: null })).toEqual([{ path: "a", kind: "removed", before: "x" }]);
  });

  it("compares arrays without ids as whole values", () => {
    expect(diffPayloads({ years: [2025, 2026] }, { years: [2025, 2026, 2027] })).toEqual([
      { path: "years", kind: "changed", before: [2025, 2026], after: [2025, 2026, 2027] },
    ]);
  });
});
