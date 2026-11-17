import { describe, expect, it } from "vitest";

import { type MemberRow, memberWarnings } from "@/lib/dingze/project-members";

const row = (userId: number, projectRole: MemberRow["projectRole"]): MemberRow => ({ userId, projectRole });

describe("项目人手提醒", () => {
  it("warns about missing decision makers", () => {
    expect(memberWarnings([row(3, "member")])).toEqual([expect.stringContaining("咨询师"), expect.stringContaining("企业项目负责人")]);
    expect(memberWarnings([row(1, "consultant"), row(2, "ent_lead")])).toEqual([]);
  });

  it("does not ask a self-service project for a consultant", () => {
    expect(memberWarnings([row(2, "ent_lead")], "self")).toEqual([]);
  });
});
