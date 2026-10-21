// 引导缺口 (spec 5.6, D8): consultants record where a digital consultant's guidance fell
// short; ops / consulting admins review them, and accepted ones ship in a later plugin version.

export const GAP_CATEGORIES = {
  missing: '缺少引导',
  wrong: '引导有误',
  check: '校验规则',
  method: '方法口径',
  other: '其他',
} as const;
export type GapCategory = keyof typeof GAP_CATEGORIES;

export const GAP_STATUSES = {
  open: '待评审',
  accepted: '已采纳',
  rejected: '不采纳',
  shipped: '已发布',
} as const;
export type GapStatus = keyof typeof GAP_STATUSES;

export const GAP_TEXT_LIMIT = 2000;

/** Review moves: open → accepted / rejected; accepted → shipped (with a version) or back. */
export function canMoveGap(from: GapStatus, to: GapStatus): boolean {
  if (from === to) return false;
  if (from === 'open') return to === 'accepted' || to === 'rejected';
  if (from === 'accepted') return to === 'shipped' || to === 'rejected' || to === 'open';
  if (from === 'rejected') return to === 'open' || to === 'accepted';
  return to === 'accepted'; // shipped → accepted when the release was rolled back
}
