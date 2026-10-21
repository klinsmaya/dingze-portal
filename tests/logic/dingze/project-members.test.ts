import { describe, expect, it } from "vitest";

import { type MemberRow, diffMembers, memberWarnings } from "@/lib/dingze/project-members";

const row = (userId: number, projectRole: MemberRow["projectRole"], orgUnitId: number | null = null): MemberRow => ({
  userId,
  projectRole,
  orgUnitId,
});

describe("project member editing", () => {
  it("sends only new or changed members and lists removals", () => {
    const saved = [row(1, "lead_consultant"), row(2, "ent_lead"), row(3, "member", 5)];
    const edited = [row(1, "lead_consultant"), row(3, "dept_head", 5), row(4, "member")];
    expect(diffMembers(saved, edited)).toEqual({ removed: [2], upserts: [row(3, "dept_head", 5), row(4, "member")] });
  });

  it("treats a changed department as a change", () => {
    expect(diffMembers([row(3, "member", 5)], [row(3, "member", 6)]).upserts).toEqual([row(3, "member", 6)]);
  });

  it("warns about missing decision makers", () => {
    expect(memberWarnings([row(3, "member")])).toEqual([
      expect.stringContaining("主咨询师"),
      expect.stringContaining("企业项目负责人"),
    ]);
    expect(memberWarnings([row(1, "lead_consultant"), row(2, "ent_lead")])).toEqual([]);
  });
});
