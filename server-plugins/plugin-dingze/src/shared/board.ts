import type { ArtifactStatus } from './lifecycle';

/** Where an artifact sits on the consultant's board. */
export type BoardBucket = 'stale' | 'review' | 'submit' | 'confirm' | 'working';

export const BOARD_BUCKETS: { key: BoardBucket; label: string; hint: string }[] = [
  { key: 'review', label: '待复核', hint: '企业已提交，等主咨询师复核' },
  { key: 'submit', label: '待提交复核', hint: '企业已完成本步，可提交复核' },
  { key: 'stale', label: '上游已变更', hint: '上游成果重开或修改过，需要核对' },
  { key: 'confirm', label: '待企业确认', hint: '已通过复核，等企业项目负责人确认定版' },
  { key: 'working', label: '企业填写中', hint: '企业正在填写，必要时跟进' },
];

/**
 * The single bucket an artifact belongs to. “上游已变更” wins over the status because the
 * content may no longer hold; locked and untouched artifacts need no follow-up.
 */
export function boardBucket(status: ArtifactStatus, stale: boolean): BoardBucket | null {
  if (stale && status !== 'archived') return 'stale';
  switch (status) {
    case 'in_review':
      return 'review';
    case 'step_done':
      return 'submit';
    case 'pending_confirm':
      return 'confirm';
    case 'in_progress':
      return 'working';
    default:
      return null;
  }
}

/** Days since a timestamp, for “已等待 N 天”. */
export function waitingDays(since: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!since) return null;
  const t = new Date(since).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}
