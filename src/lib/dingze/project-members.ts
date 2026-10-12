import type { ProjectRole } from "@dingze/shared";

export type MemberRow = { userId: number; projectRole: ProjectRole; orgUnitId: number | null };

/** What to send when the edited member list replaces the saved one. */
export function diffMembers(saved: MemberRow[], edited: MemberRow[]) {
  const editedIds = new Set(edited.map((m) => m.userId));
  const savedById = new Map(saved.map((m) => [m.userId, m]));
  return {
    removed: saved.filter((m) => !editedIds.has(m.userId)).map((m) => m.userId),
    upserts: edited.filter((m) => {
      const before = savedById.get(m.userId);
      return !before || before.projectRole !== m.projectRole || (before.orgUnitId ?? null) !== (m.orgUnitId ?? null);
    }),
  };
}

/** Staffing problems the ops admin should see before saving; none of them block saving. */
export function memberWarnings(rows: MemberRow[], service: "guided" | "self" = "guided"): string[] {
  const count = (role: ProjectRole) => rows.filter((m) => m.projectRole === role).length;
  const warnings: string[] = [];
  // 自助项目没有人工咨询师：复核由企业项目负责人自查。
  if (service === "guided" && count("lead_consultant") === 0) warnings.push("还没有主咨询师：陪跑项目的复核、定版和重开都需要主咨询师；不配咨询师请把服务方式改为“自助”。");
  if (count("lead_consultant") > 1) warnings.push("有多位主咨询师：复核意见可能不一致，建议只保留一位。");
  if (count("ent_lead") === 0) warnings.push("还没有企业项目负责人：只有企业项目负责人可以确认定版。");
  const ids = rows.map((m) => m.userId);
  if (new Set(ids).size !== ids.length) warnings.push("同一个人出现了多次，保存时以最后一行为准。");
  return warnings;
}
