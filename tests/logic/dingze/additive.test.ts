import { expect, it } from "vitest";

import { additive, unitOf } from "@dingze/shared";

it("unitOf reads the explicit unit or the text after the number", () => {
  expect(unitOf({ unit: "亿元", value: "1.0" })).toBe("亿元");
  expect(unitOf({ value: "100%" })).toBe("%");
  expect(unitOf({ value: "≥95 分" })).toBe("分");
});

// 验收 E D02：改造长度 120 公里 + 安检覆盖率 100% 不能加成 220。
it("additive needs the same metric and unit", () => {
  expect(additive([{ metric: "营业收入", unit: "亿元", value: "17.2" }, { metric: "营业收入", unit: "亿元", value: "2.1" }])).toBe(true);
  expect(additive([{ metric: "改造长度", unit: "公里", value: "120" }, { metric: "安检覆盖率", value: "100%" }])).toBe(false);
  expect(additive([{ metric: "新增售气量", unit: "万方", value: "3200" }, { metric: "新增售气量", unit: "亿方", value: "1" }])).toBe(false);
});
