import { randomBytes, randomInt } from 'node:crypto';

import type { Context } from '@nocobase/actions';

import { ORG_DEPENDENT_CODES, type OrgUnitFacts, appendOrgNotice, describeOrgChange, getArtifactDef } from '../../shared';
import { HttpError, SYSTEM_ROLES, currentUserId, requireOps, systemAccess, userSpaceNames, type SystemAccess } from './access';
import { notify, projectMemberIds } from './notify';

// 运营管理：账号、企业档案、空间成员、组织部门与项目成员。
// Every action re-checks who may touch which enterprise; the multi-space plugin does not
// filter custom actions, so the caller's space membership is verified here.

const DZ_ROLES = Object.values(SYSTEM_ROLES) as string[];
/** Roles that only a consulting admin (or root) may grant. */
const PRIVILEGED_ROLES: string[] = [SYSTEM_ROLES.consultAdmin, SYSTEM_ROLES.ops];
/** Roles a NocoBase user may also carry without making them “someone else's” account. */
const NEUTRAL_ROLES = ['member', 'anonymous'];

function text(value: unknown, label: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `请填写${label}`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `${label}不能超过 ${max} 个字`);
  return trimmed;
}

function optionalText(value: unknown, label: string, max = 100): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, label, max);
}

function positiveId(value: unknown, label: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `缺少${label}`);
  return id;
}

/** An initial password that satisfies the instance policy (letters and digits). */
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const letters = Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
  return `Dz${letters}${randomInt(1000, 10000)}`;
}

/**
 * Ops writes name their space explicitly and are not bound to the request context: the
 * multi-space plugin would otherwise re-home them to the caller's current `x-spaces`
 * (or fail when there is none, e.g. when creating a platform-level account).
 */
export function creator(ctx: Context) {
  const id = currentUserId(ctx);
  return { createdById: id, updatedById: id };
}

async function audit(ctx: Context, spaceName: string | null, action: string, meta: Record<string, unknown>, transaction?: any) {
  await ctx.db.getRepository('dz_audit_events').create({
    values: { action, meta: { ...meta, actorId: currentUserId(ctx) }, spaceName, ...creator(ctx) },
    transaction,
  });
}

interface EnterpriseScope {
  enterprise: any;
  spaceName: string;
  access: SystemAccess;
  /** The caller is an enterprise admin of this enterprise (and not ops). */
  asEntAdmin: boolean;
}

/** Ops may manage any enterprise whose space they belong to; an enterprise admin only their own. */
async function loadEnterpriseScope(ctx: Context, enterpriseId: unknown, allowEntAdmin: boolean): Promise<EnterpriseScope> {
  const access = await systemAccess(ctx);
  const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: positiveId(enterpriseId, '企业') });
  if (!enterprise) throw new HttpError(404, '企业不存在');
  const spaceName = enterprise.get('spaceName') as string;
  if (!(await userSpaceNames(ctx)).includes(spaceName)) throw new HttpError(404, '企业不存在');
  const isEntAdmin = access.roles.includes(SYSTEM_ROLES.entAdmin);
  if (!access.isOps && !(allowEntAdmin && isEntAdmin)) {
    throw new HttpError(
      403,
      allowEntAdmin ? '只有运营管理员、咨询管理员或本企业管理员可以执行这个操作' : '只有运营管理员或咨询管理员可以执行这个操作',
    );
  }
  return { enterprise, spaceName, access, asEntAdmin: !access.isOps };
}

/**
 * Read only the fields we expose: `toJSON()` deep-clones the whole model, and on a user
 * created in this request other plugins' hooks leave request state on it.
 */
function publicUser(user: any) {
  const read = (key: string) => (typeof user.get === 'function' ? user.get(key) : user[key]);
  const roles = (read('roles') ?? []) as any[];
  return {
    id: read('id') as number,
    username: read('username') as string,
    nickname: read('nickname') as string,
    email: (read('email') as string | null) ?? null,
    phone: (read('phone') as string | null) ?? null,
    roles: roles
      .map((r) => (typeof r.get === 'function' ? r.get('name') : r.name) as string)
      .filter((name) => DZ_ROLES.includes(name)),
  };
}

