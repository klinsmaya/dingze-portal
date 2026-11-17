import type { Context } from '@nocobase/actions';

import { passwordProblem } from '../../shared';
import { HttpError, SYSTEM_ROLES, currentUserId } from './access';

// 账号上多记的几件事（dz_accounts）：属于哪家企业、哪个部门，停没停用，要不要先改初始密码。

type Db = Context['db'];

export interface AccountFacts {
  enterpriseId: number | null;
  orgUnitId: number | null;
  disabled: boolean;
  mustChangePassword: boolean;
}

const facts = (row: any): AccountFacts => ({
  enterpriseId: (row?.get('enterpriseId') as number | null) ?? null,
  orgUnitId: (row?.get('orgUnitId') as number | null) ?? null,
  disabled: !!row?.get('disabledAt'),
  mustChangePassword: !!row?.get('mustChangePassword'),
});

export async function accountFacts(db: Db, userId: number, transaction?: any): Promise<AccountFacts> {
  return facts(await db.getRepository('dz_accounts').findOne({ filter: { userId }, transaction }));
}

/** 一批账号的情况，按 userId 取；没有行的按“都没有”。 */
export async function accountFactsOf(db: Db, userIds: number[], transaction?: any): Promise<Map<number, AccountFacts>> {
  const rows = userIds.length ? await db.getRepository('dz_accounts').find({ filter: { userId: { $in: userIds } }, transaction }) : [];
  const map = new Map<number, AccountFacts>(rows.map((r: any) => [r.get('userId') as number, facts(r)]));
  for (const id of userIds) if (!map.has(id)) map.set(id, facts(null));
  return map;
}

/** 写账号上的一项或几项；没有行就建一行。`actorId` 是操作人（未登录的注册路径上是账号本人）。 */
export async function patchAccount(db: Db, userId: number, values: Record<string, unknown>, actorId: number | null, transaction?: any) {
  const repo = db.getRepository('dz_accounts');
  const row = await repo.findOne({ filter: { userId }, transaction });
  if (row) return row.update({ ...values, updatedById: actorId }, { transaction });
  return repo.create({ values: { userId, ...values, createdById: actorId, updatedById: actorId }, transaction });
}

/**
 * 部门归到人：记在账号上，同时改这个人在本企业所有项目里的项目成员记录（各张表读的是项目成员上的那一份）。
 * 调用方已经核对过权限，以及部门属于这家企业。
 */
export async function setAccountDepartment(db: Db, enterpriseId: number, userId: number, orgUnitId: number | null, actorId: number | null, transaction?: any) {
  await patchAccount(db, userId, { enterpriseId, orgUnitId }, actorId, transaction);
  const projectIds = (await db.getRepository('dz_projects').find({ filter: { enterpriseId }, fields: ['id'], transaction })).map((p: any) => p.get('id'));
  if (!projectIds.length) return 0;
  const rows = await db.getRepository('dz_project_members').find({ filter: { userId, projectId: { $in: projectIds } }, transaction });
  for (const row of rows) if ((row.get('orgUnitId') ?? null) !== orgUnitId) await row.update({ orgUnitId }, { transaction });
  return rows.length;
}

// ── 拦停用的账号和还没改初始密码的账号 ─────────────────────────────────

/**
 * 每个要登录的 dingze 动作先过这里：账号停用了什么都不能做；还在用初始密码的只能先改密码
 * （`accountStatus`、`changePassword` 两个动作不过这里）。没登录的不管，各动作自己会报“请先登录”。
 */
export async function assertAccountUsable(ctx: Context) {
  const userId = ctx.auth?.user?.id;
  if (!userId) return;
  const account = await accountFacts(ctx.db, userId);
  if (account.disabled) throw new HttpError(403, '这个账号已停用，请联系本企业管理员或咨询机构', 'ACCOUNT_DISABLED');
  if (account.mustChangePassword) throw new HttpError(403, '请先修改初始密码', 'MUST_CHANGE_PASSWORD');
}

/** 门户登录后先问一次：要不要先改密码、账号是不是停用了。 */
export async function accountStatus(ctx: Context) {
  const account = await accountFacts(ctx.db, currentUserId(ctx));
  return { disabled: account.disabled, mustChangePassword: account.mustChangePassword };
}

/** 本人改密码：要报对原密码。改完之后“要先改初始密码”的标记清掉。 */
export async function changePassword(ctx: Context, input: { oldPassword?: unknown; newPassword?: unknown }) {
  const userId = currentUserId(ctx);
  const account = await accountFacts(ctx.db, userId);
  if (account.disabled) throw new HttpError(403, '这个账号已停用，请联系本企业管理员或咨询机构', 'ACCOUNT_DISABLED');
  const oldPassword = String(input.oldPassword ?? '');
  const newPassword = String(input.newPassword ?? '');
  const problem = passwordProblem(newPassword);
  if (problem) throw new HttpError(400, problem);
  if (newPassword === oldPassword) throw new HttpError(400, '新密码不能和原密码一样');

  const users = ctx.db.getRepository('users');
  const user = await users.findOne({ filterByTk: userId });
  if (!user) throw new HttpError(404, '账号不存在');
  const field = ctx.db.getCollection('users').getField('password') as any;
  const stored = (user as any).password ?? user.get('password');
  if (!stored || !(await field.verify(oldPassword, stored))) throw new HttpError(400, '原密码不对');

  // Password-policy hooks on users read the request context.
  await users.update({ filterByTk: userId, values: { password: newPassword }, context: ctx });
  await patchAccount(ctx.db, userId, { mustChangePassword: false }, userId);
  await ctx.db.getRepository('dz_audit_events').create({
    values: { action: 'user.changePassword', meta: { userId, actorId: userId }, spaceName: null, createdById: userId, updatedById: userId },
  });
  return { ok: true };
}

/**
 * 登录接口返回之后再看一眼：停用的账号不发登录凭据。这个中间件挂在整个实例的登录接口上（别的门户也走它），
 * 所以只看 dz_accounts 里标了停用的账号，核对本身出错时照常放行，不影响任何人登录。
 */
export function signInGuard() {
  return async (ctx: any, next: () => Promise<void>) => {
    await next();
    if (ctx.action?.resourceName !== 'auth' || ctx.action?.actionName !== 'signIn') return;
    const userId = Number(ctx.body?.user?.id ?? ctx.body?.data?.user?.id);
    if (!userId) return;
    let disabled = false;
    try {
      disabled = (await accountFacts(ctx.db, userId)).disabled;
    } catch (error: any) {
      ctx.app?.logger?.warn?.(`dingze: checking whether account ${userId} is disabled failed: ${error?.message ?? error}`);
    }
    if (!disabled) return;
    ctx.status = 403;
    ctx.body = { errors: [{ message: '这个账号已停用，请联系本企业管理员或咨询机构', code: 'ACCOUNT_DISABLED' }] };
  };
}

/** 运营、咨询管理员的账号 id：新企业的空间他们都要在里面。 */
export async function staffUserIds(db: Db, transaction?: any): Promise<number[]> {
  const staff = await db.getRepository('users').find({
    filter: { 'roles.name': { $in: [SYSTEM_ROLES.ops, SYSTEM_ROLES.consultAdmin] } },
    fields: ['id'],
    transaction,
  });
  return [...new Set<number>(staff.map((u: any) => u.get('id') as number))];
}
