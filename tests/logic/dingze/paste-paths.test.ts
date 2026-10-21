import { describe, expect, it } from "vitest";

import { parsePastedPaths } from "@/lib/dingze/paste-paths";

describe("parsePastedPaths", () => {
  it("reads the wide layout copied from Excel, merged cells continuing the row above", () => {
    const text = ["开发新客户\t新增售气量\t700万方\t吸引车用客户\t新增售气量\t500万方", "\t\t\t争取公交用户\t新增售气量\t120万方", "开拓点供\t新增售气量\t300万方"].join("\n");
    const nodes = parsePastedPaths(text);
    expect(nodes.map((n) => [n.path, n.level])).toEqual([
      ["开发新客户", 1],
      ["吸引车用客户", 2],
      ["争取公交用户", 2],
      ["开拓点供", 1],
    ]);
    expect(nodes[2].parentId).toBe(nodes[0].id);
    expect(nodes[1].amount).toBe(500);
  });

  it("skips a deeper cell without a parent", () => {
    expect(parsePastedPaths("\t\t\t孤立二级\t指标\t1")).toEqual([]);
  });
});

describe("template header", () => {
  it("skips the template's header row", () => {
    const nodes = parsePastedPaths("一级路径\t衡量指标\t指标值\t二级路径\t衡量指标\t指标值\n开拓点供新业务\t新增售气量\t300万方");
    expect(nodes.map((n) => n.path)).toEqual(["开拓点供新业务"]);
  });
});
