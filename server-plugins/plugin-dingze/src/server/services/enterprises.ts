import { randomBytes } from 'node:crypto';

import type { Context } from '@nocobase/actions';

import { ENTERPRISE_PROJECT_ROLES, PROJECT_ROLE_LABELS, type ProjectRole, STAGES, nextAction, stageGateCodes } from '../../shared';
import { projectProgress } from './artifacts';
import { HttpError, SYSTEM_ROLES, currentUserId, requireOps, systemAccess, userSpaceNames } from './access';
import { notifyAssignment } from './notify';
import { audit, creator, insertUser, loadEnterpriseScope } from './ops';

const PROJECT_ROLES = Object.keys(PROJECT_ROLE_LABELS) as ProjectRole[];

function text(value: unknown, label: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `请填写${label}`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `${label}不能超过 ${max} 个字`);
  return trimmed;
}

function ids(value: unknown): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, '用户列表格式不正确');
  return [...new Set(value.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
}

async function addUsersToSpace(ctx: Context, spaceName: string, userIds: number[], transaction?: any) {
  if (userIds.length === 0) return;
  await ctx.db.getRepository('spaces.users', spaceName).add({ tk: userIds, transaction });
}

export interface ProvisionInput {
  name: string;
  shortName: string;
  size?: 'large' | 'sme';
  consultantIds?: number[];
  memberIds?: number[];
  /** Create the enterprise admin account in the same step. */
  admin?: { username: string; nickname: string; email?: string; phone?: string };
}

/** 开通企业：建空间 → 企业档案 → 开通人、咨询师、企业成员加入空间。 */
export async function provisionEnterprise(ctx: Context, input: ProvisionInput) {
  requireOps(await systemAccess(ctx));
  const name = text(input.name, '企业名称');
  const shortName = text(input.shortName, '简称', 20);
  const size = input.size === 'large' ? 'large' : 'sme';
  const spaceName = `dz-${randomBytes(5).toString('hex')}`;
  const userIds = [currentUserId(ctx), ...ids(input.consultantIds), ...ids(input.memberIds)];

  return ctx.db.sequelize.transaction(async (transaction: any) => {
    await ctx.db.getRepository('spaces').create({ values: { name: spaceName, title: shortName }, transaction });
    await addUsersToSpace(ctx, spaceName, [...new Set(userIds)], transaction);
    const enterprise = await ctx.db.getRepository('dz_enterprises').create({
      values: { name, shortName, size, status: 'active', spaceName, ...creator(ctx) },
      transaction,
    });
    const admin = input.admin
      ? await insertUser(ctx, { ...input.admin, systemRole: SYSTEM_ROLES.entAdmin }, spaceName, transaction)
      : null;
    return { enterprise: enterprise.toJSON(), spaceName, admin };
  });
}

/** Ops see every enterprise whose space they joined; an enterprise admin sees their own. */
export async function listEnterprises(ctx: Context) {
  const access = await systemAccess(ctx);
  if (!access.isOps && !access.roles.includes(SYSTEM_ROLES.entAdmin)) requireOps(access);
  const spaces = await userSpaceNames(ctx);
  const rows = await ctx.db.getRepository('dz_enterprises').find({
    filter: { spaceName: { $in: spaces } },
    appends: ['projects'],
    sort: ['-createdAt'],
  });
  return rows.map((r: any) => r.toJSON());
}

export interface MemberInput {
  userId: number;
  projectRole: ProjectRole;
  orgUnitId?: number;
}

function members(value: unknown): MemberInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, '成员格式不正确');
  return value.map((m: any) => {
    const userId = Number(m?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, '成员缺少用户');
    if (!PROJECT_ROLES.includes(m?.projectRole)) throw new HttpError(400, '项目角色不正确');
    return { userId, projectRole: m.projectRole, orgUnitId: m.orgUnitId ? Number(m.orgUnitId) : undefined };
  });
}

export interface ProjectInput {
  enterpriseId: number;
  name: string;
  year?: number;
  scene?: 'camp' | 'inhouse';
  service?: 'guided' | 'self';
  campId?: number | null;
  primaryExpression?: 'house' | 'sixfold';
  keyProjectLevel?: 1 | 2;
  scheduleScale?: 'month' | 'quarter';
  members?: MemberInput[];
}

export async function createProject(ctx: Context, input: ProjectInput) {
  requireOps(await systemAccess(ctx));
  const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: Number(input.enterpriseId) });
  if (!enterprise) throw new HttpError(404, '企业不存在');
  const spaceName = enterprise.get('spaceName') as string;
  if (!(await userSpaceNames(ctx)).includes(spaceName)) throw new HttpError(404, '企业不存在');
  return insertProject(ctx, enterprise, input, members(input.members));
}

async function insertProject(ctx: Context, enterprise: any, input: ProjectInput, list: MemberInput[]) {
  const spaceName = enterprise.get('spaceName') as string;
  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const project = await ctx.db.getRepository('dz_projects').create({
      values: {
        enterpriseId: enterprise.get('id'),
        name: text(input.name, '项目名称'),
        year: input.year ? Number(input.year) : new Date().getFullYear(),
        scene: input.scene === 'inhouse' ? 'inhouse' : 'camp',
        service: input.service === 'self' ? 'self' : 'guided',
        ...(input.campId ? { campId: Number(input.campId) } : {}),
        // 六分法 is required for every project (spec Q14); the house is optional inside S1-01.
        primaryExpression: 'sixfold',
        keyProjectLevel: input.keyProjectLevel === 1 ? 1 : 2,
        scheduleScale: input.scheduleScale === 'quarter' ? 'quarter' : 'month',
        spaceName,
        ...creator(ctx),
      },
      transaction,
    });
    await upsertMembers(ctx, project.get('id'), spaceName, list, transaction);
    return project.toJSON();
  });
}

