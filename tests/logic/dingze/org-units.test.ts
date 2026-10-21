import { describe, expect, it } from "vitest";

import type { OrgUnit } from "@/lib/dingze/ops-api";
import { flattenOrgUnits, orgUnitPath } from "@/lib/dingze/org-units";

const unit = (id: number, name: string, parentId: number | null = null, sort = 0): OrgUnit => ({
  id,
  name,
  kind: parentId ? "team" : "department",
  sort,
  parentId,
  headId: null,
});

describe("org unit tree", () => {
  const units = [unit(2, "燃气运营部"), unit(3, "调度中心", 2), unit(1, "战略发展部"), unit(4, "客服中心", 2, -1)];

  it("lists parents before their children, in sort then id order", () => {
    expect(flattenOrgUnits(units).map((u) => `${u.depth}:${u.name}`)).toEqual([
      "0:战略发展部",
      "0:燃气运营部",
      "1:客服中心",
      "1:调度中心",
    ]);
  });

  it("keeps units whose parent is missing at the top level", () => {
    expect(flattenOrgUnits([unit(5, "孤立团队", 99)]).map((u) => u.depth)).toEqual([0]);
  });

  it("builds the path from the top", () => {
    expect(orgUnitPath(units, 3)).toBe("燃气运营部 › 调度中心");
    expect(orgUnitPath(units, null)).toBe("");
  });
});
