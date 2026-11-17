import type { Context } from '@nocobase/actions';

import { MATERIAL_TEXT_LIMIT, type EnterpriseProfile, canManageLibrary, isArtifactCode, reconcileProfile, searchSnippets } from '../../shared';
import { HttpError, type ProjectContext, currentUserId } from './access';

// 资料与企业画像. A material keeps the original upload (dz_material_files on local storage) and
// the text extracted from it in the browser, which the digital consultants search. Every read,
// including the original file, goes through the project check.
//
// 企业共用：资料库里的资料可以标成「企业共用」（企业简介、组织架构这类每个项目都要用的），同一企业的
// 其他项目就能看到、检索、下载，不用重传。资料仍归上传它的项目管：只有那个项目能取消共用或删除。

const who = (user: any) => (user ? user.get('nickname') || user.get('username') || '' : '');

/** Anyone who can fill tables may attach a file to one; 只读 cannot. */
function requireEditor(pc: ProjectContext) {
  if (pc.access.isConsultAdmin) return;
  if (!pc.projectRole || pc.projectRole === 'readonly') throw new HttpError(403, '只读成员不能修改资料与画像');
}

/** The project library and the profile: 企业项目负责人、咨询师、咨询管理员 (普通员工只能传表下附件). */
function requireLibraryManager(pc: ProjectContext) {
  if (!canManageLibrary(pc.projectRole, pc.access.isConsultAdmin)) throw new HttpError(403, '只有企业管理员和咨询师可以管理项目资料库和企业画像');
}

// 表下附件建的时候 inLibrary 就是 false，「加入资料库」后变 true；资料库的资料一直是 true（老数据为空也算）。
const inLibrary = (m: any) => m.get('inLibrary') !== false;

/** 本项目读得到的资料：自己的，加上同一企业其他项目标了「企业共用」的。`from` 给出别的项目的名字。 */
export async function materialScope(ctx: Context, pc: ProjectContext) {
  const projectId = pc.project.get('id');
  const enterpriseId = pc.project.get('enterpriseId');
  const others: any[] = enterpriseId
    ? await ctx.db.getRepository('dz_projects').find({ filter: { enterpriseId, id: { $ne: projectId } }, fields: ['id', 'name'] })
    : [];
  const from = new Map<number, string>(others.map((p) => [Number(p.get('id')), String(p.get('name') ?? '')]));
  const filter = from.size ? { $or: [{ projectId }, { shared: true, projectId: { $in: [...from.keys()] } }] } : { projectId };
  return { filter, from };
}

/** 一份本项目读得到的资料（含别的项目共用过来的）。 */
async function findReadable(ctx: Context, pc: ProjectContext, id: unknown) {
  const { filter } = await materialScope(ctx, pc);
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { $and: [{ id: Number(id) }, filter] } });
  // 共用过来的只算资料库里的；本项目自己的附件照旧能读。
  if (!m || (Number(m.get('projectId')) !== Number(pc.project.get('id')) && !inLibrary(m))) throw new HttpError(404, '资料不存在');
  return m;
}

const summary = (m: any, from?: Map<number, string>) => ({
  id: Number(m.get('id')),
  title: m.get('title'),
  kind: m.get('kind'),
  artifactCode: m.get('artifactCode') ?? null,
  inLibrary: inLibrary(m),
  shared: !!m.get('shared'),
  /** 别的项目共用过来的：那个项目的名字；本项目自己的为 null。 */
  fromProject: from?.get(Number(m.get('projectId'))) ?? null,
  fileName: m.get('fileName') ?? '',
  size: m.get('size') ?? 0,
  chars: m.get('chars') ?? 0,
  hasFile: !!m.get('fileId'),
  at: m.get('createdAt'),
  by: who(m.get('createdBy')),
  byId: m.get('createdById'),
});

const SUMMARY_FIELDS = ['id', 'projectId', 'title', 'kind', 'artifactCode', 'inLibrary', 'shared', 'fileName', 'size', 'chars', 'fileId', 'createdAt', 'createdById'];

/** The project library: what the digital consultants search. Attachments show here only once added to it. */
export async function listMaterials(ctx: Context, pc: ProjectContext) {
  const { filter, from } = await materialScope(ctx, pc);
  const rows = await ctx.db.getRepository('dz_materials').find({
    filter,
    fields: SUMMARY_FIELDS,
    appends: ['createdBy'],
    sort: ['-createdAt'],
  });
  return rows.filter(inLibrary).map((m: any) => summary(m, from));
}

