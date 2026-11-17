import { describe, expect, it } from "vitest";

import { ROLE_GUIDES, faqFor } from "@/lib/dingze/guide";
import { brandHome, portalRoleFromSystem, portalRoleIn, portalRoleOf } from "@/lib/dingze/portal-role";

describe("三类角色", () => {
  it("folds project roles into employee / lead / consultant", () => {
    expect(portalRoleOf("member", false)).toBe("employee");
    expect(portalRoleOf("readonly", false)).toBe("employee");
    expect(portalRoleOf("ent_lead", false)).toBe("lead");
    expect(portalRoleOf("consultant", false)).toBe("consultant");
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
  it("左上角品牌：企业管理员去我的项目，普通员工回本项目总览，和项目数量无关", () => {
    // 免费注册的账号和运营开通的企业管理员是同一个系统角色，去处一样。
    expect(brandHome(["dz_ent_admin"], 7)).toEqual({ to: "/projects?all=1", label: "我的项目" });
    expect(brandHome(["dz_ent_member"], 7)).toEqual({ to: "/projects/7/overview", label: "总览" });
    expect(brandHome([], 7).to).toBe("/projects/7/overview");
    for (const role of ["dz_consultant", "dz_consult_admin", "dz_ops", "root"]) expect(brandHome([role], 7).to).toBe("/projects?all=1");
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
