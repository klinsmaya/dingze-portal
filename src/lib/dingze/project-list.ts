import { PROJECT_ROLE_LABELS, isArchivedProject } from "@dingze/shared";

import type { ProjectSummary } from "./api";

// 「我的项目」的分页查询（2026-11 测试反馈）：咨询师手上的项目很多，按名称 / 企业搜、按年度筛，再分页。
// 列表是一次取回的，查询和分页都在本机做。

export const PROJECT_PAGE_SIZE = 12;

export type ProjectQuery = { q: string; year: number | null };

type Listed = Pick<ProjectSummary, "name" | "year" | "enterprise">;

/** 进行中和已归档分开放：列表默认只看进行中的，已归档的收在另一个页签里。 */
export function splitArchived<T extends Pick<ProjectSummary, "status">>(projects: T[]): { active: T[]; archived: T[] } {
  return { active: projects.filter((p) => !isArchivedProject(p)), archived: projects.filter(isArchivedProject) };
}

/** 卡片上的身份：加进项目的显示项目角色；本企业账号没加进来的是只读查看；运营、咨询管理员是管理员查看。 */
export function projectRoleLabel(project: Pick<ProjectSummary, "projectRole" | "joined">): string {
  if (!project.projectRole) return "管理员查看";
  if (project.joined === false || project.projectRole === "readonly") return "只读查看（未加入项目）";
  return PROJECT_ROLE_LABELS[project.projectRole];
}

/** 项目里出现过的年度，新的在前。 */
export function projectYears(projects: Pick<ProjectSummary, "year">[]): number[] {
  return [...new Set(projects.map((p) => p.year))].sort((a, b) => b - a);
}

/** 按项目名、企业全称或简称搜（不分大小写，空格分开的词都要命中），再按年度筛。 */
export function filterProjects<T extends Listed>(projects: T[], { q, year }: ProjectQuery): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return projects.filter((p) => {
    if (year !== null && p.year !== year) return false;
    const text = `${p.name} ${p.enterprise?.name ?? ""} ${p.enterprise?.shortName ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** 取一页；页码超出范围时落到最后一页（筛选后结果变少时不会停在空页）。 */
export function pageOf<T>(items: T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}
