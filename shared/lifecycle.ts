// Artifact lifecycle (spec V1.2 §二(九), Q1, Q10): states, transitions, who may
// perform them, and how unlocking is computed from the catalog.

import {
  ARTIFACTS,
  ArtifactDef,
  StageKey,
  getArtifactDef,
  previousStage,
  stageGateCodes,
} from './catalog';

export type ArtifactStatus =
  | 'not_started'
  | 'in_progress'
  | 'step_done'
  | 'in_review'
  | 'pending_confirm'
  | 'locked'
  | 'archived';

export const STATUS_LABELS: Record<ArtifactStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  step_done: '本步完成',
  in_review: '待复核',
  pending_confirm: '待确认',
  locked: '已定版',
  archived: '已归档',
};

/** Roles inside one project. Enterprise confirmation belongs to `ent_lead` only (Q2). */
export type ProjectRole =
  | 'ent_lead'
  | 'dept_head'
  | 'member'
  | 'readonly'
  | 'lead_consultant'
  | 'co_consultant';

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  ent_lead: '企业项目负责人',
  dept_head: '部门负责人',
  member: '项目成员',
  readonly: '只读成员',
  lead_consultant: '主咨询师',
  co_consultant: '协作咨询师',
};

export const ENTERPRISE_EDITORS: ProjectRole[] = [
  'ent_lead',
  'dept_head',
  'member',
];
export const CONSULTANTS: ProjectRole[] = ['lead_consultant', 'co_consultant'];

export type LifecycleAction =
  | 'save'
  | 'stepDone'
  | 'submitReview'
  | 'approve'
  | 'returnToEdit'
  | 'confirm'
  | 'reopen'
  | 'forceLock'
  | 'forceReturn'
  | 'selfReview';

/**
 * 服务方式 (闭环第三批)：陪跑 = 有人工咨询师复核；自助 = 免费、只有数字咨询师，复核换成企业项目负责人
 * 的“自查复核”（对照书中定版门禁逐条确认），解锁重开也由企业项目负责人做。校验和“只有企业项目
 * 负责人能定版”在两种方式下都一样。
 */
export type ServiceMode = 'guided' | 'self';
export const SERVICE_LABELS: Record<ServiceMode, string> = {
  guided: '陪跑（有咨询师）',
  self: '自助（数字咨询师）',
};

/** Audit and history labels; `grantException` is the consultant's step exception. */
export const ACTION_LABELS: Record<string, string> = {
  save: '保存',
  stepDone: '本步完成',
  submitReview: '提交复核',
  approve: '复核通过',
  returnToEdit: '退回修改',
  confirm: '企业确认定版',
  reopen: '解锁重开',
  forceLock: '强制定版',
  forceReturn: '强制退回',
  selfReview: '自查复核',
  grantException: '开例外',
  import: '从已有项目带入',
};

export const VERSION_KIND_LABELS: Record<string, string> = {
  ai_draft: 'AI 初稿',
  enterprise_edit: '企业修改',
  consultant_revision: '咨询师修订',
  imported: '从已有项目带入',
};

export interface Actor {
  projectRole: ProjectRole | null;
  /** System-level consulting admin may force transitions with a reason. */
  isConsultAdmin: boolean;
  /** The project's 服务方式; missing means 陪跑. */
  service?: ServiceMode;
}

interface TransitionRule {
  from: ArtifactStatus[];
  /** Target status; `save` depends on who edits, see `nextStatus`. */
  to: ArtifactStatus | 'by-actor';
  roles: ProjectRole[];
  consultAdmin?: boolean;
  requiresReason?: boolean;
  /** Only in this 服务方式. */
  service?: ServiceMode;
  /** Extra roles in 自助 projects (no consultant to do it). */
  selfRoles?: ProjectRole[];
  /** Run hard validation before the transition. */
  validates?: boolean;
}

const RULES: Record<LifecycleAction, TransitionRule> = {
  save: {
    from: [
      'not_started',
      'in_progress',
      'step_done',
      'in_review',
      'pending_confirm',
    ],
    to: 'by-actor',
    roles: [...ENTERPRISE_EDITORS, ...CONSULTANTS],
  },
  stepDone: {
    from: ['in_progress'],
    to: 'step_done',
    roles: ['ent_lead', 'dept_head'],
    validates: true,
  },
  submitReview: {
    from: ['step_done'],
    to: 'in_review',
    roles: ['ent_lead', 'dept_head', ...CONSULTANTS],
    service: 'guided',
  },
  approve: {
    from: ['in_review'],
    to: 'pending_confirm',
    roles: ['lead_consultant'],
    validates: true,
    service: 'guided',
  },
  // 自助：企业项目负责人对照书中定版门禁逐条自查（清单见 self-review.ts），再由他定版。
  selfReview: {
    from: ['step_done'],
    to: 'pending_confirm',
    roles: ['ent_lead'],
    validates: true,
    service: 'self',
  },
  returnToEdit: {
    from: ['in_review', 'pending_confirm'],
    to: 'in_progress',
    roles: ['lead_consultant', 'ent_lead'],
    requiresReason: true,
  },
  confirm: {
    from: ['pending_confirm'],
    to: 'locked',
    roles: ['ent_lead'],
    validates: true,
  },
  // 企业项目负责人也可以自己解锁重开（写原因，全员含咨询师收到通知）；重新定版仍要复核和确认。
  reopen: {
    from: ['locked'],
    to: 'in_progress',
    roles: ['lead_consultant', 'ent_lead'],
    consultAdmin: true,
    requiresReason: true,
  },
  // 强制定版 skips review and enterprise confirmation, never the content checks (定版门禁).
  forceLock: {
    from: ['in_progress', 'step_done', 'in_review', 'pending_confirm'],
    to: 'locked',
    roles: [],
    consultAdmin: true,
    requiresReason: true,
    validates: true,
  },
  forceReturn: {
    from: ['step_done', 'in_review', 'pending_confirm', 'locked'],
    to: 'in_progress',
    roles: [],
    consultAdmin: true,
    requiresReason: true,
  },
};

