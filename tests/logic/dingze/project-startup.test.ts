import { describe, expect, it } from "vitest";

import { startupChecklist } from "@/lib/dingze/project-startup";

const dept = (id: number, name: string, headId: number | null) => ({ id, name, kind: "department" as const, parentId: null, headId, sort: id });

describe("startupChecklist", () => {
  it("names who and what is missing, without blocking", () => {
    const items = startupChecklist({
      orgUnits: [dept(1, "市场营销部", 11), dept(2, "燃气运营部", null)],
      team: [
        { userId: 11, nickname: "张总", projectRole: "ent_lead", orgUnitId: 1 },
        { userId: 12, nickname: "刘主管", projectRole: "member", orgUnitId: null },
        { userId: 13, nickname: "陈顾问", projectRole: "lead_consultant", orgUnitId: null },
      ],
      materialCount: 2,
      profileItems: [],
    });
    expect(items.map((i) => i.state)).toEqual(["partial", "partial", "partial"]);
    expect(items[0].notes[0]).toContain("燃气运营部 没有在系统里指定负责人");
    expect(items[0].problems.join("；")).toContain("刘主管 还没归到部门");
    expect(items[0].detail).toBe("2 个部门 · 1 / 2 人已归部门");
    expect(items[1].problems[0]).toContain("画像还是空的");
    expect(items[2].problems[0]).toContain("部门负责人");
  });

  it("is done when the organisation, materials and team are in place", () => {
    const items = startupChecklist({
      orgUnits: [dept(1, "市场营销部", 11)],
      team: [
        { userId: 11, nickname: "张总", projectRole: "ent_lead", orgUnitId: 1 },
        { userId: 12, nickname: "王经理", projectRole: "dept_head", orgUnitId: 1 },
      ],
      materialCount: 1,
      profileItems: [{ id: "p1", category: "fact", topic: "主营", content: "城市燃气", source: "1", status: "confirmed" }],
    });
    expect(items.every((i) => i.state === "done")).toBe(true);
  });
});
