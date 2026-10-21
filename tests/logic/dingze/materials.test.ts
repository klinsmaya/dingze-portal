import { describe, expect, it } from "vitest";

import { profileBrief, profileItem, reconcileProfile, searchSnippets } from "@dingze/shared";

describe("materials search", () => {
  const materials = [
    { id: 1, title: "2025 年经营总结", text: "2025 年售气量 900 万方，车用气占 40%。物流车队客户流失明显，站点覆盖不足。" + "其他内容。".repeat(80) + "人才：缺少综合能源方案经理。" },
    { id: 2, title: "行业报告", text: "LNG 重卡渗透率上升，物流车队加速换代。" },
  ];

  it("returns windows around the terms, most terms first", () => {
    const hits = searchSnippets(materials, "物流车队 售气量");
    expect(hits[0]).toMatchObject({ materialId: "1", title: "2025 年经营总结", hits: 2 });
    expect(hits.map((h) => h.materialId)).toContain("2");
    expect(searchSnippets(materials, "方案经理")[0].snippet).toContain("缺少综合能源方案经理");
    expect(searchSnippets(materials, "  ")).toEqual([]);
  });
});

describe("enterprise profile", () => {
  const draft = profileItem({ id: "a", topic: "售气量", content: "900 万方" });

  it("lets consultants review and only the enterprise lead confirm", () => {
    const reviewed = { items: [{ ...draft, status: "reviewed" as const }] };
    expect(reconcileProfile({ items: [draft] }, reviewed, "member", false).error).toContain("只有咨询师");
    expect(reconcileProfile({ items: [draft] }, reviewed, "lead_consultant", false).error).toBeNull();
    const confirmed = { items: [{ ...draft, status: "confirmed" as const }] };
    expect(reconcileProfile(reviewed, confirmed, "lead_consultant", false).error).toContain("企业项目负责人");
    expect(reconcileProfile(reviewed, confirmed, "ent_lead", false).error).toBeNull();
  });

  it("drops a confirmation when someone else edits the text, and tidies bad values", () => {
    const confirmed = { items: [{ ...draft, status: "confirmed" as const }] };
    const edited = reconcileProfile(confirmed, { items: [{ ...draft, content: "950 万方", status: "confirmed" }] }, "member", false);
    expect(edited.profile.items[0].status).toBe("draft");
    const odd = reconcileProfile({ items: [] }, { items: [{ ...draft, id: "b", category: "x" as never }] }, "member", false);
    expect(odd.profile.items[0].category).toBe("todo");
  });

  it("briefs reviewed items before drafts", () => {
    const brief = profileBrief({ items: [draft, profileItem({ category: "assumption", topic: "气价", content: "保持稳定", status: "reviewed" })] });
    expect(brief.indexOf("【事实】")).toBeGreaterThanOrEqual(0);
    expect(brief).toContain("售气量：900 万方（草稿）");
  });
});
