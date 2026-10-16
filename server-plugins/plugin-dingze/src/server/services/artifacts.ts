import type { Context } from '@nocobase/actions';

import {
  ARTIFACTS,
  type ArtifactDef,
  type ArtifactStatus,
  type LifecycleAction,
  LifecycleError,
  type StateMap,
  CONSULTANTS,
  PLAN_BOOK_BUNDLE,
  getArtifactDef,
  hasBlockingIssues,
  isArtifactCode,
  nextStatus,
  validationApplies,
  staleTargets,
  unlockInfo,
  validateArtifact,
  type SelfReviewAnswer,
  canPerform,
  missingSelfReview,
  selfReviewChecklist,
  type ImportSourceRow,
  canImportInto,
  importBasis,
  importBlocker,
} from '../../shared';
import { HttpError, type ProjectContext, currentUserId } from './access';
import { openCommentCounts } from './comments';
import { notifyTransition } from './notify';
import { PLAN_BOOKS, currentSources } from './plan-book-sources';

const LIFECYCLE_HTTP: Record<LifecycleError['code'], number> = {
  FORBIDDEN: 403,
  INVALID_STATE: 409,
  REASON_REQUIRED: 400,
  LOCKED_STEP: 409,
  VALIDATION_FAILED: 422,
};

export function toHttpError(error: unknown): unknown {
  if (error instanceof LifecycleError) return new HttpError(LIFECYCLE_HTTP[error.code], error.message, error.code);
  return error;
}

export function requireArtifactDef(code: unknown): ArtifactDef {
  if (typeof code !== 'string' || !isArtifactCode(code)) throw new HttpError(400, '未知的成果编号');
  return getArtifactDef(code);
}

export async function loadStates(ctx: Context, projectId: number, transaction?: any): Promise<StateMap> {
  const rows = await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId }, transaction });
  const states: StateMap = {};
  for (const row of rows) {
    states[row.get('code') as string] = {
      status: row.get('status') as ArtifactStatus,
      stale: !!row.get('stale'),
      exception: !!row.get('exception'),
      everCompleted: !!row.get('stepDoneVersionId'),
    };
  }
  return states;
}

async function audit(
  ctx: Context,
  pc: ProjectContext,
  values: { code?: string; action: string; reason?: string; fromStatus?: string; toStatus?: string; rev?: number; meta?: unknown },
  transaction: any,
) {
  await ctx.db.getRepository('dz_audit_events').create({
    values: { ...values, projectId: pc.project.get('id'), spaceName: pc.spaceName },
    context: ctx,
    transaction,
  });
}

async function ensureArtifact(ctx: Context, pc: ProjectContext, code: string, transaction: any) {
  const repo = ctx.db.getRepository('dz_artifacts');
  const projectId = pc.project.get('id');
  const existing = await repo.findOne({ filter: { projectId, code }, transaction });
  if (existing) return existing;
  return repo.create({
    values: { projectId, code, status: 'not_started', spaceName: pc.spaceName },
    context: ctx,
    transaction,
  });
}

/**
 * The version a downstream artifact should read from `upstream`: inside the same stage the
 * “本步完成” version is enough (Q10); across stages only the Locked version counts (Q1).
 */
function readableVersionId(upstream: any, sameStage: boolean): number | null {
  if (!upstream) return null;
  const locked = upstream.get('lockedVersionId');
  if (!sameStage) return locked ?? null;
  return upstream.get('stepDoneVersionId') ?? locked ?? null;
}

/** An upstream that had been completed and is now being edited again after a reopen. */
function isReopened(row: any): boolean {
  return !!row && !!row.get('stepDoneVersionId') && row.get('status') === 'in_progress';
}

async function upstreamState(ctx: Context, projectId: number, def: ArtifactDef, transaction: any) {
  const refs: Record<string, number | null> = {};
  const reopened: string[] = [];
  if (def.dependsOn.length === 0) return { refs, reopened };
  const rows = await ctx.db.getRepository('dz_artifacts').find({
    filter: { projectId, code: { $in: def.dependsOn } },
    transaction,
  });
  for (const code of def.dependsOn) {
    const row = rows.find((r: any) => r.get('code') === code);
    refs[code] = readableVersionId(row, getArtifactDef(code).stage === def.stage);
    if (isReopened(row)) reopened.push(code);
  }
  return { refs, reopened };
}