async function addUsersToSpace(ctx: Context, spaceName: string, userIds: number[], transaction?: any) {
  if (userIds.length === 0) return;
  await ctx.db.getRepository('spaces.users', spaceName).add({ tk: userIds, transaction });
}

// ── 账号 ─────────────────────────────────────────────────────────────

export interface CreateUserInput {
  username: string;
  nickname: string;
  email?: string;
  phone?: string;
  systemRole: string;
  enterpriseId?: number;
}

export async function createUser(ctx: Context, input: CreateUserInput, transaction?: any) {
  const systemRole = String(input.systemRole ?? '');
  if (!DZ_ROLES.includes(systemRole)) throw new HttpError(400, '系统角色不正确');

  let scope: EnterpriseScope | null = null;
  if (input.enterpriseId) {
    scope = await loadEnterpriseScope(ctx, input.enterpriseId, true);
    if (scope.asEntAdmin && systemRole !== SYSTEM_ROLES.entMember) {
      throw new HttpError(403, '企业管理员只能为本企业开通企业成员账号');
    }
  } else {
    requireOps(await systemAccess(ctx));
  }
  const access = scope?.access ?? (await systemAccess(ctx));
  if (PRIVILEGED_ROLES.includes(systemRole) && !access.isConsultAdmin) {
    throw new HttpError(403, '只有咨询管理员可以开通运营管理员或咨询管理员');
  }

  return insertUser(ctx, { ...input, systemRole }, scope?.spaceName ?? null, transaction);
}

/** Create a 定责 account (callers have already checked permissions) and optionally add it to a space. */
export async function insertUser(
  ctx: Context,
  input: Omit<CreateUserInput, 'enterpriseId'>,
  spaceName: string | null,
  transaction?: any,
) {
  const username = text(input.username, '登录名', 50);
  if (!/^[A-Za-z0-9_.@-]{3,50}$/.test(username)) throw new HttpError(400, '登录名只能用字母、数字和 _ . @ -，至少 3 位');
  const nickname = text(input.nickname, '姓名', 50);
  const repo = ctx.db.getRepository('users');
  if (await repo.findOne({ filter: { username }, transaction })) throw new HttpError(409, `登录名 ${username} 已被使用`);
  const email = optionalText(input.email, '邮箱');
  if (email && (await repo.findOne({ filter: { email }, transaction }))) throw new HttpError(409, `邮箱 ${email} 已被使用`);
  const phone = optionalText(input.phone, '手机号', 20);
  if (phone && (await repo.findOne({ filter: { phone }, transaction }))) throw new HttpError(409, `手机号 ${phone} 已被使用`);

  const password = generatePassword();
  const run = async (tx: any) => {
    const user = await repo.create({
      values: { username, nickname, email, phone, password, roles: [input.systemRole] },
      // Password-policy and multi-space hooks on users read the request context.
      context: ctx,
      transaction: tx,
    });
    if (spaceName) await addUsersToSpace(ctx, spaceName, [user.get('id') as number], tx);
    await audit(ctx, spaceName, 'user.create', { userId: user.get('id'), username, systemRole: input.systemRole }, tx);
    const created = await repo.findOne({ filterByTk: user.get('id'), appends: ['roles'], transaction: tx });
    return { user: publicUser(created), initialPassword: password };
  };
  return transaction ? run(transaction) : ctx.db.sequelize.transaction(run);
}

/** Accounts carrying 定责 roles; `q` matches login name or name. */
export async function listUsers(ctx: Context, query: { q?: string; role?: string }) {
  requireOps(await systemAccess(ctx));
  const roles = query.role && DZ_ROLES.includes(query.role) ? [query.role] : DZ_ROLES;
  const filter: any = { 'roles.name': { $in: roles } };
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q) filter.$or = [{ username: { $includes: q } }, { nickname: { $includes: q } }];
  const users = await ctx.db.getRepository('users').find({ filter, appends: ['roles'], sort: ['id'], limit: 500 });
  return users.map(publicUser);
}

