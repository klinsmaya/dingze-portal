import { describe, expect, it } from "vitest";

import type { ProjectSummary } from "@/lib/dingze/api";
import { canRevealHidden, createOffer, projectListEntries } from "@/lib/dingze/project-list";

function project(partial: Pick<ProjectSummary, "id" | "hidden" | "canGovern"> & Partial<ProjectSummary>): ProjectSummary {
  return {
    name: "年度战略落地",
    year: 2026,
    scene: "inhouse",
    primaryExpression: "sixfold",
    keyProjectLevel: 2,
    scheduleScale: "month",
    status: "active",
    spaceName: "dz-test",
    projectRole: "member",
    ...partial,
  };
}

const enterprises = [
  { id: 1, name: "甲企业", allowSelfProject: false, status: "suspended" as const },
  { id: 2, name: "乙企业", allowSelfProject: true, status: "active" as const },
  { id: 3, name: "丙企业", status: "active" as const },
];

describe("createOffer", () => {
  it("gives ops every listed enterprise, ahead of an enterprise admin", () => {
    expect(createOffer({ ops: true, entAdmin: true }, enterprises)).toEqual({
      kind: "ops",
      enterprises: [
        { id: 1, name: "甲企业" },
        { id: 2, name: "乙企业" },
        { id: 3, name: "丙企业" },
      ],
    });
  });

  it("offers an enterprise admin only active enterprises that allow a self project", () => {
    expect(createOffer({ ops: false, entAdmin: true }, enterprises)).toEqual({
      kind: "own",
      enterprises: [{ id: 2, name: "乙企业" }],
    });
    expect(createOffer({ ops: false, entAdmin: true }, [enterprises[0]])).toBeNull();
    expect(createOffer({ ops: false, entAdmin: true }, [enterprises[2]])).toBeNull();
  });

  it("returns null when nobody can create, or the enterprise list is empty", () => {
    expect(createOffer({ ops: false, entAdmin: false }, enterprises)).toBeNull();
    expect(createOffer({ ops: true, entAdmin: true }, [])).toBeNull();
  });
});

describe("projectListEntries", () => {
  const rows = [
    project({ id: 7, hidden: false, canGovern: false, next: { kind: "fill", code: "S1-01", label: "继续填：公司级年度目标", hint: "还没写完" } }),
    project({ id: 8, hidden: true, canGovern: false }),
    project({ id: 3, hidden: true, canGovern: true, status: "archived" }),
    project({ id: 9, hidden: false, canGovern: true }),
  ];

  it("keeps server order, drops hidden rows, and puts the sample last with an overview href", () => {
    const entries = projectListEntries(rows, false);
    expect(entries.map((entry) => (entry.kind === "project" ? entry.href : entry.href))).toEqual([
      "/projects/7/overview",
      "/projects/9/overview",
      "/sample",
    ]);
    expect(entries[0]).toMatchObject({ kind: "project", project: { id: 7 } });
    expect(entries.at(-1)).toEqual({
      kind: "sample",
      href: "/sample",
      enterprise: "瀚川燃气有限公司",
      name: "2026 年度战略落地",
      year: 2026,
    });
    expect(entries.at(-1)).not.toHaveProperty("project");
  });

  it("reveals a hidden row only when showHidden is on and the viewer can govern it", () => {
    const entries = projectListEntries(rows, true);
    expect(entries.flatMap((entry) => (entry.kind === "project" ? [entry.project.id] : []))).toEqual([7, 3, 9]);
    expect(canRevealHidden(rows)).toBe(true);
    expect(canRevealHidden(rows.filter((row) => !row.canGovern))).toBe(false);
    expect(canRevealHidden([])).toBe(false);
  });

  it("still ends with the sample when no project row is visible", () => {
    expect(projectListEntries([project({ id: 8, hidden: true, canGovern: false })], true)).toEqual([
      {
        kind: "sample",
        href: "/sample",
        enterprise: "瀚川燃气有限公司",
        name: "2026 年度战略落地",
        year: 2026,
      },
    ]);
  });
});
