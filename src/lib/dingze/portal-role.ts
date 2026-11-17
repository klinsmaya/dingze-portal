import { CONSULTANTS, type ProjectRole } from "@dingze/shared";

// 三类角色（会议纪要 2026-11）：普通员工 / 企业管理员 / 咨询师。不新增角色，只是把项目角色和
// 系统角色折成这三类，指南、首卡和面板按它显示。

export type PortalRole = "employee" | "lead" | "consultant";

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = {
  employee: "普通员工",
  lead: "企业管理员",
  consultant: "咨询师",
};

/** Inside a project: by the project role (咨询管理员 counts as a consultant). */
export function portalRoleOf(projectRole: ProjectRole | null | undefined, isConsultAdmin: boolean): PortalRole {
  if (isConsultAdmin || (projectRole && CONSULTANTS.includes(projectRole))) return "consultant";
  if (projectRole === "ent_lead") return "lead";
  return "employee";
}

/**
 * Inside a project, for an account that may have no project role: 运营 and 咨询管理员 open projects
 * they are not members of, and must not be shown the 普通员工 guide (测试反馈 9).
 */
export function portalRoleIn(projectRole: ProjectRole | null | undefined, isConsultAdmin: boolean, systemRoles: readonly string[]): PortalRole {
  if (projectRole || isConsultAdmin) return portalRoleOf(projectRole, isConsultAdmin);
  return portalRoleFromSystem(systemRoles);
}

/** Outside a project (使用指南页): by the account's system roles. */
export function portalRoleFromSystem(roles: readonly string[]): PortalRole {
  if (roles.some((r) => r === "dz_consultant" || r === "dz_consult_admin" || r === "dz_ops" || r === "root")) return "consultant";
  if (roles.includes("dz_ent_admin")) return "lead";
  return "employee";
}

/**
 * 项目里左上角品牌「自驱战略」去哪（用户 2026-11-17 定）：企业管理员去「我的项目」做项目、人员管理，
 * 普通员工回本项目总览接着填。按账号的系统角色分，和有几个项目无关：以前一律去 /projects，只有一个
 * 项目的账号又被带回总览，所以免费注册的和运营开通的账号去处不同。咨询侧和运营跨项目工作，也去列表。
 */
export function brandHome(systemRoles: readonly string[], projectId: number): { to: string; label: string } {
  if (portalRoleFromSystem(systemRoles) === "employee") return { to: `/projects/${projectId}/overview`, label: "总览" };
  // ?all=1：只有一个项目也停在列表，不自动进项目。
  return { to: "/projects?all=1", label: "我的项目" };
}