export async function resetPassword(ctx: Context, input: { userId: number; enterpriseId?: number }) {
  const userId = positiveId(input.userId, '用户');
  const repo = ctx.db.getRepository('users');
  const user = await repo.findOne({ filterByTk: userId, appends: ['roles'] });
  if (!user) throw new HttpError(404, '用户不存在');
  const roleNames = (user.get('roles') ?? []).map((r: any) => r.get('name')) as string[];
  if (roleNames.some((name) => !DZ_ROLES.includes(name) && !NEUTRAL_ROLES.includes(name))) {
    throw new HttpError(403, '这个账号不是定责平台账号，请到系统管理里处理');
  }

  let spaceName: string | null = null;
  if (input.enterpriseId) {
    const scope = await loadEnterpriseScope(ctx, input.enterpriseId, true);
    spaceName = scope.spaceName;
    const inSpace = await ctx.db.getRepository('spaces.users', scope.spaceName).findOne({ filterByTk: userId });
    if (!inSpace) throw new HttpError(404, '该用户不在本企业');
    if (scope.asEntAdmin && roleNames.some((name) => name !== SYSTEM_ROLES.entMember && !NEUTRAL_ROLES.includes(name))) {
      throw new HttpError(403, '企业管理员只能重置企业成员的密码');
    }
  } else {
    const access = await systemAccess(ctx);
    requireOps(access);
    if (roleNames.some((name) => PRIVILEGED_ROLES.includes(name)) && !access.isConsultAdmin) {
      throw new HttpError(403, '只有咨询管理员可以重置管理员的密码');
    }
  }
  const password = generatePassword();
  await ctx.db.getRepository('users').update({ filterByTk: userId, values: { password }, context: ctx });
  await audit(ctx, spaceName, 'user.resetPassword', { userId });
  return { initialPassword: password };
}

// ── 企业 ─────────────────────────────────────────────────────────────

export async function enterpriseDetail(ctx: Context, enterpriseId: unknown) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, enterpriseId, true);
  const id = enterprise.get('id');
  const [projects, orgUnits, members] = await Promise.all([
    ctx.db.getRepository('dz_projects').find({
      filter: { enterpriseId: id },
      appends: ['members', 'members.user'],
      sort: ['-year', '-createdAt'],
    }),
    ctx.db.getRepository('dz_org_units').find({ filter: { enterpriseId: id }, appends: ['head'], sort: ['sort', 'id'] }),
    ctx.db.getRepository('spaces.users', spaceName).find({ appends: ['roles'], sort: ['id'] }),
  ]);
  return {
    enterprise: enterprise.toJSON(),
    projects: projects.map((p: any) => {
      const json = p.toJSON();
      return {
        ...json,
        members: (json.members ?? []).map((m: any) => ({
          userId: m.userId,
          projectRole: m.projectRole,
          orgUnitId: m.orgUnitId ?? null,
          user: m.user ? { id: m.user.id, username: m.user.username, nickname: m.user.nickname } : null,
        })),
      };
    }),
    orgUnits: orgUnits.map((o: any) => {
      const json = o.toJSON();
      return {
        id: json.id,
        name: json.name,
        kind: json.kind,
        sort: json.sort,
        parentId: json.parentId ?? null,
        headId: json.headId ?? null,
        headName: json.headName ?? null,
        duty: json.duty ?? null,
      };
    }),
    members: members.map(publicUser),
  };
}

export async function updateEnterprise(
  ctx: Context,
  input: { enterpriseId: number; name?: string; shortName?: string; size?: string; status?: string },
) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, false);
  const values: Record<string, unknown> = {};
  if (input.name !== undefined) values.name = text(input.name, '企业名称');
  if (input.shortName !== undefined) values.shortName = text(input.shortName, '简称', 20);
  if (input.size !== undefined) values.size = input.size === 'large' ? 'large' : 'sme';
  if (input.status !== undefined) {
    if (!['active', 'suspended'].includes(input.status)) throw new HttpError(400, '状态不正确');
    values.status = input.status;
  }
  await enterprise.update(values);
  await audit(ctx, spaceName, 'enterprise.update', { enterpriseId: enterprise.get('id'), ...values });
  return enterprise.toJSON();
}