export class LifecycleError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'INVALID_STATE'
      | 'REASON_REQUIRED'
      | 'LOCKED_STEP'
      | 'VALIDATION_FAILED',
    message: string,
  ) {
    super(message);
  }
}

export function canPerform(action: LifecycleAction, actor: Actor): boolean {
  const rule = RULES[action];
  const service = actor.service ?? 'guided';
  if (rule.service && rule.service !== service) return false;
  if (rule.consultAdmin && actor.isConsultAdmin) return true;
  const roles =
    service === 'self' && rule.selfRoles
      ? [...rule.roles, ...rule.selfRoles]
      : rule.roles;
  return actor.projectRole !== null && roles.includes(actor.projectRole);
}

/**
 * Resolve the status after an action, or throw a LifecycleError. Validation itself is
 * done by the caller (see `requiresValidation`) because it needs the payload.
 */
export function nextStatus(
  action: LifecycleAction,
  current: ArtifactStatus,
  actor: Actor,
  reason?: string,
): ArtifactStatus {
  const rule = RULES[action];
  if (!canPerform(action, actor)) {
    throw new LifecycleError('FORBIDDEN', '当前角色不能执行这个操作');
  }
  if (!rule.from.includes(current)) {
    throw new LifecycleError(
      'INVALID_STATE',
      `成果处于“${STATUS_LABELS[current]}”，不能执行这个操作`,
    );
  }
  if (rule.requiresReason && !reason?.trim()) {
    throw new LifecycleError('REASON_REQUIRED', '需要填写原因');
  }
  if (rule.to !== 'by-actor') return rule.to;

  // Saving: a consultant revising during review keeps the review going; any other edit
  // turns the artifact back into a working draft, so earlier confirmations no longer apply.
  const isConsultant =
    actor.projectRole !== null && CONSULTANTS.includes(actor.projectRole);
  if (isConsultant && current === 'in_review') return 'in_review';
  return 'in_progress';
}

export function requiresValidation(action: LifecycleAction): boolean {
  return RULES[action].validates === true;
}

/**
 * Whether the blocking checks apply. A step exception (spec 二(十三)4: 咨询师确认并记录原因)
 * only lets an incomplete table move on to the next one; review and 定版 always check.
 */
export function validationApplies(
  action: LifecycleAction,
  exception: boolean,
): boolean {
  if (!requiresValidation(action)) return false;
  return !(exception && action === 'stepDone');
}

// ── Unlocking ──

export interface ArtifactState {
  status: ArtifactStatus;
  stale?: boolean;
  /** Set when a consultant granted a step exception for this artifact. */
  exception?: boolean;
  /**
   * The artifact reached “本步完成” at least once. A reopened table stays unlocked for its
   * downstream tables, which are flagged “上游已变更” instead of being locked again.
   */
  everCompleted?: boolean;
}

export type StateMap = Partial<Record<string, ArtifactState>>;

const REACHED_STEP_DONE: ArtifactStatus[] = [
  'step_done',
  'in_review',
  'pending_confirm',
  'locked',
  'archived',
];

export function hasReachedStepDone(state: ArtifactState | undefined): boolean {
  return (
    !!state &&
    (REACHED_STEP_DONE.includes(state.status) ||
      !!state.exception ||
      !!state.everCompleted)
  );
}

export function isStageComplete(stage: StageKey, states: StateMap): boolean {
  return stageGateCodes(stage).every((code) => {
    const state = states[code];
    return (
      !!state && (state.status === 'locked' || state.status === 'archived')
    );
  });
}

export function isStageOpen(stage: StageKey, states: StateMap): boolean {
  const prev = previousStage(stage);
  return prev === null || isStageComplete(prev, states);
}

export interface UnlockInfo {
  unlocked: boolean;
  /** Human-readable reason when locked. */
  waitingFor?: string;
}

export function unlockInfo(def: ArtifactDef, states: StateMap): UnlockInfo {
  if (!isStageOpen(def.stage, states)) {
    return { unlocked: false, waitingFor: '上一阶段全部 P0 成果定版后开启' };
  }
  if (def.attachedTo) {
    return unlockInfo(getArtifactDef(def.attachedTo), states);
  }
  const pending = def.unlockAfter.filter(
    (code) => !hasReachedStepDone(states[code]),
  );
  if (pending.length > 0) {
    const names = pending.map(
      (code) => `${getArtifactDef(code).specId} ${getArtifactDef(code).name}`,
    );
    return {
      unlocked: false,
      waitingFor: `${names.join('、')}“本步完成”后解锁`,
    };
  }
  return { unlocked: true };
}

/** Downstream artifacts to mark “上游已变更” after `code` gets a new step-done or locked version. */
export function staleTargets(code: string, states: StateMap): string[] {
  return ARTIFACTS.filter(
    (a) =>
      a.dependsOn.includes(code) &&
      states[a.code] &&
      states[a.code]!.status !== 'not_started',
  ).map((a) => a.code);
}