export async function artifactDetail(ctx: Context, pc: ProjectContext, def: ArtifactDef) {
  const projectId = pc.project.get('id');
  const states = await loadStates(ctx, projectId);
  const artifact = await ctx.db.getRepository('dz_artifacts').findOne({
    filter: { projectId, code: def.code },
    appends: ['currentVersion', 'stepDoneVersion', 'lockedVersion'],
  });
  const dissents = artifact
    ? await ctx.db.getRepository('dz_dissents').find({
        filter: { projectId, code: def.code },
        appends: ['createdBy'],
        sort: ['-createdAt'],
      })
    : [];
  return {
    code: def.code,
    unlock: unlockInfo(def, states),
    projectRole: pc.projectRole,
    artifact: artifact?.toJSON() ?? null,
    dissents: dissents.map((d: any) => d.toJSON()),
  };
}

export interface SaveInput {
  payload: unknown;
  baseRev: number;
  note?: string;
  /** Set when the content comes from accepting a stored AI proposal. */
  fromProposalId?: number;
  /** Set when the user confirmed a digital consultant's suggestion in the chat. */
  aiSuggested?: boolean;
  /** The edit commands this save contains (修改记录). */
  changes?: unknown;
}

const VIAS = ['edit', 'structure', 'chat', 'paste', 'undo', 'import'];

/** Keeps the command log small and well-formed: at most 200 commands, values clipped. */
export function sanitizeChanges(raw: unknown, by: string): unknown[] {
  if (!Array.isArray(raw)) return [];
  const clip = (v: unknown) => {
    if (v === undefined || v === null) return null;
    const text = typeof v === 'string' ? v : JSON.stringify(v);
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  };
  return raw.slice(-200).map((c: any) => ({
    via: VIAS.includes(c?.via) ? c.via : 'edit',
    label: String(c?.label ?? '').slice(0, 200),
    at: typeof c?.at === 'string' ? c.at : new Date().toISOString(),
    by,
    commentId: c?.commentId ? Number(c.commentId) || null : null,
    changes: (Array.isArray(c?.changes) ? c.changes : []).slice(0, 50).map((e: any) => ({
      path: String(e?.path ?? '').slice(0, 200),
      kind: ['added', 'removed', 'changed'].includes(e?.kind) ? e.kind : 'changed',
      before: clip(e?.before),
      after: clip(e?.after),
    })),
  }));
}

export async function saveArtifact(ctx: Context, pc: ProjectContext, def: ArtifactDef, input: SaveInput) {
  if (input.payload === undefined || input.payload === null) throw new HttpError(400, '缺少成果内容');
  const projectId = pc.project.get('id');
  const states = await loadStates(ctx, projectId);
  const unlock = unlockInfo(def, states);
  if (!unlock.unlocked && !states[def.code]?.exception) throw new HttpError(409, unlock.waitingFor ?? '这一步尚未解锁', 'LOCKED_STEP');

  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const artifact = await ensureArtifact(ctx, pc, def.code, transaction);
    const previousRefs = artifact.get('currentVersionId')
      ? ((await ctx.db.getRepository('dz_artifact_versions').findOne({ filterByTk: artifact.get('currentVersionId'), fields: ['upstreamRefs'], transaction }))?.get('upstreamRefs') ?? {})
      : {};
    const currentRev = artifact.get('currentRev') as number;
    if (Number(input.baseRev) !== currentRev) {
      throw new HttpError(409, '这份成果刚被其他人更新过，请刷新后再改', 'CONFLICT', { currentRev });
    }
    const from = artifact.get('status') as ArtifactStatus;
    const to = nextStatus('save', from, pc.actor);
    const isConsultant = !!pc.projectRole && CONSULTANTS.includes(pc.projectRole);
    const kind = input.fromProposalId || input.aiSuggested ? 'ai_draft' : isConsultant ? 'consultant_revision' : 'enterprise_edit';
    const upstream = await upstreamState(ctx, projectId, def, transaction);
    const version = await ctx.db.getRepository('dz_artifact_versions').create({
      values: {
        artifactId: artifact.get('id'),
        projectId,
        code: def.code,
        rev: currentRev + 1,
        kind,
        payload: input.payload,
        upstreamRefs: upstream.refs,
        note: input.note,
        changes: sanitizeChanges(input.changes, (ctx.auth?.user as any)?.nickname || (ctx.auth?.user as any)?.username || ''),
        spaceName: pc.spaceName,
      },
      context: ctx,
      transaction,
    });
    // 上游已变更不再“保存一次就消失”（客户反馈 2026-10-15）：要看过上游改了什么并点“已核对”。
    // 保存时记下核对基线（变更前读的上游版本），供“上游改了什么”对比。
    const wasStale = !!artifact.get('stale');
    const stillStale = wasStale || upstream.reopened.length > 0;
    await artifact.update(
      {
        status: to,
        currentRev: currentRev + 1,
        currentVersionId: version.get('id'),
        stale: stillStale,
        staleReason: stillStale
          ? artifact.get('staleReason') ??
            `${upstream.reopened.map((c) => getArtifactDef(c).specId).join('、')} 已解锁重开，正在修改`
          : null,
        upstreamBase: stillStale ? (artifact.get('upstreamBase') ?? previousRefs) : null,
      },
      { transaction },
    );
    if (input.fromProposalId) {
      await ctx.db.getRepository('dz_proposals').update({
        filter: { id: input.fromProposalId, projectId, status: 'pending' },
        values: { status: 'accepted', decidedById: currentUserId(ctx), decidedAt: new Date() },
        transaction,
      });
    }
    await audit(ctx, pc, { code: def.code, action: 'save', fromStatus: from, toStatus: to, rev: currentRev + 1, meta: { kind } }, transaction);
    return { status: to, rev: currentRev + 1, versionId: version.get('id') };
  });
}

