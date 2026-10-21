// 专家咨询 (spec 二(十一)): a human-led service beside the AI flow. The enterprise asks about a
// key question, citing locked artifacts it authorises the expert to read; a consulting admin
// accepts and assigns an expert, who schedules a talk and writes the minutes and opinion.

import type { ProjectRole } from './lifecycle';

export const EXPERT_TOPICS = {
  tradeoff: '战略取舍',
  path: '路径合理性',
  responsibility: '责任冲突',
  resource: '资源约束',
  other: '其他',
} as const;
export type ExpertTopic = keyof typeof EXPERT_TOPICS;

export const EXPERT_STATUSES = {
  submitted: '待受理',
  accepted: '已受理',
  scheduled: '已预约',
  answered: '已出意见',
  closed: '已关闭',
  cancelled: '已撤回',
} as const;
export type ExpertStatus = keyof typeof EXPERT_STATUSES;

export type ExpertAction = 'assign' | 'schedule' | 'answer' | 'close' | 'cancel';

export interface ExpertActor {
  /** Consulting admin or ops. */
  isAdmin: boolean;
  isApplicant: boolean;
  isExpert: boolean;
  projectRole: ProjectRole | null;
}

const FROM: Record<ExpertAction, ExpertStatus[]> = {
  assign: ['submitted', 'accepted', 'scheduled'],
  schedule: ['accepted', 'scheduled'],
  answer: ['accepted', 'scheduled', 'answered'],
  close: ['answered'],
  cancel: ['submitted', 'accepted', 'scheduled'],
};

/** Who may take each step, and from which states. */
export function canExpertAct(action: ExpertAction, status: ExpertStatus, actor: ExpertActor): boolean {
  if (!FROM[action].includes(status)) return false;
  switch (action) {
    case 'assign':
      return actor.isAdmin;
    case 'schedule':
    case 'answer':
      return actor.isAdmin || actor.isExpert;
    case 'close':
      return actor.isAdmin || actor.isApplicant || actor.projectRole === 'ent_lead';
    case 'cancel':
      return actor.isAdmin || actor.isApplicant;
  }
}

/** Project roles that may file a request: everyone working on the project except read-only members. */
export function canRequestExpert(projectRole: ProjectRole | null, isAdmin: boolean): boolean {
  return isAdmin || (!!projectRole && projectRole !== 'readonly');
}

export const EXPERT_TEXT_LIMIT = 5000;
