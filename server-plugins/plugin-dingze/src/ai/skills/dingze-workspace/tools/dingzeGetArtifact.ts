import type { Context } from '@nocobase/actions';
import { defineTools } from '@nocobase/ai';

import { STATUS_LABELS, getArtifactDef, isArtifactCode, validateArtifact } from '../../../../shared';
import { loadProjectContext } from '../../../../server/services/access';
import { lastEvents } from '../../../../server/services/artifacts';

// Read-only view of one artifact for the digital consultant: the current draft, its
// validation issues and the upstream versions it builds on. Access follows the
// chatting user's own project membership.
export default defineTools({
  scope: 'SPECIFIED',
  defaultPermission: 'ALLOW',
  introduction: {
    title: '读取成果',
    about: '读取当前项目某张成果表的草稿、校验结果和上游成果',
  },
  definition: {
    name: 'dingzeGetArtifact',
    description:
      'Read one artifact (成果表) of the current project: its status, whether it was returned and why (returned.reason), open comments, which version is a draft and which is confirmed (confirmation), the latest saved content (JSON), structural validation issues, and the upstream artifacts it depends on. Always call this before suggesting changes. Structural issues being empty does not mean the table passed review: check returned and openComments.',
    schema: {
      type: 'object',
      properties: {
        projectId: { type: 'number', description: 'Project id from the page context.' },
        code: { type: 'string', description: 'Artifact code from the page context, e.g. S1-01.' },
      },
      required: ['projectId', 'code'],
      additionalProperties: false,
    },
  },
  invoke: async (ctx: Context, args: { projectId: number; code: string }) => {
    try {
      if (!isArtifactCode(args.code)) return { status: 'error', content: `未知的成果编号 ${args.code}` };
      const pc = await loadProjectContext(ctx, args.projectId);
      const def = getArtifactDef(args.code);
      const projectId = pc.project.get('id');
      const repo = ctx.db.getRepository('dz_artifacts');
      const row = await repo.findOne({ filter: { projectId, code: def.code }, appends: ['currentVersion', 'stepDoneVersion', 'lockedVersion'] });
      // Where the table stands in the flow (验收 D04): the return reason and open comments are
      // business facts that structural validation does not see.
      const event = (await lastEvents(ctx, [projectId])).get(`${projectId}:${def.code}`) ?? null;
      const returned = row?.get('status') === 'in_progress' && event && ['returnToEdit', 'forceReturn'].includes(event.action);
      const comments = await ctx.db.getRepository('dz_comments').find({
        filter: { projectId, code: def.code, resolved: false },
        appends: ['createdBy'],
        sort: ['id'],
        limit: 40,
      });
      const threads = comments.filter((c: any) => !c.get('parentId'));
      const openComments = threads.slice(0, 12).map((c: any) => ({
        where: c.get('anchorLabel') || '整张表',
        author: c.get('createdBy')?.get('nickname') ?? '',
        content: String(c.get('content') ?? '').slice(0, 200),
        replies: comments
          .filter((r: any) => r.get('parentId') === c.get('id'))
          .map((r: any) => `${r.get('createdBy')?.get('nickname') ?? ''}：${String(r.get('content') ?? '').slice(0, 120)}`),
      }));
      const lockedRev = row?.get('lockedVersion')?.get('rev') ?? null;
      const payload = row?.get('currentVersion')?.get('payload') ?? null;
      const upstream = [];
      for (const code of def.dependsOn) {
        const up = await repo.findOne({
          filter: { projectId, code },
          appends: ['lockedVersion', 'stepDoneVersion', 'currentVersion'],
        });
        // Prefer settled content; within a stage the upstream may still be a draft.
        const [version, basis] = up?.get('lockedVersion')
          ? [up.get('lockedVersion'), '已定版']
          : up?.get('stepDoneVersion')
            ? [up.get('stepDoneVersion'), '本步完成时的版本']
            : [up?.get('currentVersion'), '草稿（尚未完成，可能还会改）'];
        upstream.push({
          code,
          name: getArtifactDef(code).name,
          status: up ? STATUS_LABELS[up.get('status') as keyof typeof STATUS_LABELS] : '未开始',
          basis: version ? basis : null,
          payload: version?.get('payload') ?? null,
        });
      }
      return {
        status: 'success',
        content: JSON.stringify({
          code: def.code,
          name: def.name,
          task: def.task,
          step: def.step,
          bookRef: def.bookRef,
          status: row ? STATUS_LABELS[row.get('status') as keyof typeof STATUS_LABELS] : '未开始',
          rev: row?.get('currentRev') ?? 0,
          returned: returned ? { reason: event.reason || '（退回时没有写原因，请看批注）', by: event.by ?? null } : null,
          confirmation:
            row?.get('status') === 'locked'
              ? `已定版 v${lockedRev}：企业确认过的版本`
              : lockedRev
                ? `当前是重开后的草稿，尚未确认；上一次定版是 v${lockedRev}`
                : '尚未定版：表里的内容都是草稿，不是企业已确认的事实',
          stepDoneRev: row?.get('stepDoneVersion')?.get('rev') ?? null,
          lockedRev,
          upstreamChanged: row?.get('stale') ? row.get('staleReason') || '上游表有改动' : null,
          openComments,
          openCommentCount: threads.length,
          payload,
          issues: payload
            ? validateArtifact(def.code, payload, Object.fromEntries(upstream.map((u) => [u.code, u.payload])))
            : [],
          upstream,
        }),
      };
    } catch (error) {
      return { status: 'error', content: error instanceof Error ? error.message : String(error) };
    }
  },
});