export async function addEnterpriseMembers(ctx: Context, input: { enterpriseId: number; userIds: number[] }) {
  const { spaceName, asEntAdmin } = await loadEnterpriseScope(ctx, input.enterpriseId, false);
  if (asEntAdmin) throw new HttpError(403, '只有运营管理员可以把已有账号加入企业');
  const userIds = [...new Set((input.userIds ?? []).map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (userIds.length === 0) throw new HttpError(400, '请选择账号');
  await addUsersToSpace(ctx, spaceName, userIds);
  await audit(ctx, spaceName, 'enterprise.addMembers', { userIds });
  return { ok: true };
}

export async function removeEnterpriseMember(ctx: Context, input: { enterpriseId: number; userId: number }) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, false);
  const userId = positiveId(input.userId, '用户');
  if (userId === currentUserId(ctx)) throw new HttpError(400, '不能把自己移出企业，否则将无法再管理它');
  const projectIds = (await ctx.db.getRepository('dz_projects').find({ filter: { enterpriseId: enterprise.get('id') }, fields: ['id'] })).map(
    (p: any) => p.get('id'),
  );
  const memberships = projectIds.length
    ? await ctx.db.getRepository('dz_project_members').count({ filter: { userId, projectId: { $in: projectIds } } })
    : 0;
  if (memberships > 0) throw new HttpError(409, '该账号还是本企业项目的成员，请先在项目里移除');
  await ctx.db.getRepository('spaces.users', spaceName).remove({ tk: [userId] });
  await audit(ctx, spaceName, 'enterprise.removeMember', { userId });
  return { ok: true };
}

// ── 组织部门 ─────────────────────────────────────────────────────────

/** The facts of a unit that the department tables use. */
const orgFacts = (u: any): OrgUnitFacts => ({
  name: u.get('name'),
  kind: u.get('kind'),
  parentId: u.get('parentId') ?? null,
  headId: u.get('headId') ?? null,
  headName: u.get('headName') ?? null,
  duty: u.get('duty') ?? null,
});

/**
 * 组织变了：flag the locked department tables of every project of the enterprise and tell the
 * lead consultant(s) and the enterprise lead; nothing in the tables changes by itself.
 */
async function flagOrgChange(ctx: Context, enterpriseId: number, line: string | null) {
  if (!line) return;
  const projects = await ctx.db.getRepository('dz_projects').find({ filter: { enterpriseId } });
  const date = new Date().toISOString().slice(5, 10);
  for (const project of projects) {
    const projectId = project.get('id') as number;
    const locked = await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId, code: { $in: ORG_DEPENDENT_CODES }, status: 'locked' } });
    if (!locked.length) continue;
    for (const row of locked) await row.update({ orgNotice: appendOrgNotice(row.get('orgNotice'), line, date) });
    const codes = locked.map((r: any) => r.get('code') as string);
    await notify(ctx, {
      projectId,
      spaceName: project.get('spaceName'),
      userIds: await projectMemberIds(ctx, projectId, ['lead_consultant', 'ent_lead']),
      kind: 'orgChanged',
      title: '组织已变更，请判断已定版的部门表要不要重开',
      content: `${line}。受影响的已定版表：${codes.map((c) => getArtifactDef(c).specId).join('、')}。表里保留定版时的部门，不会自动改。`,
      link: `/projects/${projectId}/workspace/${codes[0]}`,
      code: codes[0],
    });
  }
}

export async function saveOrgUnit(
  ctx: Context,
  input: {
    enterpriseId: number;
    id?: number;
    name: string;
    kind?: string;
    parentId?: number | null;
    headId?: number | null;
    headName?: string | null;
    duty?: string | null;
    sort?: number;
  },
) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const repo = ctx.db.getRepository('dz_org_units');
  const enterpriseId = enterprise.get('id');
  const parentId = input.parentId ? positiveId(input.parentId, '上级部门') : null;
  if (parentId) {
    const parent = await repo.findOne({ filter: { id: parentId, enterpriseId } });
    if (!parent) throw new HttpError(400, '上级部门不属于本企业');
    if (input.id && parentId === Number(input.id)) throw new HttpError(400, '上级部门不能是自己');
  }
  const values = {
    name: text(input.name, '部门名称', 50),
    kind: ['company', 'department', 'team'].includes(String(input.kind)) ? input.kind : 'department',
    parentId,
    headId: input.headId ? positiveId(input.headId, '负责人') : null,
    headName: input.headId ? null : String(input.headName ?? '').trim().slice(0, 30) || null,
    duty: String(input.duty ?? '').trim().slice(0, 500) || null,
    sort: Number.isFinite(Number(input.sort)) ? Number(input.sort) : 0,
  };
  if (input.id) {
    const unit = await repo.findOne({ filter: { id: Number(input.id), enterpriseId } });
    if (!unit) throw new HttpError(404, '部门不存在');
    const before = orgFacts(unit);
    await unit.update(values);
    await flagOrgChange(ctx, enterpriseId, describeOrgChange(before, orgFacts(unit)));
    return unit.toJSON();
  }
  const unit = await repo.create({ values: { ...values, enterpriseId, spaceName, ...creator(ctx) } });
  await flagOrgChange(ctx, enterpriseId, describeOrgChange(null, orgFacts(unit)));
  return unit.toJSON();
}

