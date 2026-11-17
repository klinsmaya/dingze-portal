import { randomBytes } from 'node:crypto';

import type { Context } from '@nocobase/actions';

import { ENTERPRISE_PROJECT_ROLES, type ProjectRole, STAGES, canManageProjects, defaultLeadId, effectiveProjectRole, nextAction, normalizeProjectRole, selfProjectAllowed, stageGateCodes } from '../../shared';
import { projectProgress } from './artifacts';
import { HttpError, SYSTEM_ROLES, currentUserId, requireOps, systemAccess, userSpaceNames } from './access';
import { accountFactsOf, staffUserIds } from './accounts';
import { type MemberInput, parseMembers, upsertMembers } from './members';
import { addUsersToSpace, audit, creator, insertUser, loadEnterpriseScope } from './ops';

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

export interface ProvisionInput {
  name: string;
  shortName: string;
  size?: 'large' | 'sme';
  consultantIds?: number[];
  memberIds?: number[];
  /** Create the enterprise admin account in the same step. */
  admin?: { username: string; nickname: string; email?: string; phone?: string };
}

/**
 * 开通企业：建空间 → 企业档案 → 企业管理员账号（必填：企业至少要有一位管理员）。运营管理员、咨询管理员
 * 自动进入每一家企业的空间，开通的人不用再挨个加；咨询师按 consultantIds 分派进来。
 */
export async function provisionEnterprise(ctx: Context, input: ProvisionInput) {
  requireOps(await systemAccess(ctx));
  const name = text(input.name, '企业名称');
  const shortName = text(input.shortName, '简称', 20);
  const size = input.size === 'large' ? 'large' : 'sme';
  if (!input.admin || !String(input.admin.username ?? '').trim() || !String(input.admin.nickname ?? '').trim()) {
    throw new HttpError(400, '请填写企业管理员的姓名和登录名：企业至少要有一位管理员');
  }
  const spaceName = `dz-${randomBytes(5).toString('hex')}`;

  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const userIds = [currentUserId(ctx), ...(await staffUserIds(ctx.db, transaction)), ...ids(input.consultantIds), ...ids(input.memberIds)];
    await ctx.db.getRepository('spaces').create({ values: { name: spaceName, title: shortName }, transaction });
    await addUsersToSpace(ctx, spaceName, [...new Set(userIds)], transaction);
    const enterprise = await ctx.db.getRepository('dz_enterprises').create({
      values: { name, shortName, size, status: 'active', spaceName, ...creator(ctx) },
      transaction,
    });
    const admin = await insertUser(ctx, { ...input.admin!, systemRole: SYSTEM_ROLES.entAdmin }, spaceName, transaction, { enterpriseId: enterprise.get('id') as number });
    return { enterprise: enterprise.toJSON(), spaceName, admin };
  });
}

/**
 * Ops see every enterprise whose space they joined; an enterprise admin sees their own.
 * 每家企业带上：能用的企业管理员有几位（0 位的要标出来）、待审核的注册申请有几条。
 */
export async function listEnterprises(ctx: Context) {
  const access = await systemAccess(ctx);
  if (!access.isOps && !access.roles.includes(SYSTEM_ROLES.entAdmin)) requireOps(access);
  const spaces = await userSpaceNames(ctx);
  const rows = await ctx.db.getRepository('dz_enterprises').find({
    filter: { spaceName: { $in: spaces } },
    appends: ['projects'],
    sort: ['-createdAt'],
  });
  const enterpriseIds = rows.map((r: any) => r.get('id') as number);
  const pending = enterpriseIds.length
    ? await ctx.db.getRepository('dz_registrations').find({ filter: { enterpriseId: { $in: enterpriseIds }, status: 'pending' }, fields: ['enterpriseId'] })
    : [];
  const admins = await ctx.db.getRepository('users').find({ filter: { 'roles.name': SYSTEM_ROLES.entAdmin }, fields: ['id'] });
  const accounts = await accountFactsOf(ctx.db, admins.map((u: any) => u.get('id') as number));
  const count = (list: (number | null)[], id: number) => list.filter((x) => x === id).length;
  const adminOf = [...accounts.values()].filter((a) => !a.disabled).map((a) => a.enterpriseId);
  const pendingOf = pending.map((r: any) => r.get('enterpriseId') as number);
  return rows.map((r: any) => ({
    ...r.toJSON(),
    adminCount: count(adminOf, r.get('id')),
    pendingRegistrations: count(pendingOf, r.get('id')),
  }));
}

export type { MemberInput };

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
  return insertProject(ctx, enterprise, input, await withDefaultLead(ctx, enterprise, parseMembers(input.members)));
}

