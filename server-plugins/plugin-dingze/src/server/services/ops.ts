import { randomBytes, randomInt } from 'node:crypto';

import type { Context } from '@nocobase/actions';

import { ORG_DEPENDENT_CODES, type OrgUnitFacts, PROJECT_FILE_COLLECTION, PROJECT_OWNED_COLLECTIONS, accountKind, appendOrgNotice, deleteConfirmed, describeOrgChange, getArtifactDef, normalizeProjectRole, orgKindFromName } from '../../shared';
import { HttpError, SYSTEM_ROLES, currentUserId, loadProjectContext, requireOps, systemAccess, userSpaceNames, type SystemAccess } from './access';
import { accountFactsOf, patchAccount } from './accounts';
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

export function positiveId(value: unknown, label: string): number {
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
export function creator(ctx: Context, actorId?: number) {
  const id = actorId ?? currentUserId(ctx);
  return { createdById: id, updatedById: id };
}

/**
 * 留痕。`actorId` 只在没人登录的公开动作里传（凭免审核邀请码注册：操作人就是刚开通的账号本人）；
 * 不传时取当前登录的人，没登录会报“请先登录”。
 */
export async function audit(ctx: Context, spaceName: string | null, action: string, meta: Record<string, unknown>, transaction?: any, actorId?: number) {
  const id = actorId ?? currentUserId(ctx);
  await ctx.db.getRepository('dz_audit_events').create({
    values: { action, meta: { ...meta, actorId: id }, spaceName, createdById: id, updatedById: id },
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
export async function loadEnterpriseScope(ctx: Context, enterpriseId: unknown, allowEntAdmin: boolean): Promise<EnterpriseScope> {
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
export function publicUser(user: any) {
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

export async function addUsersToSpace(ctx: Context, spaceName: string, userIds: number[], transaction?: any) {
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

export const DZ_SYSTEM_ROLES = DZ_ROLES;
export const PRIVILEGED_SYSTEM_ROLES = PRIVILEGED_ROLES;
export const NEUTRAL_SYSTEM_ROLES = NEUTRAL_ROLES;
/** 企业侧的系统角色。一个企业账号只属于一家企业。 */
export const ENTERPRISE_SIDE_ROLES: string[] = [SYSTEM_ROLES.entAdmin, SYSTEM_ROLES.entMember];

export interface InsertUserOptions {
  /** 账号属于哪家企业、哪个部门（企业侧账号）。 */
  enterpriseId?: number | null;
  orgUnitId?: number | null;
  /**
   * 没人登录时开通的账号（凭免审核邀请码注册）：留痕里的操作人记账号本人。有人登录时不要传。
   */
  selfService?: boolean;
  /** 账号用本人自己设的密码（邀请码注册）：不用第一次登录先改密码。 */
  ownPassword?: boolean;
}

/**
 * Create a 定责 account (callers have already checked permissions) and optionally add it to a space.
 * 运营管理员、咨询管理员的账号自动进入所有企业的空间。
 */
export async function insertUser(
  ctx: Context,
  input: Omit<CreateUserInput, 'enterpriseId'>,
  spaceName: string | null,
  transaction?: any,
  options: InsertUserOptions = {},
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
  // 没人登录又不是自助注册：照旧报“请先登录”，不往下建账号。
  if (!options.selfService) currentUserId(ctx);

  const password = generatePassword();
  const run = async (tx: any) => {
    const user = await repo.create({
      values: { username, nickname, email, phone, password, roles: [input.systemRole] },
      // Password-policy and multi-space hooks on users read the request context.
      context: ctx,
      transaction: tx,
    });
    const userId = user.get('id') as number;
    const actorId = (ctx.auth?.user?.id as number | undefined) ?? userId;
    if (spaceName) await addUsersToSpace(ctx, spaceName, [userId], tx);
    if (PRIVILEGED_ROLES.includes(input.systemRole)) {
      const spaces = await ctx.db.getRepository('dz_enterprises').find({ fields: ['spaceName'], transaction: tx });
      for (const name of new Set<string>(spaces.map((e: any) => e.get('spaceName') as string).filter(Boolean))) await addUsersToSpace(ctx, name, [userId], tx);
    }
    await patchAccount(
      ctx.db,
      userId,
      {
        enterpriseId: ENTERPRISE_SIDE_ROLES.includes(input.systemRole) ? options.enterpriseId ?? null : null,
        orgUnitId: options.orgUnitId ?? null,
        mustChangePassword: !options.ownPassword,
      },
      actorId,
      tx,
    );
    await audit(ctx, spaceName, 'user.create', { userId, username, systemRole: input.systemRole }, tx, actorId);
    const created = await repo.findOne({ filterByTk: userId, appends: ['roles'], transaction: tx });
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
  const accounts = await accountFactsOf(ctx.db, users.map((u: any) => u.get('id') as number));
  return users.map((u: any) => ({ ...publicUser(u), disabled: !!accounts.get(u.get('id'))?.disabled }));
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
  // 重置出来的也是别人给的密码：本人下次登录要先改。
  await patchAccount(ctx.db, userId, { mustChangePassword: true }, currentUserId(ctx));
  await audit(ctx, spaceName, 'user.resetPassword', { userId });
  return { initialPassword: password };
}

// ── 企业 ─────────────────────────────────────────────────────────────

/**
 * 企业的成员分两组：企业成员（本企业的账号）和咨询师（分派到这家企业的咨询方账号）。运营管理员、
 * 咨询管理员自动在所有企业里，不列出来；咨询管理员被分派成某个项目的咨询师时才出现在咨询师一组。
 * `consultAdmins` 只给“分派咨询师”的选择框用。
 */
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
  const projectRows = projects.map((p: any) => {
    const json = p.toJSON();
    return {
      ...json,
      members: (json.members ?? [])
        .map((m: any) => ({
          userId: m.userId,
          projectRole: normalizeProjectRole(m.projectRole),
          orgUnitId: m.orgUnitId ?? null,
          user: m.user ? { id: m.user.id, username: m.user.username, nickname: m.user.nickname } : null,
        }))
        .filter((m: any) => m.projectRole),
    };
  });
  const consultantIds = new Set<number>(projectRows.flatMap((p: any) => p.members.filter((m: any) => m.projectRole === 'consultant').map((m: any) => m.userId as number)));
  const accounts = await accountFactsOf(ctx.db, members.map((u: any) => u.get('id') as number));
  type Person = ReturnType<typeof publicUser> & { kind: string; orgUnitId: number | null; disabled: boolean; mustChangePassword: boolean; createdAt: string | null };
  const people: Person[] = members.map((u: any) => {
    const user = publicUser(u);
    const account = accounts.get(user.id);
    return {
      ...user,
      kind: accountKind(user.roles),
      orgUnitId: account?.orgUnitId ?? null,
      disabled: !!account?.disabled,
      mustChangePassword: !!account?.mustChangePassword,
      createdAt: (u.get('createdAt') as string | null) ?? null,
    };
  });
  const staff = (u: { roles: string[] }) => u.roles.some((r) => PRIVILEGED_ROLES.includes(r));
  return {
    enterprise: enterprise.toJSON(),
    projects: projectRows,
    orgUnits: orgUnits.map((o: any) => {
      const json = o.toJSON();
      return {
        id: json.id,
        name: json.name,
        kind: json.kind,
        kindName: json.kindName ?? null,
        sort: json.sort,
        parentId: json.parentId ?? null,
        headId: json.headId ?? null,
        headName: json.headName ?? null,
        duty: json.duty ?? null,
      };
    }),
    members: people.filter((u) => u.kind === 'enterprise' || (u.kind === 'consulting' && (!staff(u) || consultantIds.has(u.id)))),
    consultAdmins: people.filter((u) => u.kind === 'consulting' && staff(u) && !consultantIds.has(u.id)),
  };
}

export async function updateEnterprise(
  ctx: Context,
  input: { enterpriseId: number; name?: string; shortName?: string; size?: string; status?: string; allowSelfProject?: boolean },
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
  // 接口参数仍叫 allowSelfProject（开 / 关）；存的是“关掉”这一个状态，没存过的企业就是开启。
  if (input.allowSelfProject !== undefined) values.selfProjectOff = input.allowSelfProject !== true;
  await enterprise.update(values);
  await audit(ctx, spaceName, 'enterprise.update', { enterpriseId: enterprise.get('id'), ...values });
  return enterprise.toJSON();
}

// ── 组织部门 ─────────────────────────────────────────────────────────

/** The facts of a unit that the department tables use. */
const orgFacts = (u: any): OrgUnitFacts => ({
  name: u.get('name'),
  kind: u.get('kind'),
  kindName: u.get('kindName') ?? null,
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
      userIds: await projectMemberIds(ctx, projectId, ['consultant', 'ent_lead']),
      kind: 'orgChanged',
      title: '组织已变更，请判断已定版的部门表要不要重开',
      content: `${line}。受影响的已定版表：${codes.map((c) => getArtifactDef(c).specId).join('、')}。表里保留定版时的部门，不会自动改。`,
      link: `/projects/${projectId}/workspace/${codes[0]}`,
      code: codes[0],
    });
  }
}

/**
 * 组织在哪维护：项目「资料 › 组织与职责」（带 projectId）。企业管理员（不是项目负责人也可以）、
 * 企业项目负责人、咨询师和运营都能改；组织是企业级的，改了对本企业所有项目生效。
 * 不带 projectId 的老入口（运营、企业管理员按企业维护）接口还留着。
 */
/** 层级：企业自己的叫法（kindName）优先，由它定用途；没有就按传来的 kind，都没有按部门。 */
const orgKindValues = (input: { kind?: unknown; kindName?: unknown }) =>
  orgKindFromName(String(input.kindName ?? '').trim() || input.kind);

async function loadOrgScope(ctx: Context, input: { enterpriseId: number; projectId?: number }) {
  if (!input.projectId) return loadEnterpriseScope(ctx, input.enterpriseId, true);
  const pc = await loadProjectContext(ctx, input.projectId);
  if (!pc.access.isOps && !pc.access.isEntAdmin && !['ent_lead', 'consultant'].includes(pc.projectRole ?? '')) {
    throw new HttpError(403, '只有企业管理员、企业项目负责人或咨询师可以在项目里维护组织');
  }
  const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: pc.project.get('enterpriseId') });
  if (!enterprise || (input.enterpriseId && Number(input.enterpriseId) !== enterprise.get('id'))) throw new HttpError(404, '企业不存在');
  return { enterprise, spaceName: pc.spaceName };
}

export async function saveOrgUnit(
  ctx: Context,
  input: {
    projectId?: number;
    enterpriseId: number;
    id?: number;
    name: string;
    kind?: string;
    kindName?: string | null;
    parentId?: number | null;
    headId?: number | null;
    headName?: string | null;
    duty?: string | null;
    sort?: number;
  },
) {
  const { enterprise, spaceName } = await loadOrgScope(ctx, input);
  const repo = ctx.db.getRepository('dz_org_units');
  const enterpriseId = enterprise.get('id');
  const parentId = input.parentId ? positiveId(input.parentId, '上级部门') : null;
  if (parentId) {
    const parent = await repo.findOne({ filter: { id: parentId, enterpriseId } });
    if (!parent) throw new HttpError(400, '上级部门不属于本企业');
    // 层级不限深度，所以要防绕圈：从新上级一路往上，不能碰到自己。
    let cursor: any = parent;
    for (let hops = 0; input.id && cursor && hops < 50; hops++) {
      if (Number(cursor.get('id')) === Number(input.id)) throw new HttpError(400, '上级部门不能是自己或自己的下级');
      const upper = cursor.get('parentId');
      cursor = upper ? await repo.findOne({ filter: { id: upper, enterpriseId } }) : null;
    }
  }
  const values = {
    name: text(input.name, '部门名称', 50),
    ...orgKindValues(input),
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
  input: { enterpriseId: number; projectId?: number; rows: { name: string; parent?: string; kind?: string; kindName?: string | null; head?: string; duty?: string }[] },
) {
  const { enterprise, spaceName } = await loadOrgScope(ctx, input);
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
        ...orgKindValues(row),
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

export async function deleteOrgUnit(ctx: Context, input: { enterpriseId: number; projectId?: number; id: number }) {
  const { enterprise } = await loadOrgScope(ctx, input);
  const id = positiveId(input.id, '部门');
  const enterpriseId = enterprise.get('id');
  const repo = ctx.db.getRepository('dz_org_units');
  if (await repo.count({ filter: { parentId: id, enterpriseId } })) throw new HttpError(409, '请先删除或移走下级部门');
  if (
    (await ctx.db.getRepository('dz_accounts').count({ filter: { orgUnitId: id } })) ||
    (await ctx.db.getRepository('dz_project_members').count({ filter: { orgUnitId: id } }))
  ) {
    throw new HttpError(409, '还有成员归属这个部门，请先在成员管理里调整他们的部门');
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
    service?: string;
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
  if (input.service !== undefined) values.service = input.service === 'self' ? 'self' : 'guided';
  if (input.primaryExpression !== undefined) values.primaryExpression = input.primaryExpression === 'sixfold' ? 'sixfold' : 'house';
  if (input.keyProjectLevel !== undefined) values.keyProjectLevel = Number(input.keyProjectLevel) === 1 ? 1 : 2;
  if (input.scheduleScale !== undefined) values.scheduleScale = input.scheduleScale === 'quarter' ? 'quarter' : 'month';
  if (input.status !== undefined) {
    if (!['active', 'archived'].includes(input.status)) throw new HttpError(400, '状态不正确');
    values.status = input.status;
  }
  const archiving = values.status === 'archived' && project.get('status') !== 'archived';
  await project.update(values);
  const invitesDisabled = archiving ? await disableProjectInvites(ctx, project.get('id') as number) : 0;
  await audit(ctx, spaceName, 'project.update', { projectId: project.get('id'), ...values, ...(archiving ? { invitesDisabled } : {}) });
  return project.toJSON();
}

/** 项目归档时停用绑着它的邀请码（恢复项目不会自动启用，需要的话重新发码）。返回停用了几个。 */
export async function disableProjectInvites(ctx: Context, projectId: number, transaction?: any): Promise<number> {
  const invites = await ctx.db.getRepository('dz_invites').find({ filter: { projectId, status: 'active' }, transaction });
  for (const invite of invites) await invite.update({ status: 'disabled' }, { transaction });
  return invites.length;
}

// ── 归档与删除（运营，和本企业的企业管理员）──────────────────────────

/** 运营能管所在空间的任何项目；企业管理员只能管本企业的（一家企业一个空间，按空间成员核对）。 */
async function loadManagedProject(ctx: Context, projectId: unknown) {
  const access = await systemAccess(ctx);
  const project = await ctx.db.getRepository('dz_projects').findOne({ filterByTk: positiveId(projectId, '项目') });
  if (!project) throw new HttpError(404, '项目不存在');
  const spaceName = project.get('spaceName') as string;
  if (!(await userSpaceNames(ctx)).includes(spaceName)) throw new HttpError(404, '项目不存在');
  if (!access.isOps && !access.isEntAdmin) throw new HttpError(403, '只有本企业管理员或运营管理员可以归档、删除项目');
  if (!access.isOps) {
    const enterprise = await ctx.db.getRepository('dz_enterprises').findOne({ filterByTk: project.get('enterpriseId') });
    if (enterprise?.get('status') === 'suspended') throw new HttpError(403, '该企业已停用，请联系咨询机构', 'ENTERPRISE_SUSPENDED');
  }
  return { project, spaceName };
}

/** 归档 / 恢复：归档的项目收进「已归档」，不出现在咨询师工作台和邀请码的可选项目里，绑着它的邀请码一起停用；内容不锁，随时可以恢复。 */
export async function setProjectArchived(ctx: Context, input: { projectId: number; archived: boolean }) {
  const { project, spaceName } = await loadManagedProject(ctx, input.projectId);
  const status = input.archived === true ? 'archived' : 'active';
  let invitesDisabled = 0;
  if (project.get('status') !== status) {
    await project.update({ status });
    if (status === 'archived') invitesDisabled = await disableProjectInvites(ctx, project.get('id') as number);
    await audit(ctx, spaceName, status === 'archived' ? 'project.archive' : 'project.restore', {
      projectId: project.get('id'),
      name: project.get('name'),
      ...(status === 'archived' ? { invitesDisabled } : {}),
    });
  }
  return { ...project.toJSON(), invitesDisabled };
}

/**
 * 删除项目，不可恢复。调用方要原样传回项目名称（confirmName）。一个事务里删掉项目和它名下的数据
 * （PROJECT_OWNED_COLLECTIONS），绑定它的邀请码停用并解绑；提交后再删资料原件。审计事件留着。
 */
export async function deleteProject(ctx: Context, input: { projectId: number; confirmName?: unknown }) {
  const { project, spaceName } = await loadManagedProject(ctx, input.projectId);
  const projectId = project.get('id') as number;
  const name = String(project.get('name') ?? '');
  if (!deleteConfirmed(name, input.confirmName)) throw new HttpError(400, '请原样输入项目名称来确认删除', 'CONFIRM_NAME_MISMATCH');

  const memberIds = await projectMemberIds(ctx, projectId);
  const materials = await ctx.db.getRepository('dz_materials').find({ filter: { projectId }, fields: ['id', 'fileId'] });
  const claimed = await ctx.db.getRepository(PROJECT_FILE_COLLECTION).find({ filter: { projectId }, fields: ['id'] });
  const fileIds = [...new Set([...materials.map((m: any) => m.get('fileId')), ...claimed.map((f: any) => f.get('id'))].filter(Boolean).map(Number))];

  const removed: Record<string, number> = {};
  await ctx.db.sequelize.transaction(async (transaction: any) => {
    for (const collection of PROJECT_OWNED_COLLECTIONS) {
      removed[collection] = await ctx.db.getRepository(collection).model.destroy({ where: { projectId }, transaction });
    }
    const invites = await ctx.db.getRepository('dz_invites').find({ filter: { projectId }, transaction });
    for (const invite of invites) await invite.update({ status: 'disabled', projectId: null, projectRole: null }, { transaction });
    await project.destroy({ transaction });
    await audit(ctx, spaceName, 'project.delete', { projectId, name, enterpriseId: project.get('enterpriseId'), removed, invitesDisabled: invites.length, files: fileIds.length }, transaction);
  });

  // 以下都在提交之后，失败只记日志，不影响已经完成的删除。
  // 告诉原来的项目成员（通知不挂在已经不存在的项目上）。
  await notify(ctx, {
    projectId: null as unknown as number,
    spaceName,
    userIds: memberIds,
    kind: 'projectDeleted',
    title: `项目「${name}」已被删除`,
    content: '项目和它的表、版本、批注、资料都已删除，无法恢复。',
    link: '/projects',
  }).catch((error: any) => ctx.app.logger.warn(`dingze: notifying the deletion of project ${projectId} failed: ${error?.message ?? error}`));

  // 资料原件不在事务里：逐个删文件记录（file-manager 的钩子连同存储里的文件一起删）。
  let filesFailed = 0;
  for (const fileId of fileIds) {
    try {
      await ctx.db.getRepository(PROJECT_FILE_COLLECTION).destroy({ filterByTk: fileId });
    } catch (error: any) {
      filesFailed++;
      ctx.app.logger.warn(`dingze: deleting material file ${fileId} of project ${projectId} failed: ${error?.message ?? error}`);
    }
  }
  return { ok: true, removed, files: fileIds.length, filesFailed };
}