/** The upstream versions this artifact was last in step with: the 核对基线, else its current version's refs. */
function baseRefs(artifact: any): Record<string, number | null> {
  return ((artifact?.get('upstreamBase') ?? artifact?.get('currentVersion')?.get('upstreamRefs') ?? {}) as Record<string, number | null>);
}

const PROPAGATING: LifecycleAction[] = ['stepDone', 'confirm', 'forceLock', 'reopen', 'forceReturn'];

async function markDownstreamStale(
  ctx: Context,
  pc: ProjectContext,
  def: ArtifactDef,
  reason: string,
  unconditional: boolean,
  transaction: any,
) {
  const projectId = pc.project.get('id');
  const states = await loadStates(ctx, projectId, transaction);
  const targets = staleTargets(def.code, states);
  if (targets.length === 0) return [];
  const source = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code: def.code }, transaction });
  const marked: string[] = [];
  for (const code of targets) {
    const target = await ctx.db.getRepository('dz_artifacts').findOne({
      filter: { projectId, code },
      appends: ['currentVersion'],
      transaction,
    });
    const refs = baseRefs(target);
    const latest = readableVersionId(source, getArtifactDef(code).stage === def.stage);
    if (target && (unconditional || refs[def.code] !== latest)) {
      await target.update({ stale: true, staleReason: reason }, { transaction });
      marked.push(code);
    } else if (target?.get('stale') && (await readsCurrentUpstream(ctx, projectId, code, refs, transaction))) {
      // An upstream reopened and re-locked without changes: nothing to re-check any more.
      await target.update({ stale: false, staleReason: null, upstreamBase: null }, { transaction });
    }
  }
  return marked;
}

/** Whether every upstream `code` read is still the version it would read now, and none is being edited. */
async function readsCurrentUpstream(ctx: Context, projectId: number, code: string, refs: Record<string, number | null>, transaction: any) {
  const def = getArtifactDef(code);
  const rows = await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId, code: { $in: def.dependsOn } }, transaction });
  return def.dependsOn.every((dep) => {
    const row = rows.find((r: any) => r.get('code') === dep);
    if (!row) return refs[dep] == null;
    return !isReopened(row) && readableVersionId(row, getArtifactDef(dep).stage === def.stage) === (refs[dep] ?? null);
  });
}



/** Current content of the artifacts `def` depends on, for checks that compare against them. */
async function upstreamPayloads(ctx: Context, projectId: number, def: ArtifactDef, transaction?: any) {
  const codes = [...def.dependsOn, ...(def.reads ?? [])];
  if (codes.length === 0) return {};
  const rows = await ctx.db.getRepository('dz_artifacts').find({
    filter: { projectId, code: { $in: codes } },
    appends: ['currentVersion'],
    transaction,
  });
  return Object.fromEntries(rows.map((r: any) => [r.get('code'), r.get('currentVersion')?.get('payload') ?? null]));
}

