import { randomBytes } from 'node:crypto';

import type { Context } from '@nocobase/actions';

import { HttpError, systemAccess } from './access';

// 演示数据迁移（2026-10-16，dev → 准生产）：只迁定责的数据——企业空间、账号、各 dz_* 表、资料原件。
// 导出在 dev 上跑，导入在新装好插件的准生产上跑；两边都只给超级管理员（root）。
// 记录按原编号写入，写完把自增序号校正到最大编号之后，引用（payload 里的版本号、部门号等）不用改。

/** 写入顺序：被引用的在前。dz_ai_sessions（对话缓存）不迁。 */
export const SNAPSHOT_ORDER = [
  'dz_camps',
  'dz_enterprises',
  'dz_org_units',
  'dz_projects',
  'dz_project_members',
  'dz_artifacts',
  'dz_artifact_versions',
  'dz_comments',
  'dz_dissents',
  'dz_proposals',
  'dz_step_exceptions',
  'dz_audit_events',
  'dz_exports',
  'dz_expert_requests',
  'dz_invites',
  'dz_registrations',
  'dz_guidance_gaps',
  'dz_notifications',
  'dz_profiles',
  'dz_materials',
] as const;

/** 指向 users 的外键：导入时不在快照里的账号一律改指向目标实例的 1 号管理员。 */
export const USER_FKS = ['createdById', 'updatedById', 'userId', 'headId', 'expertId', 'decidedById', 'reviewedById'];

export interface SnapshotUser {
  id: number;
  username: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  roles: string[];
  spaces: string[];
}

export interface SnapshotFile {
  id: number;
  title: string | null;
  filename: string | null;
  extname: string | null;
  mimetype: string | null;
  size: number | null;
  base64?: string;
}

// 字段名避开 rows / meta：NocoBase 会把返回值里的 rows 当列表数据包装。
export interface Snapshot {
  info: { from: string; at: string; version: string };
  spaces: { name: string; title: string | null }[];
  users: SnapshotUser[];
  tables: Record<string, Record<string, unknown>[]>;
  files: SnapshotFile[];
}

async function requireRoot(ctx: Context) {
  const access = await systemAccess(ctx);
  if (!access.isRoot) throw new HttpError(403, '只有超级管理员可以导出或导入演示数据');
}

const DZ_ROLES = ['dz_ops', 'dz_consult_admin', 'dz_consultant', 'dz_ent_admin', 'dz_ent_member'];

/** 去掉要排除的项目及其下属记录（如验证用的“功能测试”项目）。 */
export function dropProjects(rows: Snapshot['tables'], projectIds: number[]): Snapshot['tables'] {
  if (!projectIds.length) return rows;
  const drop = new Set(projectIds);
  const artifactIds = new Set((rows.dz_artifacts ?? []).filter((r) => drop.has(Number(r.projectId))).map((r) => Number(r.id)));
  const out: Snapshot['tables'] = {};
  for (const [name, list] of Object.entries(rows)) {
    out[name] = list.filter((r) => {
      if (name === 'dz_projects') return !drop.has(Number(r.id));
      if (r.projectId !== undefined && r.projectId !== null && drop.has(Number(r.projectId))) return false;
      if (name === 'dz_artifact_versions' && artifactIds.has(Number(r.artifactId))) return false;
      return true;
    });
  }
  return out;
}

/** 指向快照外账号的外键改到 fallback（目标实例的管理员），避免悬空。 */
export function remapUsers(rows: Snapshot['tables'], userIds: Set<number>, fallback: number): Snapshot['tables'] {
  const out: Snapshot['tables'] = {};
  for (const [name, list] of Object.entries(rows)) {
    out[name] = list.map((r) => {
      const next = { ...r };
      for (const key of USER_FKS) {
        const v = next[key];
        if (v !== undefined && v !== null && !userIds.has(Number(v))) next[key] = fallback;
      }
      return next;
    });
  }
  return out;
}

/** 资料原件换成目标实例上传后的新编号；没有原件的保持空。 */
export function remapFiles(rows: Snapshot['tables'], fileMap: Record<string, number>): Snapshot['tables'] {
  return {
    ...rows,
    dz_materials: (rows.dz_materials ?? []).map((m) => (m.fileId ? { ...m, fileId: fileMap[String(m.fileId)] ?? null } : m)),
  };
}