/** Files attached to one table while filling it (not in the library unless added). */
export async function listAttachments(ctx: Context, pc: ProjectContext, code: unknown) {
  // 不带表号：整个项目的附件（资料页“成员上传的材料”，企业管理员挑着加入资料库）。
  const all = code === undefined || code === null || code === '';
  if (!all && !isArtifactCode(String(code))) throw new HttpError(400, '没有这张表');
  const rows = await ctx.db.getRepository('dz_materials').find({
    filter: { projectId: pc.project.get('id'), kind: 'attachment', ...(all ? {} : { artifactCode: String(code) }) },
    fields: SUMMARY_FIELDS,
    appends: ['createdBy'],
    sort: ['-createdAt'],
  });
  return rows.map(summary);
}

/** 企业管理员把一份附件加入资料库（之后数字咨询师检索得到）；再点一次可以移出。 */
export async function setMaterialLibrary(ctx: Context, pc: ProjectContext, id: unknown, on: unknown) {
  requireLibraryManager(pc);
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { id: Number(id), projectId: pc.project.get('id') } });
  if (!m) throw new HttpError(404, '资料不存在');
  if (m.get('kind') !== 'attachment') throw new HttpError(400, '只有表下附件需要加入资料库');
  const next = on !== false && on !== 'false';
  // 移出资料库的附件不再共用。
  await m.update(next ? { inLibrary: true } : { inLibrary: false, shared: false });
  return summary(m);
}

/** 把资料库里的一份资料设为「企业共用」（本企业其他项目也能用），或取消。只能在上传它的项目里改。 */
export async function setMaterialShared(ctx: Context, pc: ProjectContext, id: unknown, on: unknown) {
  requireLibraryManager(pc);
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { id: Number(id), projectId: pc.project.get('id') } });
  if (!m) throw new HttpError(404, '资料不存在，或是别的项目共用过来的（请到上传它的项目里改）');
  if (!inLibrary(m)) throw new HttpError(400, '先把这份附件加入资料库，才能设为企业共用');
  await m.update({ shared: on !== false && on !== 'false' });
  return summary(m);
}

export async function getMaterial(ctx: Context, pc: ProjectContext, id: unknown, offset: unknown) {
  const m = await findReadable(ctx, pc, id);
  const text = (m.get('text') as string) ?? '';
  const from = Math.max(0, Number(offset) || 0);
  return { id: Number(m.get('id')), title: m.get('title'), fileName: m.get('fileName') ?? '', hasFile: !!m.get('fileId'), chars: text.length, offset: from, text: text.slice(from, from + 20_000) };
}

export async function addMaterial(
  ctx: Context,
  pc: ProjectContext,
  input: { title?: unknown; kind?: unknown; fileName?: unknown; size?: unknown; text?: unknown; fileId?: unknown; artifactCode?: unknown; shared?: unknown },
) {
  const attachment = input.kind === 'attachment';
  if (attachment) {
    requireEditor(pc);
    if (!isArtifactCode(String(input.artifactCode ?? ''))) throw new HttpError(400, '附件要挂在一张表下');
  } else requireLibraryManager(pc);
  const text = String(input.text ?? '').trim();
  const projectId = pc.project.get('id');
  return ctx.db.sequelize.transaction(async (transaction: any) => {
    // The original must be the caller's own, fresh upload that no material has claimed yet.
    let file: any = null;
    if (input.fileId) {
      file = await ctx.db.getRepository('dz_material_files').findOne({ filterByTk: Number(input.fileId), transaction });
      if (!file || Number(file.get('createdById')) !== currentUserId(ctx) || file.get('projectId')) throw new HttpError(400, '原件不存在或已被使用，请重新上传');
      await file.update({ projectId }, { transaction });
    }
    // A library material needs text to be searchable; an attachment may be a picture the model reads directly.
    if (!text && !file) throw new HttpError(400, '没有读到文字内容');
    const title = String(input.title ?? input.fileName ?? '').trim().slice(0, 200) || '未命名资料';
    const stored = text.slice(0, MATERIAL_TEXT_LIMIT);
    const m = await ctx.db.getRepository('dz_materials').create({
      values: {
        projectId,
        title,
        kind: attachment ? 'attachment' : input.kind === 'note' ? 'note' : 'file',
        artifactCode: attachment ? String(input.artifactCode) : null,
        inLibrary: !attachment,
        shared: !attachment && input.shared === true,
        fileName: String(input.fileName ?? file?.get('title') ?? '').slice(0, 200),
        size: Number(input.size) || Number(file?.get('size')) || 0,
        mimetype: file?.get('mimetype') ?? null,
        fileId: file ? Number(file.get('id')) : null,
        text: stored,
        chars: stored.length,
        spaceName: pc.spaceName,
      },
      context: ctx,
      transaction,
    });
    return { id: Number(m.get('id')), truncated: text.length > MATERIAL_TEXT_LIMIT, searchable: stored.length > 0 };
  });
}

