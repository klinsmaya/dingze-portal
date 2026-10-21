import type { Context } from '@nocobase/actions';
import { defineTools } from '@nocobase/ai';

import { searchSnippets } from '../../../../shared';
import { loadProjectContext } from '../../../../server/services/access';

// Read the enterprise's own materials for the digital consultant: keyword search returns cited
// snippets, an id returns the full text page by page. Access follows the chatting user's
// project membership, so another enterprise's materials are never reachable.
export default defineTools({
  scope: 'SPECIFIED',
  defaultPermission: 'ALLOW',
  introduction: {
    title: '查阅企业资料',
    about: '检索本企业上传的资料，返回带出处的片段或全文',
  },
  definition: {
    name: 'dingzeSearchMaterials',
    description:
      'Search the materials the enterprise uploaded (business reviews, reports, policies, industry notes). Pass `query` (keywords separated by spaces) for cited snippets, or `id` (material number) to read the full text, paging with `offset`. Cite the material title; never invent figures the materials do not contain.',
    schema: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: 'Project id from the page context.' },
        query: { type: 'string', description: 'Keywords separated by spaces.' },
        id: { type: 'number', description: 'Material number, to read its full text.' },
        offset: { type: 'number', description: 'Character offset when paging through a long material.' },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  invoke: async (ctx: Context, args: { projectId: number; query?: string; id?: number; offset?: number }) => {
    try {
      const pc = await loadProjectContext(ctx, args.projectId);
      const repo = ctx.db.getRepository('dz_materials');
      const projectId = pc.project.get('id');
      if (args.id) {
        const m = await repo.findOne({ filter: { id: Number(args.id), projectId } });
        if (!m) return { status: 'error', content: `资料 ${args.id} 不存在` };
        const text = (m.get('text') as string) ?? '';
        const from = Math.max(0, Number(args.offset) || 0);
        const page = text.slice(from, from + 8000);
        const more = from + page.length < text.length ? `（共 ${text.length} 字，下一段 offset=${from + page.length}）` : '';
        return { status: 'success', content: `[资料 ${m.get('id')}《${m.get('title')}》]${more}\n${page}` };
      }
      const rows = await repo.find({ filter: { projectId }, fields: ['id', 'title', 'text', 'chars'] });
      if (!args.query?.trim()) {
        if (!rows.length) return { status: 'success', content: '企业还没有上传资料。' };
        return { status: 'success', content: `企业资料清单：\n${rows.map((m: any) => `[资料 ${m.get('id')}]《${m.get('title')}》${m.get('chars') ?? 0} 字`).join('\n')}\n传 id 读全文，或传 query 检索。` };
      }
      const hits = searchSnippets(
        rows.map((m: any) => ({ id: m.get('id'), title: m.get('title'), text: m.get('text') ?? '' })),
        args.query,
      );
      if (!hits.length) return { status: 'success', content: '资料里没有找到相关内容。请向用户询问，或记为“待补”。' };
      return { status: 'success', content: hits.map((h) => `[资料 ${h.materialId}《${h.title}》] ${h.snippet}`).join('\n') };
    } catch (error) {
      return { status: 'error', content: error instanceof Error ? error.message : String(error) };
    }
  },
});