/**
 * 从 Excel 粘贴组织表：upsert by name in one transaction (parents first, as the rows arrive), heads
 * matched to enterprise accounts by name or kept as a plain name; one combined change notice.
 */
export async function importOrgUnits(
  ctx: Context,
  input: { enterpriseId: number; rows: { name: string; parent?: string; kind?: string; head?: string; duty?: string }[] },
) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const enterpriseId = enterprise.get('id') as number;
  const rows = Array.isArray(input.rows) ? input.rows.slice(0, 200) : [];
  if (!rows.length) throw new HttpError(400, '没有可导入的部门');
  const people = await ctx.db.getRepository('spaces.users', spaceName).find({});
  const personId = (name: string) => people.find((u: any) => u.get('nickname') === name || u.get('username') === name)?.get('id') ?? null;
  const repo = ctx.db.getRepository('dz_org_units');
  const lines: string[] = [];
  let created = 0;
  let updated = 0;
  await ctx.db.sequelize.transaction(async (transaction: any) => {
    const units = await repo.find({ filter: { enterpriseId }, transaction });
    const byName = new Map<string, any>(units.map((u: any) => [u.get('name'), u]));
    for (const [i, row] of rows.entries()) {
      const name = text(row.name, '部门名称', 50);
      const parent = row.parent ? byName.get(String(row.parent).trim()) : null;
      const head = String(row.head ?? '').trim();
      const headId = head ? personId(head) : null;
      const existing = byName.get(name);
      const values: Record<string, unknown> = {
        name,
        kind: ['company', 'department', 'team'].includes(String(row.kind)) ? row.kind : 'department',
        parentId: parent && parent !== existing ? parent.get('id') : null,
        ...(head ? { headId, headName: headId ? null : head.slice(0, 30) } : {}),
        ...(String(row.duty ?? '').trim() ? { duty: String(row.duty).trim().slice(0, 500) } : {}),
      };
      if (existing) {
        const before = orgFacts(existing);
        await existing.update(values, { transaction });
        const line = describeOrgChange(before, orgFacts(existing));
        if (line) lines.push(line);
        updated++;
      } else {
        const unit = await repo.create({ values: { ...values, sort: units.length + i + 1, enterpriseId, spaceName, ...creator(ctx) }, transaction });
        byName.set(name, unit);
        lines.push(describeOrgChange(null, orgFacts(unit))!);
        created++;
      }
    }
  });
  await audit(ctx, spaceName, 'org.import', { created, updated });
  if (lines.length) await flagOrgChange(ctx, enterpriseId, `导入组织表：${lines.length > 4 ? `${lines.slice(0, 4).join('；')} 等 ${lines.length} 处` : lines.join('；')}`);
  return { created, updated, changes: lines.length };
}

/**
 * 成员所属部门：the enterprise admin (or ops) puts a member in a department for every project of
 * the enterprise at once — members belong to one department, whichever project they work on.
 */
export async function setMemberDepartment(ctx: Context, input: { enterpriseId: number; userId: number; orgUnitId: number | null }) {
  const { enterprise, spaceName } = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const enterpriseId = enterprise.get('id');
  const userId = positiveId(input.userId, '成员');
  const orgUnitId = input.orgUnitId ? positiveId(input.orgUnitId, '部门') : null;
  if (orgUnitId && !(await ctx.db.getRepository('dz_org_units').findOne({ filter: { id: orgUnitId, enterpriseId } }))) {
    throw new HttpError(400, '部门不属于本企业');
  }
  const projectIds = (await ctx.db.getRepository('dz_projects').find({ filter: { enterpriseId }, fields: ['id'] })).map((p: any) => p.get('id'));
  if (!projectIds.length) return { updated: 0 };
  const rows = await ctx.db.getRepository('dz_project_members').find({ filter: { userId, projectId: { $in: projectIds } } });
  for (const row of rows) await row.update({ orgUnitId });
  await audit(ctx, spaceName, 'member.setDepartment', { userId, orgUnitId, projects: rows.length });
  return { updated: rows.length };
}

