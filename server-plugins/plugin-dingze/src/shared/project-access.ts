import type { ProjectRole } from './lifecycle';

// 本企业的项目谁能看、谁能管（2026-11-17 客户反馈）：
// - 企业管理员直接开通的账号只进了企业空间，没有被加进任何项目，所以「我的项目」是空的；凭邀请码
//   进来的人会被加进码上绑定的项目，所以看得到。现在本企业账号默认能看到本企业的所有项目。
// - 企业管理员可以归档、恢复、删除本企业的项目（以前只有运营能归档，谁都不能删）。

/** 企业侧的系统角色：企业管理员、企业成员。 */
export const ENTERPRISE_SYSTEM_ROLES: readonly string[] = ['dz_ent_admin', 'dz_ent_member'];
const OPS_SYSTEM_ROLES: readonly string[] = ['root', 'dz_ops', 'dz_consult_admin'];

export function isEnterpriseAccount(systemRoles: readonly string[]): boolean {
  return systemRoles.some((r) => ENTERPRISE_SYSTEM_ROLES.includes(r));
}

/**
 * 一个账号在（自己所在企业空间的）某个项目里按什么角色对待：
 * - 加进了项目的，按项目成员里设的角色；
 * - 没加进项目的本企业账号，按只读查看（能看、能批注，不能填写和流转）；
 * - 其余没加进项目的（咨询师等）没有角色。运营和咨询管理员另有系统级的查看权，不在这里。
 */
export function effectiveProjectRole(memberRole: ProjectRole | null | undefined, systemRoles: readonly string[]): ProjectRole | null {
  return memberRole ?? (isEnterpriseAccount(systemRoles) ? 'readonly' : null);
}

/** 谁能归档、恢复、删除项目：运营、咨询管理员，和（本企业的）企业管理员。企业成员、咨询师不能。 */
export function canManageProjects(systemRoles: readonly string[]): boolean {
  return systemRoles.some((r) => OPS_SYSTEM_ROLES.includes(r) || r === 'dz_ent_admin');
}

// ── 删除项目 ─────────────────────────────────────────────────────────
// 删除不可恢复：项目和它名下的数据一起从数据库删掉。下面三张清单合起来必须覆盖所有带 projectId 的表
// （有单元测试对着 collections 目录核对），新增带 projectId 的表时要在这里选一边。

/** 跟着项目一起删的表（按这个顺序删）。 */
export const PROJECT_OWNED_COLLECTIONS: readonly string[] = [
  'dz_notifications',
  'dz_exports',
  'dz_comments',
  'dz_proposals',
  'dz_dissents',
  'dz_step_exceptions',
  'dz_expert_requests',
  'dz_artifact_versions',
  'dz_artifacts',
  'dz_profiles',
  'dz_materials',
  'dz_project_members',
];

/**
 * 不跟着删的表：
 * - dz_audit_events：留痕（谁在什么时候删了哪个项目），不含表的内容；
 * - dz_guidance_gaps：平台级的方法缺口反馈，归运营；
 * - dz_ai_sessions：数字咨询师用量的归属（只有会话号和项目号），留着对账；
 * - dz_invites：绑定这个项目的邀请码停用并解绑，申请记录保留。
 */
export const PROJECT_KEPT_COLLECTIONS: readonly string[] = ['dz_audit_events', 'dz_guidance_gaps', 'dz_ai_sessions', 'dz_invites'];

/** 资料原件（文件）：数据库事务提交后逐个删除，连同存储里的文件。 */
export const PROJECT_FILE_COLLECTION = 'dz_material_files';

/** 删除前要原样输入项目名称（首尾空格不计）。 */
export function deleteConfirmed(projectName: string, typed: unknown): boolean {
  const name = projectName.trim();
  return !!name && typeof typed === 'string' && typed.trim() === name;
}

/** 「我的项目」里进行中和已归档分开放。 */
export const isArchivedProject = (project: { status?: string | null }): boolean => project.status === 'archived';
