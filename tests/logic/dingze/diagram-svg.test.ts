import { describe, expect, it } from "vitest";

import { emptyStrategyContent } from "@dingze/shared";

import { artifactDiagrams, escapeXml, strategyHouseSvg, strategyMapSvg, wrapText } from "@/lib/dingze/diagram-svg";

describe("diagram text wrapping", () => {
  it("fits CJK text by width and marks a cut with an ellipsis", () => {
    expect(wrapText("一二三四五六", 60, 12)).toEqual(["一二三四五", "六"]);
    expect(wrapText("abc def", 200, 12)).toEqual(["abc def"]);
    expect(wrapText("甲\n乙", 200, 12)).toEqual(["甲", "乙"]);
    const cut = wrapText("一二三四五六七八九十".repeat(3), 60, 12, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1].endsWith("…")).toBe(true);
  });

  it("escapes markup in user text", () => {
    expect(escapeXml(`a<b>&"c"`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;");
  });
});

describe("strategy diagrams", () => {
  const house = {
    ...emptyStrategyContent("house"),
    mission: "让能源更清洁",
    vision: "区域领先的综合能源服务商",
    values: "客户 <第一>",
    goals: { y1: "营收 6 亿", y3: "营收 8 亿", y5: "营收 10 亿" },
    battlefields: [
      { id: "b1", name: "城燃", advantage: "管网", mustWin: "工商业扩容" },
      { id: "b2", name: "光伏", advantage: "客户复用", mustWin: "屋顶光伏" },
    ],
    foundation: { organization: "事业部制", mechanism: "项目跟投", talent: "方案经理" },
  };

  it("draws the house with every section, escaped, as standalone SVG", () => {
    const d = strategyHouseSvg(house, "DZ 能源 · 已定版 v2");
    expect(d.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(d.svg).not.toContain("foreignObject");
    for (const text of ["使命", "让能源更清洁", "经营目标", "营收 10 亿", "第二增长曲线", "屋顶光伏", "落地保障", "项目跟投", "DZ 能源 · 已定版 v2"]) {
      expect(d.svg).toContain(text);
    }
    expect(d.svg).toContain("客户 &lt;第一&gt;");
    expect(d.height).toBeGreaterThan(400);
  });

  it("always draws 六分法 for S1-01 and adds the house only when it was filled in", () => {
    const six = artifactDiagrams("S1-01", { ...emptyStrategyContent("house"), strategyChoice: "一个核心＋三大业务" });
    expect(six.map((d) => d.key)).toEqual(["sixfold"]);
    expect(six[0].diagram.svg).toContain("战略简约六分法表");
    expect(six[0].diagram.svg).toContain("一个核心＋三大业务");
    expect(artifactDiagrams("S1-01", house).map((d) => d.key)).toEqual(["sixfold", "house"]);
    expect(artifactDiagrams("S1-03", house)).toEqual([]);
  });

  it("draws the map with lanes, objectives, cause arrows and synergy lines", () => {
    const d = strategyMapSvg({
      objectives: [
        { id: "f", perspective: "financial", title: "营收 10 亿", note: "" },
        { id: "c1", perspective: "customer", title: "工商业客户", note: "" },
        { id: "c2", perspective: "customer", title: "居民客户", note: "" },
      ],
      links: [
        { id: "l1", from: "c1", to: "f", kind: "cause" },
        { id: "l2", from: "c1", to: "c2", kind: "synergy" },
        { id: "l3", from: "c1", to: "missing", kind: "cause" },
      ],
    });
    for (const text of ["财务", "客户", "内部流程", "学习与成长", "营收 10 亿", "居民客户", "横向协同"]) expect(d.svg).toContain(text);
    expect(d.svg.match(/marker-end="url\(#arrow\)"/g)).toHaveLength(2); // one link + the legend
    expect(d.svg).toContain('stroke-dasharray="6 4"');
  });
});
