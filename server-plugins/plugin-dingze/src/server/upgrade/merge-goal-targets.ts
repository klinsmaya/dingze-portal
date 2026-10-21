import type Database from '@nocobase/database';

// 附录 B gives 定目标 no number of its own: its result is the target zone of S2-03. Projects
// created before that change kept it as a separate artifact `S2-03-T`; fold each one into
// S2-03 once. Idempotent: it does nothing when no `S2-03-T` rows are left.

const OLD = 'S2-03-T';
const NEW = 'S2-03';
const CODE_TABLES = ['dz_comments', 'dz_exports', 'dz_dissents', 'dz_proposals', 'dz_step_exceptions', 'dz_audit_events', 'dz_guidance_gaps'];

export async function mergeGoalTargets(db: Database, log: (message: string) => void) {
  const artifacts = db.getRepository('dz_artifacts');
  const olds = await artifacts.find({ filter: { code: OLD } });
  for (const old of olds as any[]) {
    const projectId = old.get('projectId');
    await db.sequelize.transaction(async (transaction: any) => {
      const versions = db.getRepository('dz_artifact_versions');
      const oldCurrent: any = old.get('currentVersionId') ? await versions.findOne({ filterByTk: old.get('currentVersionId'), transaction }) : null;
      const targets = oldCurrent?.get('payload') ?? null;
      const target: any = await artifacts.findOne({ filter: { projectId, code: NEW }, transaction });
      let mergedVersionId: number | null = null;

      if (!target) {
        // 找路径 never started: S2-03-T simply becomes S2-03, its versions wrapped as the target zone.
        const own = await versions.find({ filter: { artifactId: old.get('id') }, transaction });
        for (const v of own as any[]) {
          await v.update({ code: NEW, payload: { nodes: [], targets: v.get('payload') ?? null } }, { transaction });
        }
        await old.update({ code: NEW }, { transaction });
        mergedVersionId = old.get('lockedVersionId') ?? old.get('currentVersionId') ?? null;
      } else {
        // Both exist: one new S2-03 version carries the paths plus the target zone.
        const current: any = target.get('currentVersionId') ? await versions.findOne({ filterByTk: target.get('currentVersionId'), transaction }) : null;
        const rev = Number(target.get('currentRev') ?? 0) + 1;
        const merged = await versions.create({
          values: {
            artifactId: target.get('id'),
            projectId,
            code: NEW,
            rev,
            kind: 'consultant_revision',
            payload: { ...(current?.get('payload') ?? { nodes: [] }), targets },
            upstreamRefs: current?.get('upstreamRefs') ?? {},
            note: '编号对齐附录 B：原“公司级年度目标（S2-03-T）”并入本表“第一步 定目标”',
            spaceName: target.get('spaceName'),
            createdById: current?.get('createdById') ?? null,
            updatedById: current?.get('updatedById') ?? null,
          },
          transaction,
        });
        mergedVersionId = Number(merged.get('id'));
        const currentId = target.get('currentVersionId');
        await target.update(
          {
            currentRev: rev,
            currentVersionId: mergedVersionId,
            stepDoneVersionId: target.get('stepDoneVersionId') && target.get('stepDoneVersionId') === currentId ? mergedVersionId : target.get('stepDoneVersionId'),
            lockedVersionId: target.get('lockedVersionId') && target.get('lockedVersionId') === currentId ? mergedVersionId : target.get('lockedVersionId'),
          },
          { transaction },
        );
        await db.getRepository('dz_dissents').update({ filter: { projectId, code: OLD }, values: { versionId: mergedVersionId }, transaction });
        await versions.destroy({ filter: { artifactId: old.get('id') }, transaction });
        await old.destroy({ transaction });
      }

      for (const table of CODE_TABLES) {
        await db.getRepository(table).update({ filter: { projectId, code: OLD }, values: { code: NEW }, transaction });
      }
      const notes = await db.getRepository('dz_notifications').find({ filter: { projectId, code: OLD }, transaction });
      for (const n of notes as any[]) {
        await n.update({ code: NEW, link: String(n.get('link') ?? '').replace(`/workspace/${OLD}`, `/workspace/${NEW}`) }, { transaction });
      }
      const requests = await db.getRepository('dz_expert_requests').find({ filter: { projectId }, transaction });
      for (const r of requests as any[]) {
        const refs = (r.get('refs') ?? []) as { code: string; versionId: number; rev: number }[];
        if (!refs.some((x) => x.code === OLD)) continue;
        const kept = refs.filter((x) => x.code !== OLD);
        if (!kept.some((x) => x.code === NEW) && mergedVersionId) {
          const v: any = await versions.findOne({ filterByTk: mergedVersionId, transaction });
          kept.push({ code: NEW, versionId: mergedVersionId, rev: Number(v?.get('rev') ?? 0) });
        }
        await r.update({ refs: kept }, { transaction });
      }
      // Versions remember which upstream versions they read; S2-03-T is no longer an upstream.
      const all = await db.getRepository('dz_artifact_versions').find({ filter: { projectId }, fields: ['id', 'upstreamRefs'], transaction });
      for (const v of all as any[]) {
        const refs = v.get('upstreamRefs') ?? {};
        if (!(OLD in refs)) continue;
        const { [OLD]: _gone, ...rest } = refs;
        await db.getRepository('dz_artifact_versions').update({ filterByTk: v.get('id'), values: { upstreamRefs: rest }, transaction });
      }
    });
    log(`dingze: merged ${OLD} into ${NEW} for project ${projectId}`);
  }
}
