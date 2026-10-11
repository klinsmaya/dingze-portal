import { describe, expect, it } from "vitest";

import { anchorsOf, appendCommand, buildCommand, laterConflicts, revertCommand } from "@/lib/dingze/edit-log";

const table = { rows: [{ id: "r1", name: "车用气", value: "700" }, { id: "r2", name: "点供", value: "300" }], note: "" };

describe("edit commands", () => {
  it("describe what changed in words", () => {
    const changed = buildCommand(table, { ...table, rows: [{ ...table.rows[0], value: "500" }, table.rows[1]] }, {}, () => "车用气 · 指标值");
    expect(changed?.label).toBe("「车用气 · 指标值」700 → 500");
    const removed = buildCommand(table, { ...table, rows: [table.rows[0]] });
    expect(removed?.label).toBe("删除「点供 ｜ 300」");
    expect(buildCommand(table, table)).toBeNull();
  });

  it("merge fast typing in one cell into one command, but keep chat and structure apart", () => {
    let log = appendCommand([], table, { ...table, note: "a" }, {});
    log = appendCommand(log, { ...table, note: "a" }, { ...table, note: "ab" }, {});
    expect(log).toHaveLength(1);
    expect(log[0].changes[0]).toMatchObject({ path: "note", after: "ab" });
    log = appendCommand(log, { ...table, note: "ab" }, { ...table, note: "abc" }, { via: "chat" });
    expect(log).toHaveLength(2);
  });

  it("undo a single command without touching later unrelated edits", () => {
    const a = { ...table, rows: [{ ...table.rows[0], value: "500" }, table.rows[1]] };
    const b = { ...a, note: "公交单列" };
    const c1 = buildCommand(table, a)!;
    const c2 = buildCommand(a, b)!;
    expect(revertCommand(b, c1)).toEqual({ ...table, note: "公交单列" });
    expect(laterConflicts([c1, c2], c1)).toEqual([]);
  });

  it("undo deletions and additions of rows, and spot later edits on the same row", () => {
    const removed = { ...table, rows: [table.rows[0]] };
    expect(revertCommand(removed, buildCommand(table, removed)!).rows.map((r) => r.id)).toEqual(["r1", "r2"]);
    const added = { ...table, rows: [...table.rows, { id: "r3", name: "出租车", value: "80" }] };
    const add = buildCommand(table, added)!;
    expect(revertCommand(added, add)).toEqual(table);
    const edited = { ...added, rows: added.rows.map((r) => (r.id === "r3" ? { ...r, value: "90" } : r)) };
    expect(laterConflicts([add, buildCommand(added, edited)!], add)).toHaveLength(1);
  });

  it("names the rows and fields a change touches", () => {
    expect(anchorsOf([{ path: "rows.r1.value", kind: "changed" }])).toEqual(expect.arrayContaining(["rows.r1.value", "rows.r1", "r1", "value"]));
  });
});
