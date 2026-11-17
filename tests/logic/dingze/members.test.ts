import { describe, expect, it } from "vitest";

import {
  INVITE_DEFAULT_AUTO_APPROVE,
  INVITE_DEFAULT_DAYS,
  accountKind,
  assignableRoles,
  defaultJoinProjectIds,
  defaultLeadId,
  lastLeadRemoved,
  memberChangeBlocked,
  memberManagerTier,
  normalizeProjectRole,
  passwordProblem,
  roleFitsAccount,
} from "@dingze/shared";

describe("项目角色只留三种", () => {
  it("folds the old roles into the three, and drops 只读成员", () => {
    expect(normalizeProjectRole("ent_lead")).toBe("ent_lead");
    expect(normalizeProjectRole("member")).toBe("member");
    expect(normalizeProjectRole("dept_head")).toBe("member");
    expect(normalizeProjectRole("lead_consultant")).toBe("consultant");
    expect(normalizeProjectRole("co_consultant")).toBe("consultant");
    expect(normalizeProjectRole("consultant")).toBe("consultant");
    // 只读是状态，不是角色：不存进项目成员。
    expect(normalizeProjectRole("readonly")).toBeNull();
    expect(normalizeProjectRole(undefined)).toBeNull();
    expect(normalizeProjectRole("boss")).toBeNull();
  });
});

describe("角色和账号类型要匹配", () => {
  it("sorts accounts into enterprise, consulting and ops", () => {
    expect(accountKind(["dz_ent_admin"])).toBe("enterprise");
    expect(accountKind(["member", "dz_ent_member"])).toBe("enterprise");
    expect(accountKind(["dz_consultant"])).toBe("consulting");
    // 咨询管理员可以被分派为咨询师；只有运营管理员角色的不行。
    expect(accountKind(["dz_consult_admin"])).toBe("consulting");
    expect(accountKind(["dz_ops"])).toBe("ops");
    expect(accountKind(["member"])).toBe("other");
  });

  it("gives enterprise roles only to enterprise accounts and 咨询师 only to consulting accounts", () => {
    expect(roleFitsAccount("ent_lead", ["dz_ent_admin"])).toBe(true);
    expect(roleFitsAccount("member", ["dz_ent_member"])).toBe(true);
    expect(roleFitsAccount("consultant", ["dz_consultant"])).toBe(true);
    expect(roleFitsAccount("consultant", ["dz_consult_admin"])).toBe(true);
    expect(roleFitsAccount("consultant", ["dz_ent_member"])).toBe(false);
    expect(roleFitsAccount("member", ["dz_consultant"])).toBe(false);
    expect(roleFitsAccount("ent_lead", ["dz_ops"])).toBe(false);
    expect(roleFitsAccount("readonly", ["dz_ent_member"])).toBe(false);
  });
});