export async function exportSnapshot(ctx: Context, input: { excludeProjectIds?: unknown; withFiles?: unknown }) {
  await requireRoot(ctx);
  const enterprises: any[] = await ctx.db.getModel('dz_enterprises').findAll({ raw: true });
  const spaceNames = enterprises.map((e) => e.spaceName as string);
  const spaces: any[] = await ctx.db.getModel('spaces').findAll({ where: { name: spaceNames }, raw: true });

  // 账号：各企业空间的成员，加上持有定责角色的账号（运营、咨询方）。
  const users = new Map<number, SnapshotUser>();
  const add = (u: any, space?: string) => {
    const id = u.get('id') as number;
    const entry = users.get(id) ?? {
      id,
      username: u.get('username'),
      nickname: u.get('nickname') ?? null,
      email: u.get('email') ?? null,
      phone: u.get('phone') ?? null,
      roles: ((u.get('roles') ?? []) as any[]).map((r) => r.get('name')).filter((n: string) => DZ_ROLES.includes(n)),
      spaces: [],
    };
    if (space && !entry.spaces.includes(space)) entry.spaces.push(space);
    users.set(id, entry);
  };
  for (const name of spaceNames) {
    const members = await ctx.db.getRepository('spaces.users', name).find({ appends: ['roles'] });
    for (const u of members) add(u, name);
  }
  const staff = await ctx.db.getRepository('users').find({ filter: { 'roles.name': { $in: DZ_ROLES } }, appends: ['roles'] });
  for (const u of staff) add(u);
  // 超级管理员不迁：目标实例有自己的管理员。
  for (const [id, u] of users) if (!u.roles.length) users.delete(id);

  let rows: Snapshot['tables'] = {};
  for (const name of SNAPSHOT_ORDER) rows[name] = await ctx.db.getModel(name).findAll({ raw: true });
  const exclude = Array.isArray(input.excludeProjectIds) ? input.excludeProjectIds.map(Number).filter((n) => n > 0) : [];
  rows = dropProjects(rows, exclude);

  const fileIds = new Set((rows.dz_materials ?? []).map((m) => Number(m.fileId)).filter((n) => n > 0));
  const fileRows: any[] = fileIds.size ? await ctx.db.getRepository('dz_material_files').find({ filter: { id: { $in: [...fileIds] } } }) : [];
  const fileManager: any = ctx.app.pm.get('file-manager');
  const files: SnapshotFile[] = [];
  for (const f of fileRows) {
    const item: SnapshotFile = {
      id: f.get('id'),
      title: f.get('title') ?? null,
      filename: f.get('filename') ?? null,
      extname: f.get('extname') ?? null,
      mimetype: f.get('mimetype') ?? null,
      size: f.get('size') ?? null,
    };
    if (input.withFiles !== false) {
      const { stream } = await fileManager.getFileStream(f);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      item.base64 = Buffer.concat(chunks).toString('base64');
    }
    files.push(item);
  }

  return {
    info: { from: ctx.request?.host ?? '', at: new Date().toISOString(), version: (ctx.app as any).getPackageVersion?.() ?? '' },
    spaces: spaces.map((s) => ({ name: s.name, title: s.title ?? null })),
    users: [...users.values()].sort((a, b) => a.id - b.id),
    tables: rows,
    files,
  } satisfies Snapshot;
}

function quoted(ctx: Context, collection: string): string {
  const model: any = ctx.db.getModel(collection);
  const schema = (ctx.db as any).options?.schema || 'public';
  return `"${schema}"."${model.getTableName?.().tableName ?? model.tableName}"`;
}

class DryRun extends Error {}

/** 演示账号的随机初始密码：满足常见密码策略（大小写字母 + 数字 + 符号，16 位）。 */
export function initialPassword(): string {
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  const body = randomBytes(12).toString('base64url').replace(/[-_]/g, 'x');
  return `${pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}${pick('abcdefghijkmnpqrstuvwxyz')}${pick('23456789')}${body}!`;
}

/**
 * 导入：目标实例上定责表必须是空的（新装的插件）。按原编号写入，写完校正自增序号。
 * dryRun 时整个事务回滚，只返回将写入的条数和检查结果。
 */