export async function transitionArtifact(
  ctx: Context,
  pc: ProjectContext,
  def: ArtifactDef,
  action: LifecycleAction,
  reason?: string,
  extra: { answers?: SelfReviewAnswer[] } = {},
) {
  if (action === 'save') throw new HttpError(400, '保存请使用 saveArtifact');
  let selfReview: { items: number; answers: SelfReviewAnswer[] } | null = null;
  const projectId = pc.project.get('id');

  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const artifact = await ctx.db.getRepository('dz_artifacts').findOne({
      filter: { projectId, code: def.code },
      appends: ['currentVersion'],
      transaction,
    });
    if (!artifact || !artifact.get('currentVersionId')) throw new HttpError(409, '这份成果还没有内容');
    const from = artifact.get('status') as ArtifactStatus;
    const to = nextStatus(action, from, pc.actor, reason);

    if (action === 'stepDone') {
      const states = await loadStates(ctx, projectId, transaction);
      const unlock = unlockInfo(def, states);
      if (!unlock.unlocked && !artifact.get('exception')) throw new HttpError(409, unlock.waitingFor ?? '这一步尚未解锁', 'LOCKED_STEP');
    }
    if (validationApplies(action, !!artifact.get('exception'))) {
      const upstream = await upstreamPayloads(ctx, projectId, def, transaction);
      const issues = validateArtifact(def.code, artifact.get('currentVersion')?.get('payload'), upstream);
      if (hasBlockingIssues(issues)) {
        throw new HttpError(422, '还有未通过的校验', 'VALIDATION_FAILED', { issues });
      }
      // 自查复核：清单按书中定版门禁、常见的坑和未处理的校验建议在服务端重建，逐条要有确认或理由。
      if (action === 'selfReview') {
        const items = selfReviewChecklist(def.code, issues.filter((i) => i.level !== 'error').map((i) => i.message));
        const answers = Array.isArray(extra.answers) ? extra.answers : [];
        const missing = missingSelfReview(items, answers);
        if (missing.length) throw new HttpError(422, `还有 ${missing.length} 条没有确认或说明理由`, 'SELF_REVIEW_INCOMPLETE', { missing });
        selfReview = { items: items.length, answers: answers.filter((a) => items.some((i) => i.key === a.key)).map((a) => ({ key: a.key, ok: !!a.ok, note: String(a.note ?? '').slice(0, 500) })) };
      }
    }

    // A plan book is confirmed together with the tables it embeds (spec §二(八)6).
    const bundle =
      PLAN_BOOKS.includes(def.code) && action === 'confirm'
        ? await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId, code: { $in: PLAN_BOOK_BUNDLE } }, transaction })
        : [];
    if (PLAN_BOOKS.includes(def.code) && action === 'confirm') {
      const notReady = PLAN_BOOK_BUNDLE.filter((code) => {
        const row = bundle.find((b: any) => b.get('code') === code);
        return !row || !['pending_confirm', 'locked'].includes(row.get('status'));
      });
      if (notReady.length) {
        const names = notReady.map((code) => `${getArtifactDef(code).specId} ${getArtifactDef(code).name}`).join('、');
        throw new HttpError(409, `计划书引用的${names}还没有复核通过，请先完成这些表的复核`, 'BUNDLE_NOT_READY');
      }
    }

    const values: Record<string, unknown> = { status: to };
    // 组织变更提示只对“这一版定版”有意义：重开、退回或重新定版后就不再成立。
    if (['confirm', 'forceLock', 'reopen', 'forceReturn'].includes(action)) values.orgNotice = null;
    if (action === 'stepDone') values.stepDoneVersionId = artifact.get('currentVersionId');
    if (action === 'confirm' || action === 'forceLock') values.lockedVersionId = artifact.get('currentVersionId');
    await artifact.update(values, { transaction });

    const bundled: string[] = [];
    for (const row of bundle) {
      if (row.get('status') !== 'pending_confirm') continue;
      bundled.push(row.get('code'));
      await row.update({ status: 'locked', lockedVersionId: row.get('currentVersionId') }, { transaction });
      await audit(
        ctx,
        pc,
        { code: row.get('code'), action: 'confirm', fromStatus: 'pending_confirm', toStatus: 'locked', rev: row.get('currentRev'), meta: { with: def.code } },
        transaction,
      );
    }

    // 计划书定版时记下所引用的上游版本，之后的导出都按这一份取数 (验收 D01)。
    if (PLAN_BOOKS.includes(def.code) && (action === 'confirm' || action === 'forceLock')) {
      const sources = await currentSources(ctx, projectId, def.code, transaction);
      await ctx.db.getRepository('dz_artifact_versions').update({ filterByTk: artifact.get('currentVersionId'), values: { sources }, transaction });
    }

    let stale: string[] = [];
    if (PROPAGATING.includes(action)) {
      const reopening = action === 'reopen' || action === 'forceReturn';
      const label = reopening ? '已解锁重开' : '有新版本';
      stale = await markDownstreamStale(ctx, pc, def, `${def.specId} ${def.name}${label}`, reopening, transaction);
    }
    await audit(
      ctx,
      pc,
      { code: def.code, action, reason, fromStatus: from, toStatus: to, rev: artifact.get('currentRev'), meta: { stale, ...(selfReview ? { selfReview } : {}) } },
      transaction,
    );
    await notifyTransition(ctx, pc, def, action, { reason, rev: artifact.get('currentRev'), stale, bundled }, transaction);
    return { status: to, stale };
  });
}

