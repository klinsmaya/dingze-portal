import { describe, expect, it } from "vitest";

import { ROLE_GUIDES, faqFor } from "@/lib/dingze/guide";
import { portalRoleFromSystem, portalRoleIn, portalRoleOf } from "@/lib/dingze/portal-role";

describe("三类角色", () => {
  it("folds project roles into employee / lead / consultant", () => {
    expect(portalRoleOf("member", false)).toBe("employee");
    expect(portalRoleOf("dept_head", false)).toBe("employee");
    expect(portalRoleOf("readonly", false)).toBe("employee");
    expect(portalRoleOf("ent_lead", false)).toBe("lead");
    expect(portalRoleOf("lead_consultant", false)).toBe("consultant");
    expect(portalRoleOf("co_consultant", false)).toBe("consultant");
    expect(portalRoleOf(null, true)).toBe("consultant");
    expect(portalRoleOf("member", true)).toBe("consultant");
  });
  it("folds system roles the same way outside a project", () => {
    expect(portalRoleFromSystem(["dz_ent_member"])).toBe("employee");
    expect(portalRoleFromSystem([])).toBe("employee");
    expect(portalRoleFromSystem(["dz_ent_admin"])).toBe("lead");
    expect(portalRoleFromSystem(["dz_ent_admin", "dz_consultant"])).toBe("consultant");
    expect(portalRoleFromSystem(["dz_consult_admin"])).toBe("consultant");
    expect(portalRoleFromSystem(["dz_ops"])).toBe("consultant");
  });
  it("uses the system roles inside a project when the account has no project role", () => {
    expect(portalRoleIn(null, false, ["dz_ops"])).toBe("consultant");
    expect(portalRoleIn(null, false, [])).toBe("employee");
    expect(portalRoleIn("member", false, ["dz_ops"])).toBe("employee");
    expect(portalRoleIn("ent_lead", false, [])).toBe("lead");
    expect(portalRoleIn(null, true, [])).toBe("consultant");
  });
  it("keeps every guide within eight lines", () => {
    for (const items of Object.values(ROLE_GUIDES)) {
      expect(items.length).toBeLessThanOrEqual(8);
      expect(items.length).toBeGreaterThan(0);
    }
  });
  it("tells employees to wait for the lead instead of pressing 本步完成", () => {
    expect(faqFor("employee").items[0]).toContain("企业项目负责人");
    expect(faqFor("lead").items[0]).toContain("本步完成");
  });
});
