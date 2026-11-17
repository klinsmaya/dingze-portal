import type { ProjectRole } from "@dingze/shared";

export type MemberRow = { userId: number; projectRole: ProjectRole };

/** 项目人手上要提醒的事（不拦操作）：陪跑项目没有咨询师、没有企业项目负责人。 */
export function memberWarnings(rows: MemberRow[], service: "guided" | "self" = "guided"): string[] {
  const count = (role: ProjectRole) => rows.filter((m) => m.projectRole === role).length;
  const warnings: string[] = [];
  // 自助项目没有人工咨询师：复核由企业项目负责人自查。
  if (service === "guided" && count("consultant") === 0) warnings.push("还没有咨询师：陪跑项目的复核需要咨询师；不配咨询师请把服务方式改为“自助”。");
  if (count("ent_lead") === 0) warnings.push("还没有企业项目负责人：只有企业项目负责人可以确认定版。");
  return warnings;
}
