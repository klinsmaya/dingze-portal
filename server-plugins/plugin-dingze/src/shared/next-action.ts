// What a person should do next on a project, and where each table stands, in plain words.
// Shared by the project list (server), the project home and the workspace (Portal).

import { ARTIFACTS, getArtifactDef, stageGateCodes, STAGES } from './catalog';
import type { ArtifactStatus, ProjectRole, ServiceMode } from './lifecycle';

export interface ArtifactProgress {
  code: string;
  status: ArtifactStatus;
  stale: boolean;
  unlocked: boolean;
  /** The latest lifecycle event on the table, if any. */
  lastEvent?: { action: string; reason?: string | null; at?: string | null; by?: string | null } | null;
}

export type NextActionKind = 'confirm' | 'returned' | 'review' | 'stale' | 'submit' | 'fill' | 'waiting' | 'deliver' | 'view';

export interface NextAction {
  kind: NextActionKind;
  /** Table to open; null for project-level actions (deliver, view). */
  code: string | null;
  /** Button text, e.g. “继续填：公司级年度目标 · 路径”. */
  label: string;
  /** One line under the button explaining why this is next. */
  hint: string;
}

const ENTERPRISE: ProjectRole[] = ['ent_lead', 'dept_head', 'member'];
const CONSULTANT: ProjectRole[] = ['lead_consultant', 'co_consultant'];
const RETURNS = ['returnToEdit', 'forceReturn'];

export function wasReturned(a: ArtifactProgress): boolean {
  return a.status === 'in_progress' && !!a.lastEvent && RETURNS.includes(a.lastEvent.action);
}

/**
 * What to do about 上游已变更 (验收 E D05): a draft is checked and saved again; a locked table cannot be
 * edited, so whoever may reopen it decides whether to.
 */
export function staleAdvice(status: string, service: ServiceMode = 'guided'): string {
  if (status !== 'locked') return '上游表有改动：看上游改了什么，核对后点“已核对”';
  return service === 'self'
    ? '已定版，但上游表有改动：由企业项目负责人判断是否解锁重开'
    : '已定版，但上游表有改动：由企业项目负责人或主咨询师判断是否解锁重开';
}

/** Collaboration status as the enterprise sees it (spec 二(三): no black-box waiting). */
export function collaborationStatus(
  a: ArtifactProgress,
  role: ProjectRole | null,
  service: ServiceMode = 'guided',
): { tone: 'wait' | 'act' | 'done' | 'neutral' | 'warn'; text: string } | null {
  const isEnterprise = !!role && ENTERPRISE.includes(role);
  if (service === 'self') {
    if (a.stale && a.status !== 'not_started') return { tone: 'warn', text: staleAdvice(a.status, 'self') };
    if (wasReturned(a)) return { tone: 'act', text: `已退回修改${a.lastEvent?.reason ? `：${a.lastEvent.reason}` : ''}` };
    switch (a.status) {
      case 'step_done':
        return role === 'ent_lead' ? { tone: 'act', text: '本步已完成，下一步：自查复核' } : { tone: 'wait', text: '本步已完成，等企业项目负责人自查复核' };
      case 'pending_confirm':
        return role === 'ent_lead' ? { tone: 'act', text: '自查复核已完成，待你定版' } : { tone: 'wait', text: '自查复核已完成，等企业项目负责人定版' };
      case 'locked':
        return { tone: 'done', text: '已定版（锁定）：如需修改，由企业项目负责人解锁重开' };
      default:
        return null;
    }
  }
  if (a.stale && a.status !== 'not_started') return { tone: 'warn', text: staleAdvice(a.status, service) };
  if (wasReturned(a)) return { tone: 'act', text: `已退回修改${a.lastEvent?.reason ? `：${a.lastEvent.reason}` : ''}` };
  switch (a.status) {
    case 'step_done':
      return { tone: 'act', text: isEnterprise ? '本步已完成，下一步：提交给顾问审' : '企业已完成本步，可提交复核' };
    case 'in_review':
      return { tone: isEnterprise ? 'wait' : 'act', text: isEnterprise ? `等主咨询师复核${since(a, '提交')}，审完会通知你` : `待复核${since(a, '提交')}` };
    case 'pending_confirm':
      return role === 'ent_lead'
        ? { tone: 'act', text: `顾问已审过${since(a, '通过')}，待你定版` }
        : { tone: 'wait', text: isEnterprise ? `顾问已审过${since(a, '通过')}，等企业项目负责人定版` : `等企业项目负责人定版${since(a, '通过')}` };
    case 'locked':
      return { tone: 'done', text: '已定版（锁定）：如需修改，企业项目负责人或主咨询师可解锁重开' };
    default:
      return null;
  }
}

/** “（孙经理 10-11 提交）”: who moved the table to where it waits, and when (验收意见 B03). */
function since(a: ArtifactProgress, verb: string): string {
  const e = a.lastEvent;
  if (!e || (!e.by && !e.at)) return '';
  const day = e.at ? String(e.at).slice(5, 10) : '';
  return `（${[e.by, day].filter(Boolean).join(' ')} ${verb}）`;
}

