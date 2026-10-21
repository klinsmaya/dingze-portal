// 组织与职责 (闭环第二批): the enterprise's departments feed RACI (S2-04), 部门承接 (S2-05),
// 部门路径 (S2-06), 部门计分卡 (S2-07) and 部门计划书 (S3-08). Those tables keep the departments
// they were filled with; once 定版, a later change to the organisation is only flagged, and the
// lead consultant decides whether to reopen.

export const ORG_DEPENDENT_CODES = ['S2-04', 'S2-05', 'S2-06', 'S2-07', 'S3-08'];

export type OrgUnitFacts = {
  name: string;
  kind?: string | null;
  parentId?: number | null;
  headId?: number | null;
  headName?: string | null;
  duty?: string | null;
};

/** One line in plain words for a change to a department, or null when nothing a table uses changed. */
export function describeOrgChange(before: OrgUnitFacts | null, after: OrgUnitFacts | null): string | null {
  if (!before && after) return `新增${after.kind === 'team' ? '团队' : '部门'}「${after.name}」`;
  if (before && !after) return `删除「${before.name}」`;
  if (!before || !after) return null;
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`「${before.name}」改名为「${after.name}」`);
  const name = `「${after.name}」`;
  if ((before.parentId ?? null) !== (after.parentId ?? null)) parts.push(`${name}调整了上级`);
  if ((before.headId ?? null) !== (after.headId ?? null) || (before.headName ?? '') !== (after.headName ?? '')) parts.push(`${name}负责人变更`);
  if ((before.duty ?? '').trim() !== (after.duty ?? '').trim()) parts.push(`${name}职责调整`);
  return parts.length ? parts.join('；') : null;
}

/** Keep the newest lines first, at most `max`, each with the date it happened. */
export function appendOrgNotice(previous: string | null | undefined, line: string, date: string, max = 5): string {
  const lines = (previous ?? '').split('\n').filter(Boolean);
  return [`${date} ${line}`, ...lines].slice(0, max).join('\n');
}
