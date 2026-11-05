import type { Context } from '@nocobase/actions';

import { PROJECT_DELETE_ORDER, PROJECT_DETACH_COLLECTIONS, canGovernProject, governFacts } from '../../shared';
import { HttpError, SYSTEM_ROLES, currentUserId, systemAccess, userSpaceNames } from './access';
import { audit } from './ops';

function requiredProjectId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '缺少项目');
  return id;
}

async function loadGovernedProject(ctx: Context, projectId: unknown) {
  const id = requiredProjectId(projectId);
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: id });
  if (!project) throw new HttpError(404, '项目不存在或无权访问');
  const spaceName = project.get('spaceName') as string;
  if (!(await userSpaceNames(ctx)).includes(spaceName)) throw new HttpError(404, '项目不存在或无权访问');

  const access = await systemAccess(ctx);
  const membership = await ctx.db.getRepository('dz_project_members').findOne({
    filter: { projectId: id, userId: currentUserId(ctx) },
  });
  const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: project.get('enterpriseId') });
  const facts = governFacts({
    isOps: access.isOps,
    isEntAdmin: access.roles.includes(SYSTEM_ROLES.entAdmin),
    isMember: !!membership,
    allowSelfProject: enterprise?.get('allowSelfProject') === true,
    enterpriseStatus: enterprise?.get('status'),
    scene: project.get('scene'),
    service: project.get('service'),
  });
  if (!canGovernProject(facts)) throw new HttpError(403, '只能删除或隐藏你有权管理的项目');
  return { project, spaceName };
}

export async function setProjectHidden(
  ctx: Context,
  input: { projectId: number; hidden: boolean },
): Promise<{ id: number; hidden: boolean }> {
  if (typeof input.hidden !== 'boolean') throw new HttpError(400, '请指定是否隐藏');
  const { project, spaceName } = await loadGovernedProject(ctx, input.projectId);
  const id = project.get('id') as number;
  if ((project.get('hidden') === true) === input.hidden) return { id, hidden: input.hidden };
  await project.update({ hidden: input.hidden });
  await audit(ctx, spaceName, 'project.hide', { projectId: id, hidden: input.hidden });
  return { id, hidden: input.hidden };
}

export async function deleteProject(ctx: Context, input: { projectId: number }): Promise<{ ok: true }> {
  const loaded = await loadGovernedProject(ctx, input.projectId);
  const projectId = loaded.project.get('id') as number;
  await ctx.db.sequelize.transaction(async (transaction: any) => {
    const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: projectId, transaction });
    if (!project) throw new HttpError(404, '项目不存在或无权访问');
    await audit(ctx, loaded.spaceName, 'project.delete', { projectId }, transaction);
    for (const name of PROJECT_DETACH_COLLECTIONS) {
      await ctx.db.getRepository(name).update({ filter: { projectId }, values: { projectId: null }, transaction });
    }
    await ctx.db.getRepository('dz_artifacts').update({
      filter: { projectId },
      values: { currentVersionId: null, stepDoneVersionId: null, lockedVersionId: null },
      transaction,
    });
    for (const name of PROJECT_DELETE_ORDER) {
      await ctx.db.getRepository(name).destroy({ filter: { projectId }, transaction });
    }
    await ctx.db.getRepository('dz_projects').destroy({ filter: { id: projectId }, transaction });
  });
  return { ok: true };
}
