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

/** Outside a project (使用指南页): by the account's system roles. */
export function portalRoleFromSystem(roles: readonly string[]): PortalRole {
  if (roles.some((r) => r === "dz_consultant" || r === "dz_consult_admin" || r === "dz_ops" || r === "root")) return "consultant";
  if (roles.includes("dz_ent_admin")) return "lead";
  return "employee";
}