const LIFECYCLE_EVENTS = ['stepDone', 'submitReview', 'approve', 'selfReview', 'returnToEdit', 'confirm', 'reopen', 'forceLock', 'forceReturn'];

/** The latest lifecycle event per artifact of the given projects (who returned it and why, …). */
export async function lastEvents(ctx: Context, projectIds: number[]) {
  const out = new Map<string, { action: string; reason: string | null; at: string | null; by: string | null }>();
  if (!projectIds.length) return out;
  const events = await ctx.db.getRepository('dz_audit_events').find({
    filter: { projectId: { $in: projectIds }, action: { $in: LIFECYCLE_EVENTS } },
    appends: ['createdBy'],
    sort: ['-id'],
    limit: 2000,
  });
  for (const e of events as any[]) {
    const key = `${e.get('projectId')}:${e.get('code')}`;
    if (out.has(key)) continue;
    const by = e.get('createdBy');
    out.set(key, { action: e.get('action'), reason: e.get('reason') ?? null, at: e.get('createdAt') ?? null, by: by ? by.get('nickname') || by.get('username') : null });
  }
  return out;
}

/** Every step's state for next-action and status displays. */
export async function projectProgress(ctx: Context, projectId: number) {
  const [rows, states, events] = await Promise.all([
    ctx.db.getRepository('dz_artifacts').find({ filter: { projectId }, fields: ['code', 'status', 'stale'] }),
    loadStates(ctx, projectId),
    lastEvents(ctx, [projectId]),
  ]);
  const byCode = new Map((rows as any[]).map((r) => [r.get('code'), r]));
  return ARTIFACTS.map((def) => ({
    code: def.code,
    status: ((byCode.get(def.code) as any)?.get('status') as ArtifactStatus) ?? 'not_started',
    stale: !!(byCode.get(def.code) as any)?.get('stale'),
    unlocked: unlockInfo(def, states).unlocked,
    lastEvent: events.get(`${projectId}:${def.code}`) ?? null,
  }));
}