function title(code: string) {
  return getArtifactDef(code).plain;
}

/** The single most useful next step for `role` on a project. */
export function nextAction(artifacts: ArtifactProgress[], role: ProjectRole | null, service: ServiceMode = 'guided'): NextAction {
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  const steps = ARTIFACTS.filter((d) => d.priority !== 'method').map((d) => byCode.get(d.code)).filter((a): a is ArtifactProgress => !!a);
  const first = (pred: (a: ArtifactProgress) => boolean) => steps.find(pred);
  const isEnterprise = !!role && ENTERPRISE.includes(role);
  const editor = isEnterprise && role !== 'member' ? true : isEnterprise;

  if (!role) return { kind: 'view', code: null, label: '查看项目进度', hint: '你不在这个项目的团队里，可以查看进度和成果' };
  if (role === 'readonly') return { kind: 'view', code: null, label: '查看项目进度', hint: '你是只读成员，可以查看各张表、定版结果，也可以批注' };
  if (role === 'ent_lead') {
    const a = first((x) => x.status === 'pending_confirm');
    if (a) return { kind: 'confirm', code: a.code, label: `去定版：${title(a.code)}`, hint: '顾问已审过，确认后这张表锁定，作为后面各表的依据' };
  }
  if (role === 'lead_consultant') {
    const a = first((x) => x.status === 'in_review');
    if (a) return { kind: 'review', code: a.code, label: `去复核：${title(a.code)}`, hint: '企业已提交，复核通过后交企业项目负责人定版' };
  }
  if (editor) {
    const a = first(wasReturned);
    if (a) return { kind: 'returned', code: a.code, label: `改退回的表：${title(a.code)}`, hint: a.lastEvent?.reason ? `退回原因：${a.lastEvent.reason}` : '顾问退回了这张表，改好后再提交' };
  }
  // A draft is checked and saved by whoever edits it; a locked table only by whoever may reopen it.
  const mayReopen = service === 'self' ? role === 'ent_lead' : role === 'lead_consultant' || role === 'ent_lead';
  const stale = first((x) => x.stale && x.status !== 'not_started' && (x.status === 'locked' ? mayReopen : isEnterprise || role === 'lead_consultant'));
  if (stale) {
    return stale.status === 'locked'
      ? { kind: 'stale', code: stale.code, label: `判断是否重开：${title(stale.code)}`, hint: '已定版的表引用的上游改过了，看上游改了什么后决定解锁重开，还是点“已核对”保持原版' }
      : { kind: 'stale', code: stale.code, label: `核对：${title(stale.code)}`, hint: '它引用的上游表改过了，核对后点“已核对”即可' };
  }
  const done = first((x) => x.status === 'step_done');
  if (service === 'self') {
    if (done && role === 'ent_lead') return { kind: 'submit', code: done.code, label: `自查复核：${title(done.code)}`, hint: '对照书中定版门禁逐条确认，没问题就进入待定版' };
    const confirm = first((x) => x.status === 'pending_confirm');
    if (confirm && role === 'ent_lead') return { kind: 'confirm', code: confirm.code, label: `去定版：${title(confirm.code)}`, hint: '自查复核已完成，确认后这张表锁定' };
  } else if (done && (role === 'ent_lead' || role === 'dept_head' || (role && CONSULTANT.includes(role)))) {
    return { kind: 'submit', code: done.code, label: `提交顾问审：${title(done.code)}`, hint: '这张表已完成本步，提交后由主咨询师复核' };
  }
  const fill = first((x) => x.unlocked && (x.status === 'not_started' || x.status === 'in_progress') && getArtifactDef(x.code).priority === 'P0');
  if (fill) {
    const verb = isEnterprise ? (fill.status === 'not_started' ? '开始填' : '继续填') : '跟进';
    return { kind: 'fill', code: fill.code, label: `${verb}：${title(fill.code)}`, hint: `${STAGES.find((s) => s.key === getArtifactDef(fill.code).stage)?.name} · 按书的顺序一张一张来` };
  }
  const waiting = first((x) => x.status === 'in_review' || x.status === 'pending_confirm');
  if (waiting) {
    return {
      kind: 'waiting',
      code: waiting.code,
      label: waiting.status === 'in_review' ? `顾问在审：${title(waiting.code)}` : `等定版：${title(waiting.code)}`,
      hint: waiting.status === 'in_review' ? '现在没有要你填的表；顾问审完会通知你' : '等企业项目负责人确认定版',
    };
  }
  const allLocked = STAGES.every((s) => stageGateCodes(s.key).every((c) => byCode.get(c)?.status === 'locked'));
  if (allLocked) return { kind: 'deliver', code: null, label: '去导出计划书', hint: '三个阶段的必做表都已定版，可以导出公司年度经营计划书' };
  return { kind: 'view', code: null, label: '查看项目进度', hint: '当前没有需要你处理的表' };
}