export async function importSnapshot(ctx: Context, input: { snapshot: Snapshot; fileMap?: Record<string, number>; dryRun?: boolean }) {
  await requireRoot(ctx);
  const snap = input.snapshot;
  if (!snap?.tables || !Array.isArray(snap.users) || !Array.isArray(snap.spaces)) throw new HttpError(400, '快照格式不正确');
  const existing = await ctx.db.getRepository('dz_enterprises').count();
  if (existing) throw new HttpError(409, `目标实例已有 ${existing} 家企业，导入只用于空的准生产实例`);
  const clash = await ctx.db.getRepository('users').find({ filter: { $or: [{ id: { $in: snap.users.map((u) => u.id) } }, { username: { $in: snap.users.map((u) => u.username) } }] } });
  if (clash.length) throw new HttpError(409, `目标实例已有同编号或同名账号：${clash.map((u: any) => `${u.get('id')}:${u.get('username')}`).join('、')}`);
  const roles = await ctx.db.getRepository('roles').find({ filter: { name: { $in: DZ_ROLES } } });
  if (roles.length !== DZ_ROLES.length) throw new HttpError(409, '目标实例缺少定责角色，请先安装并启用定责插件');

  const admin = await ctx.db.getRepository('users').findOne({ filter: { 'roles.name': 'root' }, sort: ['id'] });
  const fallback = Number(admin?.get('id') ?? 1);
  let rows = remapUsers(snap.tables, new Set(snap.users.map((u) => u.id)), fallback);
  rows = remapFiles(rows, input.fileMap ?? {});

  const counts: Record<string, number> = {};
  const passwords: Record<string, string> = {};
  try {
    await ctx.db.sequelize.transaction(async (transaction: any) => {
      for (const s of snap.spaces) {
        await ctx.db.getRepository('spaces').create({ values: { name: s.name, title: s.title }, transaction });
      }
      counts.spaces = snap.spaces.length;
      for (const u of snap.users) {
        const password = initialPassword();
        passwords[u.username] = password;
        await ctx.db.getRepository('users').create({
          values: { id: u.id, username: u.username, nickname: u.nickname, email: u.email, phone: u.phone, password, roles: u.roles },
          transaction,
        });
      }
      counts.users = snap.users.length;
      for (const s of snap.spaces) {
        const ids = snap.users.filter((u) => u.spaces.includes(s.name)).map((u) => u.id);
        if (ids.length) await ctx.db.getRepository('spaces.users', s.name).add({ tk: ids, transaction });
      }
      // 版本表和成果表互相引用：先写成果（不带版本指针），写完版本再补上。
      const pointers = (rows.dz_artifacts ?? []).map((a) => ({ id: a.id, currentVersionId: a.currentVersionId, stepDoneVersionId: a.stepDoneVersionId, lockedVersionId: a.lockedVersionId }));
      for (const name of SNAPSHOT_ORDER) {
        let list = rows[name] ?? [];
        if (name === 'dz_artifacts') list = list.map((a) => ({ ...a, currentVersionId: null, stepDoneVersionId: null, lockedVersionId: null }));
        if (name === 'dz_org_units') list = [...list].sort((a, b) => Number(a.parentId ?? 0) - Number(b.parentId ?? 0) || Number(a.id) - Number(b.id));
        if (list.length) await ctx.db.getModel(name).bulkCreate(list, { hooks: false, transaction, validate: false });
        counts[name] = list.length;
      }
      for (const p of pointers) {
        await ctx.db.getModel('dz_artifacts').update(
          { currentVersionId: p.currentVersionId ?? null, stepDoneVersionId: p.stepDoneVersionId ?? null, lockedVersionId: p.lockedVersionId ?? null },
          { where: { id: p.id }, hooks: false, transaction },
        );
      }
      // 资料原件：上传时没有项目，按资料补上所属项目。
      for (const m of rows.dz_materials ?? []) {
        if (m.fileId) await ctx.db.getModel('dz_material_files').update({ projectId: m.projectId }, { where: { id: m.fileId }, hooks: false, transaction });
      }
      // 自增序号校正到最大编号之后，后面新建的记录不会撞号。
      for (const name of [...SNAPSHOT_ORDER, 'users']) {
        const table = quoted(ctx, name);
        await ctx.db.sequelize.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM ${table}), 0), 1))`, { transaction });
      }
      if (input.dryRun) throw new DryRun();
    });
  } catch (error) {
    if (error instanceof DryRun) return { dryRun: true, counts };
    throw error;
  }
  return { dryRun: false, counts, passwords };
}