export async function projectOverview(ctx: Context, pc: ProjectContext) {
  const projectId = pc.project.get('id');
  const rows = await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId } });
  const byCode = new Map(rows.map((r: any) => [r.get('code'), r]));
  const states = await loadStates(ctx, projectId);
  const events = await lastEvents(ctx, [projectId]);
  // Departments and the project team feed RACI columns, undertakings and owner pickers.
  const comments = await openCommentCounts(ctx, projectId);
  const [orgUnits, members] = await Promise.all([
    ctx.db.getRepository('dz_org_units').find({
      filter: { enterpriseId: pc.project.get('enterpriseId') },
      sort: ['sort', 'id'],
    }),
    ctx.db.getRepository('dz_project_members').find({ filter: { projectId }, appends: ['user'] }),
  ]);
  return {
    project: pc.project.toJSON(),
    orgUnits: orgUnits.map((o: any) => ({
      id: o.get('id'),
      name: o.get('name'),
      kind: o.get('kind'),
      parentId: o.get('parentId') ?? null,
      headId: o.get('headId') ?? null,
      headName: o.get('headName') ?? null,
      duty: o.get('duty') ?? null,
      sort: o.get('sort') ?? 0,
    })),
    team: members.map((m: any) => ({
      userId: m.get('userId'),
      nickname: m.get('user')?.get('nickname') || m.get('user')?.get('username') || '',
      projectRole: m.get('projectRole'),
      orgUnitId: m.get('orgUnitId') ?? null,
    })),
    projectRole: pc.projectRole,
    isConsultAdmin: pc.access.isConsultAdmin,
    artifacts: ARTIFACTS.map((def) => {
      const row: any = byCode.get(def.code);
      return {
        code: def.code,
        status: (row?.get('status') as ArtifactStatus) ?? 'not_started',
        stale: !!row?.get('stale'),
        staleReason: row?.get('staleReason') ?? null,
        orgNotice: row?.get('orgNotice') ?? null,
        exception: !!row?.get('exception'),
        currentRev: row?.get('currentRev') ?? 0,
        updatedAt: row?.get('updatedAt') ?? null,
        unlock: unlockInfo(def, states),
        openComments: comments[def.code] ?? 0,
        lastEvent: events.get(`${projectId}:${def.code}`) ?? null,
      };
    }),
  };
}

export async function recordDissent(ctx: Context, pc: ProjectContext, def: ArtifactDef, content: string) {
  if (!pc.projectRole || !['ent_lead', 'dept_head', 'member'].includes(pc.projectRole)) {
    throw new HttpError(403, '只有参与共创的企业成员可以记录异议');
  }
  if (!content?.trim()) throw new HttpError(400, '请填写异议内容');
  const artifact = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId: pc.project.get('id'), code: def.code } });
  if (!artifact?.get('currentVersionId')) throw new HttpError(409, '这份成果还没有内容');
  return ctx.db.getRepository('dz_dissents').create({
    values: {
      projectId: pc.project.get('id'),
      code: def.code,
      versionId: artifact.get('currentVersionId'),
      content: content.trim(),
      spaceName: pc.spaceName,
    },
    context: ctx,
  });
}

export async function grantStepException(ctx: Context, pc: ProjectContext, def: ArtifactDef, reason: string) {
  if (pc.projectRole !== 'lead_consultant' && !pc.access.isConsultAdmin) {
    throw new HttpError(403, '只有主咨询师或咨询管理员可以批准跳步例外');
  }
  if (!reason?.trim()) throw new HttpError(400, '需要填写原因');
  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const artifact = await ensureArtifact(ctx, pc, def.code, transaction);
    await artifact.update({ exception: true }, { transaction });
    await ctx.db.getRepository('dz_step_exceptions').create({
      values: { projectId: pc.project.get('id'), code: def.code, reason: reason.trim(), spaceName: pc.spaceName },
      context: ctx,
      transaction,
    });
    await audit(ctx, pc, { code: def.code, action: 'grantException', reason }, transaction);
    return { exception: true };
  });
}

/**
 * 组织已变更 → “不需要重开”: the lead consultant (or a consulting admin) judges the locked table
 * still holds and clears the notice; the judgement is kept in the audit log.
 */
export async function dismissOrgNotice(ctx: Context, pc: ProjectContext, code: string, note?: string) {
  const selfLead = pc.actor.service === 'self' && pc.projectRole === 'ent_lead';
  if (!(pc.access.isConsultAdmin || pc.projectRole === 'lead_consultant' || pc.projectRole === 'ent_lead' || selfLead)) throw new HttpError(403, '只有主咨询师或企业项目负责人可以确认不需要重开');
  const projectId = pc.project.get('id');
  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const row = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code }, transaction });
    if (!row?.get('orgNotice')) return { ok: true };
    const notice = row.get('orgNotice');
    await row.update({ orgNotice: null }, { transaction });
    await audit(ctx, pc, { code, action: 'dismissOrgNotice', reason: String(note ?? '').slice(0, 500) || '组织变更不影响已定版内容', meta: { notice } }, transaction);
    return { ok: true };
  });
}