/**
 * 企业管理员自建项目（运营按企业打开开关后）：企业内训 · 自助，只能分派本企业账号的企业侧角色，
 * 至少一位企业项目负责人。需要咨询师陪跑时由运营改服务方式并分派咨询师。
 */
export async function createOwnProject(ctx: Context, input: ProjectInput) {
  const { enterprise, spaceName, access } = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  if (!access.isOps) {
    if (!enterprise.get('allowSelfProject')) throw new HttpError(403, '本企业还没开通自建项目，请联系运营', 'SELF_PROJECT_OFF');
    if (enterprise.get('status') === 'suspended') throw new HttpError(403, '该企业已停用，请联系咨询机构', 'ENTERPRISE_SUSPENDED');
  }
  const year = input.year ? Number(input.year) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, '年度不正确');
  const list = members(input.members);
  if (list.some((m) => !ENTERPRISE_PROJECT_ROLES.includes(m.projectRole))) throw new HttpError(400, '自建项目只能分派企业侧角色；咨询师由运营分派');
  if (!list.some((m) => m.projectRole === 'ent_lead')) throw new HttpError(400, '请指定一位企业项目负责人');
  // 只能分派本企业的账号（企业管理员、企业成员），不能把咨询方或别家企业的人拉进来。
  const staff = await ctx.db.getRepository('spaces.users', spaceName).find({ appends: ['roles'] });
  const allowed = new Set(
    staff
      .filter((u: any) => (u.get('roles') ?? []).some((r: any) => [SYSTEM_ROLES.entAdmin, SYSTEM_ROLES.entMember].includes(r.get('name'))))
      .map((u: any) => u.get('id') as number),
  );
  if (list.some((m) => !allowed.has(m.userId))) throw new HttpError(400, '只能分派本企业的账号');
  const project = await insertProject(ctx, enterprise, { ...input, year, scene: 'inhouse', service: 'self', campId: null }, list);
  await audit(ctx, spaceName, 'project.createByEnterprise', { projectId: project.id, enterpriseId: enterprise.get('id') });
  return project;
}

async function upsertMembers(ctx: Context, projectId: number, spaceName: string, list: MemberInput[], transaction: any) {
  const repo = ctx.db.getRepository('dz_project_members');
  const added: { userId: number; projectRole: ProjectRole; isNew: boolean }[] = [];
  for (const m of list) {
    const existing = await repo.findOne({ filter: { projectId, userId: m.userId }, transaction });
    added.push({ userId: m.userId, projectRole: m.projectRole, isNew: !existing });
    if (existing) {
      await existing.update({ projectRole: m.projectRole, orgUnitId: m.orgUnitId ?? null }, { transaction });
    } else {
      await repo.create({
        values: { projectId, userId: m.userId, projectRole: m.projectRole, orgUnitId: m.orgUnitId, spaceName, ...creator(ctx) },
        transaction,
      });
    }
  }
  await addUsersToSpace(ctx, spaceName, list.map((m) => m.userId), transaction);
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: projectId, transaction });
  await notifyAssignment(ctx, project, added, transaction);
}

export async function setProjectMembers(ctx: Context, projectId: number, input: unknown) {
  requireOps(await systemAccess(ctx));
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: Number(projectId) });
  if (!project) throw new HttpError(404, '项目不存在');
  const spaceName = project.get('spaceName') as string;
  if (!(await userSpaceNames(ctx)).includes(spaceName)) throw new HttpError(404, '项目不存在');
  await ctx.db.sequelize.transaction((transaction: any) =>
    upsertMembers(ctx, project.get('id'), spaceName, members(input), transaction),
  );
  return { ok: true };
}

/** Projects the current user belongs to, across all of their spaces. */
export async function myProjects(ctx: Context) {
  const userId = currentUserId(ctx);
  const access = await systemAccess(ctx);
  const spaces = await userSpaceNames(ctx);
  if (spaces.length === 0) return [];
  const memberships = await ctx.db.getRepository('dz_project_members').find({
    filter: { userId, spaceName: { $in: spaces } },
  });
  const roleByProject = new Map(memberships.map((m: any) => [m.get('projectId'), m.get('projectRole')]));
  const filter = access.isConsultAdmin || access.isOps
    ? { spaceName: { $in: spaces } }
    : { id: { $in: [...roleByProject.keys()] } };
  const projects = await ctx.db.getRepository('dz_projects').find({ filter, appends: ['enterprise'], sort: ['-createdAt'] });
  const ids = projects.map((p: any) => p.get('id'));
  const rows = ids.length
    ? await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId: { $in: ids } }, fields: ['projectId', 'code', 'status'] })
    : [];
  const progress = (projectId: number) => {
    const locked = new Set(rows.filter((r: any) => r.get('projectId') === projectId && r.get('status') === 'locked').map((r: any) => r.get('code')));
    return Object.fromEntries(
      STAGES.map((stage) => {
        const gate = stageGateCodes(stage.key);
        return [stage.key, { locked: gate.filter((c) => locked.has(c)).length, total: gate.length }];
      }),
    );
  };
  // The concrete next step on each card (“继续填：…”, “去定版：…”) instead of a bare “进入”.
  const out = [];
  for (const p of projects as any[]) {
    const role = (roleByProject.get(p.get('id')) as ProjectRole | undefined) ?? null;
    const steps = await projectProgress(ctx, p.get('id'));
    out.push({ ...p.toJSON(), projectRole: role, progress: progress(p.get('id')), next: nextAction(steps, role, p.get('service') === 'self' ? 'self' : 'guided') });
  }
  return out;
}
