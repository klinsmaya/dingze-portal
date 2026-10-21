import type { Context } from '@nocobase/actions';

import { MATERIAL_TEXT_LIMIT, type EnterpriseProfile, reconcileProfile, searchSnippets } from '../../shared';
import { HttpError, type ProjectContext, currentUserId } from './access';

// 资料与企业画像. A material keeps the original upload (dz_material_files on local storage) and
// the text extracted from it in the browser, which the digital consultants search. Every read,
// including the original file, goes through the project check.

const who = (user: any) => (user ? user.get('nickname') || user.get('username') || '' : '');

function requireEditor(pc: ProjectContext) {
  if (pc.access.isConsultAdmin) return;
  if (!pc.projectRole || pc.projectRole === 'readonly') throw new HttpError(403, '只读成员不能修改资料与画像');
}

export async function listMaterials(ctx: Context, pc: ProjectContext) {
  const rows = await ctx.db.getRepository('dz_materials').find({
    filter: { projectId: pc.project.get('id') },
    fields: ['id', 'title', 'kind', 'fileName', 'size', 'chars', 'fileId', 'createdAt', 'createdById'],
    appends: ['createdBy'],
    sort: ['-createdAt'],
  });
  return rows.map((m: any) => ({
    id: Number(m.get('id')),
    title: m.get('title'),
    kind: m.get('kind'),
    fileName: m.get('fileName') ?? '',
    size: m.get('size') ?? 0,
    chars: m.get('chars') ?? 0,
    hasFile: !!m.get('fileId'),
    at: m.get('createdAt'),
    by: who(m.get('createdBy')),
    byId: m.get('createdById'),
  }));
}

export async function getMaterial(ctx: Context, pc: ProjectContext, id: unknown, offset: unknown) {
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { id: Number(id), projectId: pc.project.get('id') } });
  if (!m) throw new HttpError(404, '资料不存在');
  const text = (m.get('text') as string) ?? '';
  const from = Math.max(0, Number(offset) || 0);
  return { id: Number(m.get('id')), title: m.get('title'), fileName: m.get('fileName') ?? '', hasFile: !!m.get('fileId'), chars: text.length, offset: from, text: text.slice(from, from + 20_000) };
}

export async function addMaterial(
  ctx: Context,
  pc: ProjectContext,
  input: { title?: unknown; kind?: unknown; fileName?: unknown; size?: unknown; text?: unknown; fileId?: unknown },
) {
  requireEditor(pc);
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
    if (!text && !file) throw new HttpError(400, '没有读到文字内容');
    const title = String(input.title ?? input.fileName ?? '').trim().slice(0, 200) || '未命名资料';
    const stored = text.slice(0, MATERIAL_TEXT_LIMIT);
    const m = await ctx.db.getRepository('dz_materials').create({
      values: {
        projectId,
        title,
        kind: input.kind === 'note' ? 'note' : 'file',
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

/** Streams the original upload of a material to a member of its project. */
export async function downloadMaterial(ctx: Context, pc: ProjectContext, id: unknown) {
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { id: Number(id), projectId: pc.project.get('id') } });
  if (!m) throw new HttpError(404, '资料不存在');
  if (!m.get('fileId')) throw new HttpError(404, '这份资料没有保存原件（是直接粘贴的文字）');
  const file: any = await ctx.db.getRepository('dz_material_files').findOne({ filterByTk: m.get('fileId'), filter: { projectId: pc.project.get('id') } });
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
  if (!m) throw new HttpError(404, '资料不存在');
  const mine = m.get('createdById') === currentUserId(ctx);
  if (!mine && !pc.access.isConsultAdmin && !['ent_lead', 'lead_consultant'].includes(pc.projectRole ?? '')) {
    throw new HttpError(403, '只有上传人、企业项目负责人或主咨询师可以删除资料');
  }
  const fileId = m.get('fileId');
  await m.destroy();
  // Removing the record also removes the stored file (file-manager hook).
  if (fileId) await ctx.db.getRepository('dz_material_files').destroy({ filterByTk: fileId });
  return { ok: true };
}

export async function searchMaterials(ctx: Context, pc: ProjectContext, query: unknown) {
  const rows = await ctx.db.getRepository('dz_materials').find({ filter: { projectId: pc.project.get('id') }, fields: ['id', 'title', 'text'] });
  return searchSnippets(
    rows.map((m: any) => ({ id: m.get('id'), title: m.get('title'), text: m.get('text') ?? '' })),
    String(query ?? ''),
  );
}

export async function getProfile(ctx: Context, pc: ProjectContext) {
  const row = await ctx.db.getRepository('dz_profiles').findOne({ filter: { projectId: pc.project.get('id') }, appends: ['updatedBy'] });
  return { items: (row?.get('items') as EnterpriseProfile['items']) ?? [], rev: row?.get('rev') ?? 0, updatedAt: row?.get('updatedAt') ?? null, updatedBy: who(row?.get('updatedBy')) };
}

export async function saveProfile(ctx: Context, pc: ProjectContext, input: { items?: unknown; baseRev?: unknown }) {
  requireEditor(pc);
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
