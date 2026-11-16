// 组织与职责 (闭环第二批): the enterprise's departments feed RACI (S2-04), 部门承接 (S2-05),
// 部门路径 (S2-06), 部门计分卡 (S2-07) and 部门计划书 (S3-08). Those tables keep the departments
// they were filled with; once 定版, a later change to the organisation is only flagged, and the
// lead consultant decides whether to reopen.

export const ORG_DEPENDENT_CODES = ['S2-04', 'S2-05', 'S2-06', 'S2-07', 'S3-08'];

// 层级怎么叫由企业自己定（事业部、中心、科室、班组…），上下级不限层数（2026-11 测试反馈）。系统只
// 区分三种用途：company 是顶层的公司 / 集团，不当责任者；team 是基层的团队 / 班组；其余都按部门，
// 进责任分工和部门承接。kindName 记企业自己的叫法，和内置叫法相同时为空。

export type OrgKind = 'company' | 'department' | 'team';

export const ORG_KIND_LABELS: Record<OrgKind, string> = { company: '公司', department: '部门', team: '团队' };

/** 新增部门时“类型”的备选；也可以直接输入别的叫法。 */
export const ORG_KIND_SUGGESTIONS = ['集团', '公司', '事业部', '中心', '部门', '科室', '团队', '班组'];

export const ORG_KIND_NAME_LIMIT = 20;

const COMPANY_WORDS = ['公司', '集团', '总部', '总公司'];
const TEAM_WORDS = ['团队', '小组', '班组', '组'];

/** 从企业填的层级名称得到用途和要记的叫法；空着按部门。也认 company / department / team。 */
export function orgKindFromName(input: unknown): { kind: OrgKind; kindName: string | null } {
  const word = String(input ?? '').trim().slice(0, ORG_KIND_NAME_LIMIT);
  if (!word) return { kind: 'department', kindName: null };
  const builtin = (Object.keys(ORG_KIND_LABELS) as OrgKind[]).find((k) => k === word || ORG_KIND_LABELS[k] === word);
  if (builtin) return { kind: builtin, kindName: null };
  const kind: OrgKind = COMPANY_WORDS.includes(word) ? 'company' : TEAM_WORDS.includes(word) ? 'team' : 'department';
  return { kind, kindName: word };
}

/** 界面上显示的层级名称：企业自己的叫法优先。 */
export function orgKindLabel(unit: { kind?: string | null; kindName?: string | null }): string {
  return unit.kindName?.trim() || ORG_KIND_LABELS[unit.kind as OrgKind] || ORG_KIND_LABELS.department;
}

export type OrgUnitFacts = {
  name: string;
  kind?: string | null;
  kindName?: string | null;
  parentId?: number | null;
  headId?: number | null;
  headName?: string | null;
  duty?: string | null;
};

/** One line in plain words for a change to a department, or null when nothing a table uses changed. */
export function describeOrgChange(before: OrgUnitFacts | null, after: OrgUnitFacts | null): string | null {
  if (!before && after) return `新增${after.kindName?.trim() || (after.kind === 'team' ? '团队' : '部门')}「${after.name}」`;
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
