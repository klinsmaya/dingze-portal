import { describe, expect, it } from "vitest";

import { portalEmployees } from "@/lib/dingze/coach";
import { PROJECTS_LIST_PATH, filterProjects, onlyProjectToEnter, pageOf, projectYears } from "@/lib/dingze/project-list";

const project = (name: string, year: number, enterprise: string, shortName = enterprise) => ({ name, year, enterprise: { id: 1, name: enterprise, shortName } });

const projects = [
  project("2026 年度战略落地", 2026, "瀚川燃气有限公司", "瀚川"),
  project("2025 年度战略落地", 2025, "瀚川燃气有限公司", "瀚川"),
  project("2026 年度经营计划", 2026, "北辰机械股份有限公司", "北辰"),
  { name: "Pilot Plan", year: 2026, enterprise: undefined },
];

describe("我的项目：查询与分页", () => {
  it("searches the project name and the enterprise's full and short name", () => {
    expect(filterProjects(projects, { q: "北辰", year: null }).map((p) => p.name)).toEqual(["2026 年度经营计划"]);
    expect(filterProjects(projects, { q: "燃气", year: null })).toHaveLength(2);
    expect(filterProjects(projects, { q: "  pilot ", year: null })).toHaveLength(1);
    expect(filterProjects(projects, { q: "", year: null })).toHaveLength(4);
  });

  it("requires every word and combines with the year", () => {
    expect(filterProjects(projects, { q: "瀚川 战略", year: 2025 }).map((p) => p.name)).toEqual(["2025 年度战略落地"]);
    expect(filterProjects(projects, { q: "瀚川 经营", year: null })).toEqual([]);
  });

  it("lists the years newest first, once each", () => {
    expect(projectYears(projects)).toEqual([2026, 2025]);
  });

  it("slices a page and falls back to the last page when the filter shrinks the list", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(pageOf(items, 1, 12)).toMatchObject({ page: 1, pages: 3 });
    expect(pageOf(items, 3, 12).items).toEqual([24]);
    expect(pageOf(items, 9, 12)).toMatchObject({ page: 3, pages: 3 });
    expect(pageOf(items, Number.NaN, 12).page).toBe(1);
    expect(pageOf([], 2, 12)).toEqual({ items: [], page: 1, pages: 1 });
  });
});

describe("我的项目：只有一个项目时进不进项目", () => {
  const one = [{ id: 7 }];
  const at = (url: string) => new URL(url, "https://portal.test").searchParams;

  it("enters the only project from the bare login landing", () => {
    expect(onlyProjectToEnter(one, at("/projects"))).toEqual({ id: 7 });
  });

  it("stays on the list when opened from an explicit list entry, even with query, year, page and archive kept", () => {
    expect(onlyProjectToEnter(one, at(PROJECTS_LIST_PATH))).toBeNull();
    expect(onlyProjectToEnter(one, at(`${PROJECTS_LIST_PATH}&q=瀚川&year=2026&page=2&archived=1`))).toBeNull();
    expect(onlyProjectToEnter(one, at("/projects?new=1"))).toBeNull();
  });

  it("stays on the list with none, several or not-yet-loaded projects", () => {
    expect(onlyProjectToEnter([], at("/projects"))).toBeNull();
    expect(onlyProjectToEnter([{ id: 7 }, { id: 8 }], at("/projects"))).toBeNull();
    expect(onlyProjectToEnter(undefined, at("/projects"))).toBeNull();
  });
});

describe("门户里的智能体身份", () => {
  const employee = (username: string) => ({ username });

  it("offers the digital consultants only, in stage order, when they are available", () => {
    const list = [employee("nathan"), employee("dingze-action-coach"), employee("dingze-strategy-coach"), employee("dingze-goal-coach")];
    expect(portalEmployees(list).map((e) => e.username)).toEqual(["dingze-strategy-coach", "dingze-goal-coach", "dingze-action-coach"]);
  });

  it("leaves the list alone when no digital consultant is available", () => {
    const list = [employee("nathan"), employee("dara")];
    expect(portalEmployees(list)).toEqual(list);
  });
});
