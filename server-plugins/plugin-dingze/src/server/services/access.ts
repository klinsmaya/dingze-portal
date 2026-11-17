import type { Context } from '@nocobase/actions';

import { type Actor, type ProjectRole, effectiveProjectRole, isEnterpriseAccount } from '../../shared';

export const SYSTEM_ROLES = {
  consultAdmin: 'dz_consult_admin',
  consultant: 'dz_consultant',
  entAdmin: 'dz_ent_admin',
  entMember: 'dz_ent_member',
  ops: 'dz_ops',
} as const;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function currentUserId(ctx: Context): number {
  const id = ctx.auth?.user?.id;
  if (!id) throw new HttpError(401, '请先登录');
  return id;
}

export async function userRoleNames(ctx: Context): Promise<string[]> {
  const user = await ctx.db.getRepository('users').findOne({
    filterByTk: currentUserId(ctx),
    appends: ['roles'],
  });
  return (user?.get('roles') ?? []).map((r: any) => r.get('name'));
}

export async function userSpaceNames(ctx: Context): Promise<string[]> {
  const spaces = await ctx.db.getRepository('spaces').find({
    filter: { 'users.id': currentUserId(ctx) },
    fields: ['name'],
  });
  return spaces.map((s: any) => s.get('name'));
}

export interface SystemAccess {
  roles: string[];
  isRoot: boolean;
  isConsultAdmin: boolean;
  isOps: boolean;
  /** 企业管理员（系统角色）。管哪家企业由空间成员关系决定，调用处自己核对。 */
  isEntAdmin: boolean;
  /** 企业侧账号：企业管理员或企业成员。 */
  isEnterpriseAccount: boolean;
}

export async function systemAccess(ctx: Context): Promise<SystemAccess> {
  const roles = await userRoleNames(ctx);
  const isRoot = roles.includes('root');
  return {
    roles,
    isRoot,
    isConsultAdmin: isRoot || roles.includes(SYSTEM_ROLES.consultAdmin),
    isOps: isRoot || roles.includes(SYSTEM_ROLES.ops) || roles.includes(SYSTEM_ROLES.consultAdmin),
    isEntAdmin: roles.includes(SYSTEM_ROLES.entAdmin),
    isEnterpriseAccount: isEnterpriseAccount(roles),
  };
}

export function requireOps(access: SystemAccess) {
  if (!access.isOps) throw new HttpError(403, '只有运营管理员或咨询管理员可以执行这个操作');
}

export interface ProjectContext {
  project: any;
  spaceName: string;
  projectRole: ProjectRole | null;
  /** 已被加进项目成员。本企业账号没加进来也能看（projectRole 为只读），这时是 false。 */
  joined: boolean;
  access: SystemAccess;
  actor: Actor;
}

/**
 * Load a project the current user may see: they must belong to the project's space and
 * be a project member, an account of the enterprise itself (企业管理员、企业成员：没加进项目的
 * 按只读成员), or a consulting admin / ops admin.
 */
export async function loadProjectContext(ctx: Context, projectId: unknown): Promise<ProjectContext> {
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '缺少项目');
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: id });
  if (!project) throw new HttpError(404, '项目不存在或无权访问');

  const spaceName = project.get('spaceName') as string;
  const spaces = await userSpaceNames(ctx);
  if (!spaces.includes(spaceName)) throw new HttpError(404, '项目不存在或无权访问');

  const access = await systemAccess(ctx);
  if (!access.isOps) {
    const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: project.get('enterpriseId') });
    if (enterprise?.get('status') === 'suspended') throw new HttpError(403, '该企业已停用，请联系咨询机构', 'ENTERPRISE_SUSPENDED');
  }
  const membership = await ctx.db.getRepository('dz_project_members').findOne({
    filter: { projectId: id, userId: currentUserId(ctx) },
  });
  // 一家企业一个空间：上面已经核对过空间，所以这里的企业侧账号就是本企业的人。
  const projectRole = effectiveProjectRole(membership?.get('projectRole') as ProjectRole | undefined, access.roles);
  if (!projectRole && !access.isConsultAdmin && !access.isOps) {
    throw new HttpError(404, '项目不存在或无权访问');
  }
  return {
    project,
    spaceName,
    projectRole,
    joined: !!membership,
    access,
    actor: { projectRole, isConsultAdmin: access.isConsultAdmin, service: project.get('service') === 'self' ? 'self' : 'guided' },
  };
}