/** 新建项目没指定企业项目负责人时，默认是企业管理员（有多位取最早开通的）；之后可以在项目成员里换。 */
async function withDefaultLead(ctx: Context, enterprise: any, list: MemberInput[]): Promise<MemberInput[]> {
  if (list.some((m) => m.projectRole === 'ent_lead')) return list;
  const people = await ctx.db.getRepository('spaces.users', enterprise.get('spaceName')).find({ appends: ['roles'] });
  const admins = people.filter((u: any) => (u.get('roles') ?? []).some((r: any) => r.get('name') === SYSTEM_ROLES.entAdmin));
  const accounts = await accountFactsOf(ctx.db, admins.map((u: any) => u.get('id') as number));
  const leadId = defaultLeadId(admins.filter((u: any) => !accounts.get(u.get('id'))?.disabled).map((u: any) => ({ id: u.get('id') as number, createdAt: u.get('createdAt') })));
  if (!leadId) return list;
  return [...list.filter((m) => m.userId !== leadId), { userId: leadId, projectRole: 'ent_lead' }];
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
 * 企业管理员自建项目（默认允许，运营可以按企业关掉）：企业内训 · 自助，只能分派本企业账号的企业侧角色，
 * 至少一位企业项目负责人。需要咨询师陪跑时由运营改服务方式并分派咨询师。
 */
export async function createOwnProject(ctx: Context, input: ProjectInput) {
  const { enterprise, spaceName, access } = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  if (!access.isOps) {
    if (!selfProjectAllowed({ selfProjectOff: enterprise.get('selfProjectOff') })) throw new HttpError(403, '本企业的自建项目已关闭，需要新项目请联系运营', 'SELF_PROJECT_OFF');
    if (enterprise.get('status') === 'suspended') throw new HttpError(403, '该企业已停用，请联系咨询机构', 'ENTERPRISE_SUSPENDED');
  }
  const year = input.year ? Number(input.year) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, '年度不正确');
  const given = parseMembers(input.members);
  if (given.some((m) => !ENTERPRISE_PROJECT_ROLES.includes(m.projectRole))) throw new HttpError(400, '自建项目只能分派企业侧角色；咨询师由运营分派');
  // 没指定负责人时默认是企业管理员（建项目的人自己，或本企业最早开通的管理员）。只能分派本企业的账号，
  // 角色和账号对不对得上在写入时核对（upsertMembers）。
  const me = currentUserId(ctx);
  const mine = !access.isOps && !given.some((m) => m.projectRole === 'ent_lead') ? [...given.filter((m) => m.userId !== me), { userId: me, projectRole: 'ent_lead' as ProjectRole }] : given;
  const list = await withDefaultLead(ctx, enterprise, mine);
  if (!list.some((m) => m.projectRole === 'ent_lead')) throw new HttpError(400, '请指定一位企业项目负责人');
  const project = await insertProject(ctx, enterprise, { ...input, year, scene: 'inhouse', service: 'self', campId: null }, list);
  await audit(ctx, spaceName, 'project.createByEnterprise', { projectId: project.id, enterpriseId: enterprise.get('id') });
  return project;
}

/**
 * 「我的项目」：运营和咨询管理员看所在空间的全部项目；本企业账号（企业管理员、企业成员）看本企业的
 * 全部项目，没被加进去的只读查看；其余（咨询师）只看自己参与的。
 */
export async function myProjects(ctx: Context) {
  const userId = currentUserId(ctx);
  const access = await systemAccess(ctx);
  const spaces = await userSpaceNames(ctx);
  if (spaces.length === 0) return [];
  const memberships = await ctx.db.getRepository('dz_project_members').find({
    filter: { userId, spaceName: { $in: spaces } },
  });
  const roleByProject = new Map(memberships.map((m: any) => [m.get('projectId'), m.get('projectRole')]));
  // 一家企业一个空间，所以企业侧账号所在空间里的项目就是本企业的项目。
  const filter = access.isConsultAdmin || access.isOps || access.isEnterpriseAccount
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
    const joined = !!normalizeProjectRole(roleByProject.get(p.get('id')));
    const role = effectiveProjectRole(normalizeProjectRole(roleByProject.get(p.get('id'))), access.roles);
    const steps = await projectProgress(ctx, p.get('id'));
    out.push({
      ...p.toJSON(),
      projectRole: role,
      joined,
      // 归档、恢复、删除：运营，和本企业的企业管理员（接口里再核对一次）。
      manageable: canManageProjects(access.roles),
      progress: progress(p.get('id')),
      next: nextAction(steps, role, p.get('service') === 'self' ? 'self' : 'guided'),
    });
  }
  return out;
}