export async function deleteOrgUnit(ctx: Context, input: { enterpriseId: number; id: number }) {
  const { enterprise } = await loadEnterpriseScope(ctx, input.enterpriseId, true);
  const id = positiveId(input.id, '部门');
  const enterpriseId = enterprise.get('id');
  const repo = ctx.db.getRepository('dz_org_units');
  if (await repo.count({ filter: { parentId: id, enterpriseId } })) throw new HttpError(409, '请先删除或移走下级部门');
  if (await ctx.db.getRepository('dz_project_members').count({ filter: { orgUnitId: id } })) {
    throw new HttpError(409, '还有项目成员归属这个部门，请先调整成员的部门');
  }
  const unit = await repo.findOne({ filter: { id, enterpriseId } });
  await repo.destroy({ filter: { id, enterpriseId } });
  if (unit) await flagOrgChange(ctx, enterpriseId, describeOrgChange(orgFacts(unit), null));
  return { ok: true };
}

// ── 项目 ─────────────────────────────────────────────────────────────

async function loadOpsProject(ctx: Context, projectId: unknown) {
  requireOps(await systemAccess(ctx));
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: positiveId(projectId, '项目') });
  if (!project) throw new HttpError(404, '项目不存在');
  const spaceName = project.get('spaceName') as string;
  if (!(await userSpaceNames(ctx)).includes(spaceName)) throw new HttpError(404, '项目不存在');
  return { project, spaceName };
}

export async function updateProject(
  ctx: Context,
  input: {
    projectId: number;
    name?: string;
    year?: number;
    scene?: string;
    primaryExpression?: string;
    keyProjectLevel?: number;
    scheduleScale?: string;
    status?: string;
  },
) {
  const { project, spaceName } = await loadOpsProject(ctx, input.projectId);
  const values: Record<string, unknown> = {};
  if (input.name !== undefined) values.name = text(input.name, '项目名称');
  if (input.year !== undefined) {
    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, '年度不正确');
    values.year = year;
  }
  if (input.scene !== undefined) values.scene = input.scene === 'inhouse' ? 'inhouse' : 'camp';
  if (input.primaryExpression !== undefined) values.primaryExpression = input.primaryExpression === 'sixfold' ? 'sixfold' : 'house';
  if (input.keyProjectLevel !== undefined) values.keyProjectLevel = Number(input.keyProjectLevel) === 1 ? 1 : 2;
  if (input.scheduleScale !== undefined) values.scheduleScale = input.scheduleScale === 'quarter' ? 'quarter' : 'month';
  if (input.status !== undefined) {
    if (!['active', 'archived'].includes(input.status)) throw new HttpError(400, '状态不正确');
    values.status = input.status;
  }
  await project.update(values);
  await audit(ctx, spaceName, 'project.update', { projectId: project.get('id'), ...values });
  return project.toJSON();
}

export async function removeProjectMember(ctx: Context, input: { projectId: number; userId: number }) {
  const { project, spaceName } = await loadOpsProject(ctx, input.projectId);
  const userId = positiveId(input.userId, '用户');
  const repo = ctx.db.getRepository('dz_project_members');
  const member = await repo.findOne({ filter: { projectId: project.get('id'), userId } });
  if (!member) throw new HttpError(404, '该账号不是项目成员');
  if (member.get('projectRole') === 'lead_consultant') {
    const leads = await repo.count({ filter: { projectId: project.get('id'), projectRole: 'lead_consultant' } });
    if (leads <= 1) throw new HttpError(409, '项目至少需要一位主咨询师，请先指定新的主咨询师');
  }
  await member.destroy();
  await audit(ctx, spaceName, 'project.removeMember', { projectId: project.get('id'), userId });
  return { ok: true };
}