/** 上游改了什么：每个上游，核对基线读的版本与现在应读的版本（不同才列出）。 */
export async function upstreamChanges(ctx: Context, pc: ProjectContext, def: ArtifactDef) {
  const projectId = pc.project.get('id');
  const artifact = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code: def.code }, appends: ['currentVersion'] });
  if (!artifact) return { stale: false, changes: [] };
  const base = baseRefs(artifact);
  const rows = def.dependsOn.length
    ? await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId, code: { $in: def.dependsOn } } })
    : [];
  const versions = ctx.db.getRepository('dz_artifact_versions');
  const load = async (id: number | null | undefined) => {
    if (!id) return null;
    const v = await versions.findOne({ filterByTk: id, fields: ['id', 'rev', 'payload', 'createdAt'] });
    return v ? { rev: v.get('rev') as number, payload: v.get('payload'), at: v.get('createdAt') } : null;
  };
  const changes = [];
  for (const code of def.dependsOn) {
    const row = rows.find((r: any) => r.get('code') === code);
    const now = readableVersionId(row, getArtifactDef(code).stage === def.stage);
    const was = base[code] ?? null;
    if (now === was && !isReopened(row)) continue;
    const upstreamDef = getArtifactDef(code);
    changes.push({ code, specId: upstreamDef.specId, name: upstreamDef.plain, reopened: isReopened(row), from: await load(was), to: await load(now) });
  }
  return { stale: !!artifact.get('stale'), staleReason: artifact.get('staleReason') ?? null, changes };
}

/** 已核对：看过上游改了什么，确认本表已按新内容调整或不受影响。 */
export async function acknowledgeUpstream(ctx: Context, pc: ProjectContext, def: ArtifactDef, note?: string) {
  const projectId = pc.project.get('id');
  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const artifact = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId, code: def.code }, transaction });
    if (!artifact?.get('stale')) return { ok: true };
    const status = artifact.get('status') as ArtifactStatus;
    const judge = pc.access.isConsultAdmin || pc.projectRole === 'lead_consultant' || pc.projectRole === 'ent_lead';
    if (status === 'locked' ? !judge : !canPerform('save', pc.actor)) {
      throw new HttpError(403, status === 'locked' ? '已定版的表由企业项目负责人或主咨询师确认是否受影响' : '当前角色不能修改这张表');
    }
    const upstream = await upstreamState(ctx, projectId, def, transaction);
    if (upstream.reopened.length) {
      throw new HttpError(409, `${upstream.reopened.map((c) => getArtifactDef(c).plain).join('、')}已解锁重开、正在修改，等它重新完成后再核对`);
    }
    await artifact.update({ stale: false, staleReason: null, upstreamBase: upstream.refs }, { transaction });
    await audit(ctx, pc, { code: def.code, action: 'acknowledgeUpstream', reason: String(note ?? '').slice(0, 500) || '已核对上游改动', meta: { refs: upstream.refs, reason: artifact.get('staleReason') } }, transaction);
    return { ok: true };
  });
}

// ── 从已有项目带入（2026-10-16）────────────────────────────────────

async function importScope(ctx: Context, pc: ProjectContext) {
  if (!canImportInto(pc.projectRole, pc.access.isOps)) throw new HttpError(403, '只有企业项目负责人可以从已有项目带入');
  const userId = currentUserId(ctx);
  const projectId = pc.project.get('id');
  // 同一企业（同一空间）的其他项目；来源项目也要是自己参与的（运营除外），不越过项目成员边界。
  const projects = await ctx.db.getRepository('dz_projects').find({
    filter: { spaceName: pc.spaceName, enterpriseId: pc.project.get('enterpriseId'), id: { $ne: projectId } },
    sort: ['-year', '-createdAt'],
  });
  if (pc.access.isOps) return projects;
  const mine = await ctx.db.getRepository('dz_project_members').find({ filter: { userId, projectId: { $in: projects.map((p: any) => p.get('id')) } } });
  const ids = new Set(mine.map((m: any) => m.get('projectId')));
  return projects.filter((p: any) => ids.has(p.get('id')));
}

async function sourceRows(ctx: Context, projectId: number, transaction?: any): Promise<ImportSourceRow[]> {
  const rows = await ctx.db.getRepository('dz_artifacts').find({ filter: { projectId }, appends: ['lockedVersion'], transaction });
  return rows.map((r: any) => ({
    code: r.get('code'),
    status: r.get('status'),
    currentRev: (r.get('currentRev') as number) ?? 0,
    lockedRev: (r.get('lockedVersion')?.get('rev') as number | undefined) ?? null,
  }));
}