/** Streams the original upload of a material to a member of its project (or, for a shared one, of a project of the same enterprise). */
export async function downloadMaterial(ctx: Context, pc: ProjectContext, id: unknown) {
  const m = await findReadable(ctx, pc, id);
  if (!m.get('fileId')) throw new HttpError(404, '这份资料没有保存原件（是直接粘贴的文字）');
  // 原件挂在上传它的项目下（共用过来的资料也是）。
  const file: any = await ctx.db.getRepository('dz_material_files').findOne({ filterByTk: m.get('fileId'), filter: { projectId: m.get('projectId') } });
  if (!file) throw new HttpError(404, '原件已不存在');
  const fileManager: any = ctx.app.pm.get('file-manager');
  const { stream, contentType } = await fileManager.getFileStream(file);
  const name = String(m.get('fileName') || `${file.get('title') ?? '资料'}${file.get('extname') ?? ''}`);
  ctx.withoutDataWrapping = true;
  ctx.set('Content-Type', contentType || file.get('mimetype') || 'application/octet-stream');
  ctx.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  ctx.set('Cache-Control', 'private, no-store');
  return stream;
}

export async function deleteMaterial(ctx: Context, pc: ProjectContext, id: unknown) {
  requireEditor(pc);
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { id: Number(id), projectId: pc.project.get('id') } });
  if (!m) throw new HttpError(404, '资料不存在，或是别的项目共用过来的（请到上传它的项目里删）');
  const mine = m.get('createdById') === currentUserId(ctx);
  // An attachment: its uploader or a library manager; a library material: library managers only.
  if (m.get('kind') === 'attachment' ? !mine && !canManageLibrary(pc.projectRole, pc.access.isConsultAdmin) : !canManageLibrary(pc.projectRole, pc.access.isConsultAdmin)) {
    throw new HttpError(403, m.get('kind') === 'attachment' ? '只有上传人或企业管理员可以删除这份附件' : '只有企业管理员和咨询师可以删除资料库的资料');
  }
  const fileId = m.get('fileId');
  await m.destroy();
  // Removing the record also removes the stored file (file-manager hook).
  if (fileId) await ctx.db.getRepository('dz_material_files').destroy({ filterByTk: fileId });
  return { ok: true };
}

export async function searchMaterials(ctx: Context, pc: ProjectContext, query: unknown) {
  const { filter } = await materialScope(ctx, pc);
  const rows = await ctx.db.getRepository('dz_materials').find({ filter, fields: ['id', 'title', 'text', 'kind', 'inLibrary'] });
  return searchSnippets(
    rows.filter(inLibrary).map((m: any) => ({ id: m.get('id'), title: m.get('title'), text: m.get('text') ?? '' })),
    String(query ?? ''),
  );
}

export async function getProfile(ctx: Context, pc: ProjectContext) {
  const row = await ctx.db.getRepository('dz_profiles').findOne({ filter: { projectId: pc.project.get('id') }, appends: ['updatedBy'] });
  return { items: (row?.get('items') as EnterpriseProfile['items']) ?? [], rev: row?.get('rev') ?? 0, updatedAt: row?.get('updatedAt') ?? null, updatedBy: who(row?.get('updatedBy')) };
}

export async function saveProfile(ctx: Context, pc: ProjectContext, input: { items?: unknown; baseRev?: unknown }) {
  requireLibraryManager(pc);
  const repo = ctx.db.getRepository('dz_profiles');
  const projectId = pc.project.get('id');
  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const row = await repo.findOne({ filter: { projectId }, transaction });
    const rev = row?.get('rev') ?? 0;
    if (Number(input.baseRev ?? 0) !== rev) throw new HttpError(409, '画像刚被其他人更新过，请刷新后再改', 'CONFLICT', { rev });
    const previous = { items: (row?.get('items') as EnterpriseProfile['items']) ?? [] };
    const next = { items: Array.isArray(input.items) ? (input.items as EnterpriseProfile['items']) : [] };
    const { profile, error } = reconcileProfile(previous, next, pc.projectRole, pc.access.isConsultAdmin);
    if (error) throw new HttpError(403, error);
    if (row) await row.update({ items: profile.items, rev: rev + 1, updatedById: currentUserId(ctx) }, { transaction });
    else await repo.create({ values: { projectId, items: profile.items, rev: 1, spaceName: pc.spaceName }, context: ctx, transaction });
    return { rev: rev + 1, items: profile.items };
  });
}