describe("项目成员三级管理", () => {
  it("ranks 运营 › 企业管理员 › 企业项目负责人, and nobody else", () => {
    expect(memberManagerTier({ isOps: true, isEntAdmin: false, projectRole: null })).toBe("ops");
    expect(memberManagerTier({ isOps: false, isEntAdmin: true, projectRole: null })).toBe("entAdmin");
    // 企业管理员不是项目负责人也能管；同时是负责人时按企业管理员。
    expect(memberManagerTier({ isOps: false, isEntAdmin: true, projectRole: "ent_lead" })).toBe("entAdmin");
    expect(memberManagerTier({ isOps: false, isEntAdmin: false, projectRole: "ent_lead" })).toBe("lead");
    expect(memberManagerTier({ isOps: false, isEntAdmin: false, projectRole: "member" })).toBeNull();
    expect(memberManagerTier({ isOps: false, isEntAdmin: false, projectRole: "consultant" })).toBeNull();
    expect(memberManagerTier({ isOps: false, isEntAdmin: false, projectRole: "readonly" })).toBeNull();
  });

  it("lets each tier assign only what it manages", () => {
    expect(assignableRoles("ops")).toEqual(["ent_lead", "member", "consultant"]);
    expect(assignableRoles("entAdmin")).toEqual(["ent_lead", "member"]);
    expect(assignableRoles("lead")).toEqual(["member"]);
    expect(assignableRoles(null)).toEqual([]);
  });

  it("企业项目负责人只能加减项目成员", () => {
    expect(memberChangeBlocked("lead", null, "member")).toBeNull();
    expect(memberChangeBlocked("lead", "member", null)).toBeNull();
    expect(memberChangeBlocked("lead", "member", "ent_lead")).toContain("企业管理员");
    expect(memberChangeBlocked("lead", "ent_lead", null)).toContain("企业管理员");
    expect(memberChangeBlocked("lead", null, "consultant")).toContain("咨询师由运营");
    expect(memberChangeBlocked("lead", "consultant", null)).toContain("咨询师由运营");
  });

  it("企业管理员能换负责人，不能动咨询师；运营都能", () => {
    expect(memberChangeBlocked("entAdmin", "member", "ent_lead")).toBeNull();
    expect(memberChangeBlocked("entAdmin", "ent_lead", "member")).toBeNull();
    expect(memberChangeBlocked("entAdmin", "ent_lead", null)).toBeNull();
    expect(memberChangeBlocked("entAdmin", "consultant", null)).toContain("咨询师由运营");
    expect(memberChangeBlocked("ops", null, "consultant")).toBeNull();
    expect(memberChangeBlocked("ops", "consultant", null)).toBeNull();
    expect(memberChangeBlocked("ops", "ent_lead", "member")).toBeNull();
  });

  it("没有级别的人什么都不能动；没变化的不算改动", () => {
    expect(memberChangeBlocked(null, null, "member")).toContain("只有");
    expect(memberChangeBlocked("lead", "ent_lead", "ent_lead")).toBeNull();
  });

  it("不能把最后一位企业项目负责人改没了", () => {
    const lead = { projectRole: "ent_lead" as const };
    const member = { projectRole: "member" as const };
    expect(lastLeadRemoved([lead, member], [member])).toBe(true);
    expect(lastLeadRemoved([lead, lead], [lead])).toBe(false);
    expect(lastLeadRemoved([lead, member], [member, lead])).toBe(false);
    // 本来就没有负责人的项目（老数据）：别的改动不拦。
    expect(lastLeadRemoved([member], [member, member])).toBe(false);
  });
});

describe("默认值", () => {
  it("新建项目默认的企业项目负责人是最早开通的企业管理员", () => {
    expect(defaultLeadId([])).toBeNull();
    expect(defaultLeadId([{ id: 9, createdAt: "2026-03-01T00:00:00Z" }, { id: 4, createdAt: "2026-05-01T00:00:00Z" }])).toBe(9);
    // 没有开通时间的排在后面；时间一样按账号先后。
    expect(defaultLeadId([{ id: 9 }, { id: 4, createdAt: "2026-05-01T00:00:00Z" }])).toBe(4);
    expect(defaultLeadId([{ id: 9 }, { id: 4 }])).toBe(4);
  });

  it("开通账号默认加入本企业所有进行中的项目，已归档的不选", () => {
    expect(defaultJoinProjectIds([{ id: 1, status: "active" }, { id: 2, status: "archived" }, { id: 3 }])).toEqual([1, 3]);
    expect(defaultJoinProjectIds([])).toEqual([]);
  });

  it("邀请码默认免审核、14 天", () => {
    expect(INVITE_DEFAULT_AUTO_APPROVE).toBe(true);
    expect(INVITE_DEFAULT_DAYS).toBe(14);
  });

  it("改密码时的密码规则", () => {
    expect(passwordProblem("abc12345")).toBeNull();
    expect(passwordProblem("abc123")).toContain("8 到 64");
    expect(passwordProblem("abcdefgh")).toContain("字母和数字");
    expect(passwordProblem("12345678")).toContain("字母和数字");
  });
});