/** 可选的来源项目和每张表能不能带入、带哪一版。 */
export async function importSources(ctx: Context, pc: ProjectContext) {
  const projects = await importScope(ctx, pc);
  const target = await loadStates(ctx, pc.project.get('id'));
  const out = [];
  for (const p of projects as any[]) {
    const rows = await sourceRows(ctx, p.get('id'));
    out.push({
      projectId: p.get('id'),
      name: p.get('name'),
      year: p.get('year'),
      artifacts: ARTIFACTS.map((def) => {
        const source = rows.find((r) => r.code === def.code);
        return {
          code: def.code,
          basis: source && source.currentRev ? importBasis(source) : null,
          blocker: importBlocker(def.code, source, target[def.code]?.status),
          targetStatus: target[def.code]?.status ?? 'not_started',
        };
      }).filter((a) => a.basis),
    });
  }
  return out;
}

/**
 * 把来源项目里选中的表带入本项目，一律作为草稿（新版本，状态“进行中”）：不跳过本步完成、复核和定版；
 * 还没解锁的表先存着，解锁后就能看到。只带内容，不带批注、修改卡和流转记录。
 */
export async function importArtifacts(ctx: Context, pc: ProjectContext, input: { sourceProjectId: unknown; codes: unknown }) {
  const projects = await importScope(ctx, pc);
  const source = projects.find((p: any) => p.get('id') === Number(input.sourceProjectId));
  if (!source) throw new HttpError(404, '来源项目不存在，或你不是它的成员');
  const codes = Array.isArray(input.codes) ? [...new Set(input.codes.map(String))] : [];
  if (codes.length === 0) throw new HttpError(400, '请选择要带入的表');
  const projectId = pc.project.get('id');
  const sourceId = source.get('id') as number;
  const name = source.get('name') as string;
  const label = name.includes(String(source.get('year'))) ? name : `${source.get('year')} · ${name}`;

  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const rows = await sourceRows(ctx, sourceId, transaction);
    const target = await loadStates(ctx, projectId, transaction);
    const imported: string[] = [];
    const skipped: { code: string; reason: string }[] = [];
    for (const code of codes) {
      const from = rows.find((r) => r.code === code);
      const blocker = importBlocker(code, from, target[code]?.status);
      if (blocker || !from) {
        skipped.push({ code, reason: blocker ?? '来源项目这张表还没有内容' });
        continue;
      }
      const def = getArtifactDef(code);
      const basis = importBasis(from);
      const sourceArtifact = await ctx.db.getRepository('dz_artifacts').findOne({ filter: { projectId: sourceId, code }, transaction });
      const sourceVersion = await ctx.db.getRepository('dz_artifact_versions').findOne({
        filter: { artifactId: sourceArtifact.get('id'), rev: basis.rev },
        transaction,
      });
      if (!sourceVersion) {
        skipped.push({ code, reason: '来源版本读取失败' });
        continue;
      }
      const artifact = await ensureArtifact(ctx, pc, code, transaction);
      const fromStatus = artifact.get('status') as ArtifactStatus;
      const rev = ((artifact.get('currentRev') as number) ?? 0) + 1;
      const upstream = await upstreamState(ctx, projectId, def, transaction);
      const version = await ctx.db.getRepository('dz_artifact_versions').create({
        values: {
          artifactId: artifact.get('id'),
          projectId,
          code,
          rev,
          kind: 'imported',
          payload: sourceVersion.get('payload'),
          upstreamRefs: upstream.refs,
          note: `从《${label}》带入（${basis.label}）`,
          changes: [],
          spaceName: pc.spaceName,
        },
        context: ctx,
        transaction,
      });
      await artifact.update({ status: 'in_progress', currentRev: rev, currentVersionId: version.get('id') }, { transaction });
      await audit(
        ctx,
        pc,
        { code, action: 'import', fromStatus, toStatus: 'in_progress', rev, meta: { sourceProjectId: sourceId, sourceRev: basis.rev, sourceLocked: basis.locked } },
        transaction,
      );
      imported.push(code);
    }
    return { imported, skipped };
  });
}
