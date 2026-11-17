import type { ProjectRole } from './lifecycle';

// 加人和项目成员的统一规则（2026-11-17）。纯函数：服务端按它校验，门户按它决定显示什么。
//
// - 账号分三类：企业侧（企业管理员、企业成员）、咨询方（咨询师、咨询管理员）、运营（运营管理员）。
// - 项目角色和账号类型要匹配：企业项目负责人、项目成员只给本企业账号；咨询师只给咨询方账号。
// - 项目成员三级管理：运营 / 咨询管理员 › 企业管理员 › 企业项目负责人。

export type AccountKind = 'enterprise' | 'consulting' | 'ops' | 'other';

const ENTERPRISE_ACCOUNT_ROLES = ['dz_ent_admin', 'dz_ent_member'];
const CONSULTING_ACCOUNT_ROLES = ['dz_consultant', 'dz_consult_admin'];

/** 账号属于哪一边。咨询管理员算咨询方（可以被分派为咨询师）；只有运营管理员角色的算运营。 */
export function accountKind(systemRoles: readonly string[]): AccountKind {
  if (systemRoles.some((r) => ENTERPRISE_ACCOUNT_ROLES.includes(r))) return 'enterprise';
  if (systemRoles.some((r) => CONSULTING_ACCOUNT_ROLES.includes(r))) return 'consulting';
  if (systemRoles.includes('dz_ops')) return 'ops';
  return 'other';
}

/** 这个项目角色能不能给这类账号。 */
export function roleFitsAccount(role: ProjectRole, systemRoles: readonly string[]): boolean {
  const kind = accountKind(systemRoles);
  if (role === 'ent_lead' || role === 'member') return kind === 'enterprise';
  if (role === 'consultant') return kind === 'consulting';
  return false;
}

/** 角色和账号对不上时给人看的话。 */
export function roleMismatchReason(role: ProjectRole, name: string): string {
  return role === 'consultant' ? `${name} 不是咨询方账号，不能分派为咨询师` : `${name} 不是本企业的账号，不能设为企业项目负责人或项目成员`;
}

/** 管理项目成员的三级：运营（含咨询管理员）、本企业的企业管理员、企业项目负责人。其他人不能管。 */
export type MemberTier = 'ops' | 'entAdmin' | 'lead';

export function memberManagerTier(who: { isOps: boolean; isEntAdmin: boolean; projectRole: ProjectRole | null | undefined }): MemberTier | null {
  if (who.isOps) return 'ops';
  if (who.isEntAdmin) return 'entAdmin';
  if (who.projectRole === 'ent_lead') return 'lead';
  return null;
}

/** 各级能分派的项目角色。企业项目负责人只能加减项目成员；换负责人是企业管理员和运营的事；咨询师只有运营能分派。 */
export function assignableRoles(tier: MemberTier | null): ProjectRole[] {
  if (tier === 'ops') return ['ent_lead', 'member', 'consultant'];
  if (tier === 'entAdmin') return ['ent_lead', 'member'];
  if (tier === 'lead') return ['member'];
  return [];
}

/**
 * 一处成员变动（加入、改角色、移出）这一级能不能做。`before` 是变动前的角色（原来不在项目里为 null），
 * `after` 是变动后的（移出为 null）。能做返回 null，不能做返回原因。
 */
export function memberChangeBlocked(tier: MemberTier | null, before: ProjectRole | null, after: ProjectRole | null): string | null {
  if (!tier) return '只有运营管理员、本企业管理员或企业项目负责人可以管理项目成员';
  if (before === after) return null;
  const allowed = assignableRoles(tier);
  const touched = [before, after].filter((r): r is ProjectRole => !!r);
  if (touched.every((r) => allowed.includes(r))) return null;
  if (touched.includes('consultant')) return '咨询师由运营管理员或咨询管理员分派';
  return '更换企业项目负责人请找企业管理员或运营管理员';
}

/** 变动之后项目里还有没有企业项目负责人：原来有、变完没有了就拦下。 */
export function lastLeadRemoved(before: { projectRole: ProjectRole }[], after: { projectRole: ProjectRole }[]): boolean {
  const leads = (rows: { projectRole: ProjectRole }[]) => rows.filter((m) => m.projectRole === 'ent_lead').length;
  return leads(before) > 0 && leads(after) === 0;
}

/** 新建项目默认的企业项目负责人：企业管理员；有多位时取最早开通的（之后可以换）。 */
export function defaultLeadId(admins: { id: number; createdAt?: string | Date | null }[]): number | null {
  if (!admins.length) return null;
  const time = (a: { createdAt?: string | Date | null }) => (a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER);
  return [...admins].sort((a, b) => time(a) - time(b) || a.id - b.id)[0].id;
}

/** 开通账号时默认加入的项目：本企业所有进行中的项目（已归档的不选）。 */
export function defaultJoinProjectIds(projects: { id: number; status?: string | null }[]): number[] {
  return projects.filter((p) => p.status !== 'archived').map((p) => p.id);
}

/** 邀请码的默认口径：免审核、14 天有效。 */
export const INVITE_DEFAULT_DAYS = 14;
export const INVITE_DEFAULT_AUTO_APPROVE = true;

/** 密码规则（和实例的密码策略一致）：8～64 位，同时有字母和数字。不合规返回原因。 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 64) return '密码长度要在 8 到 64 位之间';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '密码要同时包含字母和数字';
  return null;
}
