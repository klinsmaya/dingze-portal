import type { Context } from '@nocobase/actions';

import { HttpError, currentUserId, systemAccess, userSpaceNames } from './access';

const CONSULTANT_ROLES = ['lead_consultant', 'co_consultant'];

/**
 * 咨询师工作台: every project the caller consults on (consulting admins: every project in
 * their spaces) with the state of each started artifact, across enterprise spaces.
 */
export async function consultantBoard(ctx: Context) {
  const userId = currentUserId(ctx);
  const access = await systemAccess(ctx);
  const spaces = await userSpaceNames(ctx);
  if (spaces.length === 0) return { projects: [] };

  const memberships = await ctx.db.getRepository('dz_project_members').find({
    filter: { userId, spaceName: { $in: spaces }, projectRole: { $in: CONSULTANT_ROLES } },
  });
  const roleByProject = new Map(memberships.map((m: any) => [m.get('projectId') as number, m.get('projectRole') as string]));
  if (!access.isConsultAdmin && roleByProject.size === 0) {
    if (!access.roles.some((r) => r === 'dz_consultant' || r === 'dz_ops')) {
      throw new HttpError(403, '咨询师工作台只对咨询团队开放');
    }
    return { projects: [] };
  }

  const projectFilter = access.isConsultAdmin
    ? { spaceName: { $in: spaces }, status: { $ne: 'archived' } }
    : { id: { $in: [...roleByProject.keys()] }, status: { $ne: 'archived' } };
  const projects = await ctx.db.getRepository('dz_projects').find({
    filter: projectFilter,
    appends: ['enterprise'],
    sort: ['-year', '-createdAt'],
  });
  const ids = projects.map((p: any) => p.get('id'));
  const artifacts = ids.length
    ? await ctx.db.getRepository('dz_artifacts').find({
        filter: { projectId: { $in: ids } },
        fields: ['projectId', 'code', 'status', 'stale', 'staleReason', 'currentRev', 'updatedAt'],
      })
    : [];
  const byProject = new Map<number, any[]>();
  for (const a of artifacts) {
    const pid = a.get('projectId') as number;
    byProject.set(pid, [
      ...(byProject.get(pid) ?? []),
      {
        code: a.get('code'),
        status: a.get('status'),
        stale: !!a.get('stale'),
        staleReason: a.get('staleReason') ?? null,
        currentRev: a.get('currentRev') ?? 0,
        updatedAt: a.get('updatedAt') ?? null,
      },
    ]);
  }

  return {
    projects: projects.map((p: any) => {
      const enterprise = p.get('enterprise');
      return {
        id: p.get('id'),
        name: p.get('name'),
        year: p.get('year'),
        spaceName: p.get('spaceName'),
        primaryExpression: p.get('primaryExpression'),
        projectRole: roleByProject.get(p.get('id')) ?? null,
        enterprise: enterprise
          ? { id: enterprise.get('id'), name: enterprise.get('name'), shortName: enterprise.get('shortName'), status: enterprise.get('status') }
          : null,
        artifacts: byProject.get(p.get('id')) ?? [],
      };
    }),
  };
}
