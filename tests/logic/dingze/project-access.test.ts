import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROJECT_FILE_COLLECTION,
  PROJECT_KEPT_COLLECTIONS,
  PROJECT_OWNED_COLLECTIONS,
  canManageProjects,
  deleteConfirmed,
  effectiveProjectRole,
  isEnterpriseAccount,
  nextAction,
} from "@dingze/shared";

import { projectRoleLabel, splitArchived } from "@/lib/dingze/project-list";

describe("本企业账号默认能看到本企业的项目", () => {
  it("treats an enterprise account that was never added to the project as a read-only member", () => {
    // 企业管理员直接开通的账号：只进了企业空间，没有项目成员记录。
    expect(effectiveProjectRole(null, ["dz_ent_member"])).toBe("readonly");
    expect(effectiveProjectRole(undefined, ["member", "dz_ent_admin"])).toBe("readonly");
  });

  it("keeps the role set in the project members (邀请码、运营分派的)", () => {
    expect(effectiveProjectRole("member", ["dz_ent_member"])).toBe("member");
    expect(effectiveProjectRole("ent_lead", ["dz_ent_admin"])).toBe("ent_lead");
    expect(effectiveProjectRole("lead_consultant", ["dz_consultant"])).toBe("lead_consultant");
  });

  it("gives accounts outside the enterprise no role: consultants still need to be assigned", () => {
    expect(effectiveProjectRole(null, ["dz_consultant"])).toBeNull();
    expect(effectiveProjectRole(null, ["dz_ops"])).toBeNull();
    expect(effectiveProjectRole(null, [])).toBeNull();
    expect(isEnterpriseAccount(["dz_consultant", "member"])).toBe(false);
  });

  it("offers a not-joined enterprise account the view-only next step", () => {
    const steps = [{ code: "S1-01", status: "in_progress" as const, stale: false, unlocked: true }];
    const role = effectiveProjectRole(null, ["dz_ent_member"]);
    expect(nextAction(steps, role, "self").kind).toBe("view");
  });

  it("labels the card by how the account got to see the project", () => {
    expect(projectRoleLabel({ projectRole: "member", joined: true })).toBe("项目成员");
    expect(projectRoleLabel({ projectRole: "readonly", joined: true })).toBe("只读成员");
    expect(projectRoleLabel({ projectRole: "readonly", joined: false })).toBe("只读查看（未加入项目）");
    expect(projectRoleLabel({ projectRole: null })).toBe("管理员查看");
    // 老版本的服务端不返回 joined：照项目角色显示。
    expect(projectRoleLabel({ projectRole: "ent_lead" })).toBe("企业项目负责人");
  });
});

describe("归档与删除项目", () => {
  it("lets ops, consulting admins and enterprise admins manage projects, nobody else", () => {
    expect(canManageProjects(["dz_ent_admin"])).toBe(true);
    expect(canManageProjects(["dz_ops"])).toBe(true);
    expect(canManageProjects(["dz_consult_admin"])).toBe(true);
    expect(canManageProjects(["root"])).toBe(true);
    expect(canManageProjects(["dz_ent_member"])).toBe(false);
    expect(canManageProjects(["dz_consultant"])).toBe(false);
    expect(canManageProjects([])).toBe(false);
  });

  it("requires the project name typed back exactly (surrounding spaces aside)", () => {
    expect(deleteConfirmed("2027 年度战略落地", "2027 年度战略落地")).toBe(true);
    expect(deleteConfirmed("2027 年度战略落地", "  2027 年度战略落地 ")).toBe(true);
    expect(deleteConfirmed("2027 年度战略落地", "2027年度战略落地")).toBe(false);
    expect(deleteConfirmed("2027 年度战略落地", "")).toBe(false);
    expect(deleteConfirmed("2027 年度战略落地", undefined)).toBe(false);
    expect(deleteConfirmed("Plan A", "plan a")).toBe(false);
    // 没有名称的项目不能靠空输入删掉。
    expect(deleteConfirmed("  ", "  ")).toBe(false);
  });

  it("keeps archived projects apart from the ones in progress", () => {
    const projects = [
      { id: 1, status: "active" },
      { id: 2, status: "archived" },
      { id: 3, status: "active" },
    ];
    const { active, archived } = splitArchived(projects);
    expect(active.map((p) => p.id)).toEqual([1, 3]);
    expect(archived.map((p) => p.id)).toEqual([2]);
  });

  it("decides for every table that carries a projectId whether it goes with the project", () => {
    const dir = path.resolve(__dirname, "../../../server-plugins/plugin-dingze/src/server/collections");
    const withProjectId = fs
      .readdirSync(dir)
      .filter((file) => file.startsWith("dz_") && fs.readFileSync(path.join(dir, file), "utf8").includes("projectId"))
      .map((file) => file.replace(/\.ts$/, ""))
      // 项目表自己只是在 hasMany 里提到 projectId。
      .filter((name) => name !== "dz_projects")
      .sort();
    const decided = [...PROJECT_OWNED_COLLECTIONS, ...PROJECT_KEPT_COLLECTIONS, PROJECT_FILE_COLLECTION].sort();
    expect(decided).toEqual(withProjectId);
    expect(new Set(decided).size).toBe(decided.length);
  });

  it("removes versions before the tables they belong to, and dissents before versions", () => {
    const at = (name: string) => PROJECT_OWNED_COLLECTIONS.indexOf(name);
    expect(at("dz_artifact_versions")).toBeLessThan(at("dz_artifacts"));
    expect(at("dz_dissents")).toBeLessThan(at("dz_artifact_versions"));
  });
});
