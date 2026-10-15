// 定目标责 tables: the target zone of S2-03 and budget worksheet, the decode map (S2-01),
// company and department path systems (S2-03 / S2-06), key projects (S2-08), RACI
// (S2-04), department undertaking (S2-05) and scorecards (S2-07). Spec V1.2 §二(七).

import type { KpiBreakdown, KpiBreakdownRow } from './measures';
import { newRowId } from './measures';
import { type Issue, type PathNode, type PathSystem, type Perspective, type RaciLetter, validatePathSystem, validateRaci } from './validators';

const PENDING_MARK = '待补';

function filled(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && text !== PENDING_MARK;
}

/** Leading number of a value such as “1100 万方” or “≥95%”, when it is additive. */
export function parseAmount(value: string): number | null {
  const match = (value ?? '').trim().match(/^(-?\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/** The unit of a value: the explicit unit, else the text after the number (“1.0 亿元” → “亿元”, “100%” → “%”). */
export function unitOf(item: { unit?: string | null; value?: string | null }): string {
  const unit = (item.unit ?? '').trim();
  if (unit) return unit;
  return String(item.value ?? '').trim().replace(/^[≥≤<>约~]*\s*-?\d+(?:\.\d+)?/, '').trim();
}

/**
 * Values add up only when they measure the same thing in the same unit (验收 E D02): 改造长度 120 公里
 * and 安检覆盖率 100% support the same goal together but have no sum.
 */
export function additive(items: { metric?: string | null; unit?: string | null; value?: string | null }[]): boolean {
  if (items.length === 0) return false;
  const metric = (items[0].metric ?? '').trim();
  const unit = unitOf(items[0]);
  return items.every((i) => (i.metric ?? '').trim() === metric && unitOf(i) === unit);
}

// ── S2-03 目标区：公司级年度目标（第一步 定目标）──

/** 目标 = 目的 + 任务 + 目标值（衡量指标 + 指标值）。 */
export interface AnnualGoal {
  id: string;
  /** 为什么做：对上级战略 / 目标的贡献。 */
  purpose: string;
  /** 做什么：动词＋宾语。 */
  task: string;
  metric: string;
  value: string;
  unit: string;
  perspective: Perspective;
  /** S1-07 row this goal takes its value from, when imported. */
  sourceRowId: string | null;
}

export interface GoalTargets {
  year: number;
  /** 回顾公司战略（表 3-4）：往上看。 */
  strategyReview: string;
  /** 上一经营周期的问题及解决方案：往回看。 */
  lastPeriodIssues: string;
  goals: AnnualGoal[];
}

export function emptyGoalTargets(year: number): GoalTargets {
  return { year, strategyReview: '', lastPeriodIssues: '', goals: [] };
}

export function emptyGoal(patch: Partial<AnnualGoal> = {}): AnnualGoal {
  return { id: newRowId('g'), purpose: '', task: '', metric: '', value: '', unit: '', perspective: 'financial', sourceRowId: null, ...patch };
}

export function validateGoalTargets(targets: GoalTargets): Issue[] {
  const issues: Issue[] = [];
  const goals = targets.goals ?? [];
  if (goals.length === 0) return [{ level: 'error', message: '至少确定一个公司级年度目标' }];
  for (const g of goals) {
    const name = g.task || g.metric || '未命名目标';
    const missing = [
      ['task', '任务'],
      ['metric', '衡量指标'],
      ['value', '指标值'],
    ].filter(([key]) => !filled(g[key as keyof AnnualGoal]));
    if (missing.length) issues.push({ level: 'error', message: `“${name}”缺${missing.map(([, l]) => l).join('、')}`, anchor: g.id });
    if (!filled(g.purpose)) issues.push({ level: 'warning', message: `“${name}”还没写目的：它对战略的贡献是什么`, anchor: g.id });
  }
  if (!filled(targets.strategyReview)) issues.push({ level: 'warning', message: '建议写下战略回顾：本年度目标承接了哪些战略要求' });
  return issues;
}

/** This year's S1-07 values that are not yet goals. Values come from the enterprise, never from the AI. */
export function goalsFromBreakdown(breakdown: KpiBreakdown | null | undefined, year: number, existing: AnnualGoal[] = []): AnnualGoal[] {
  const used = new Set(existing.map((g) => g.sourceRowId).filter(Boolean));
  const key = String(year);
  return (breakdown?.rows ?? [])
    .filter((r: KpiBreakdownRow) => !used.has(r.id) && filled(r.values?.[key]))
    .map((r) =>
      emptyGoal({ metric: r.name, value: r.values[key], unit: r.unit, purpose: r.theme ? `支撑“${r.theme}”` : '', sourceRowId: r.id }),
    );
}

// ── M-BUDGET 年度经营预算（表 3-5） ──

export interface BudgetRow {
  id: string;
  item: string;
  lastYear: string;
  budget: string;
  note: string;
}

export interface BudgetWorksheet {
  unit: string;
  /** 预算编制说明 (表 3-6): assumptions and the basis the numbers rest on. */
  basis: string;
  rows: BudgetRow[];
}

/** 表 3-6 年度经营预算主要内容: 收入、成本费用、人员、投资研发、现金流，再综合汇总。 */
export const BUDGET_ITEMS = ['营业收入', '营业成本', '销售费用', '管理费用', '研发费用', '人员（人数 / 人工成本）', '投资预算', '利润总额', '经营性现金流'];

export function emptyBudgetWorksheet(): BudgetWorksheet {
  return { unit: '万元', basis: '', rows: BUDGET_ITEMS.map((item) => ({ id: newRowId('b'), item, lastYear: '', budget: '', note: '' })) };
}

export function validateBudgetWorksheet(sheet: BudgetWorksheet): Issue[] {
  const rows = sheet.rows ?? [];
  const done = rows.filter((r) => filled(r.budget));
  if (done.length === 0) return [{ level: 'error', message: '还没有填写任何预算数' }];
  const blanks = rows.filter((r) => filled(r.item) && !filled(r.budget));
  const issues: Issue[] = [];
  if (!filled(sheet.basis)) issues.push({ level: 'warning', message: '还没有写预算编制说明：没有战略回顾和假设，不要直接切预算数字', anchor: 'basis' });
  if (blanks.length) issues.push({ level: 'warning', message: `${blanks.map((r) => r.item).join('、')}还没有预算数` });
  return issues;
}

// ── S2-01 年度战略解码地图 ──

/** Guidance from the book's decode map (图 3-7 ～ 3-10): what each layer usually covers. */
export const DECODE_CATEGORIES: Record<Perspective, { key: string; label: string }[]> = {
  financial: [
    { key: 'grow-new-customer', label: '增收 · 新客户' },
    { key: 'grow-existing-customer', label: '增收 · 老客户增购' },
    { key: 'grow-new-product', label: '增收 · 新产品' },
    { key: 'grow-new-market', label: '增收 · 新市场 / 区域' },
    { key: 'grow-channel', label: '增收 · 渠道' },
    { key: 'grow-price', label: '增收 · 价格与结构' },
    { key: 'grow-retention', label: '增收 · 降低流失' },
    { key: 'cut-cost', label: '降本 · 成本结构' },
    { key: 'asset-efficiency', label: '降本 · 资产效率' },
  ],
  customer: [
    { key: 'price', label: '价格' },
    { key: 'quality', label: '质量' },
    { key: 'availability', label: '可得性' },
    { key: 'selection', label: '选择' },
    { key: 'function', label: '功能' },
    { key: 'service', label: '服务' },
    { key: 'partnership', label: '伙伴关系' },
    { key: 'brand', label: '品牌' },
  ],
  process: [
    { key: 'operations', label: '运营管理流程' },
    { key: 'customer-management', label: '客户管理流程' },
    { key: 'innovation', label: '创新流程' },
    { key: 'regulatory-social', label: '法规与社会流程' },
  ],
  learning: [
    { key: 'human', label: '人力资本' },
    { key: 'information', label: '信息资本' },
    { key: 'organization', label: '组织资本' },
  ],
};

const RANK: Record<Perspective, number> = { learning: 0, process: 1, customer: 2, financial: 3 };

export interface DecodeTheme {
  id: string;
  perspective: Perspective;
  category: string;
  title: string;
  metric: string;
  value: string;
  /** Upper-layer themes this one supports; financial themes link to annual goals instead. */
  supports: string[];
  /** For financial themes: the annual goal they close the gap of. */
  goalId: string | null;
  /** 来自战略地图（S1-02）的目标。 */
  objectiveId?: string | null;
}

export interface DecodeMap {
  /** 子步骤 1：股东价值差距。 */
  valueGap: { target: string; baseline: string; gap: string };
  themes: DecodeTheme[];
}

export function emptyDecodeMap(): DecodeMap {
  return { valueGap: { target: '', baseline: '', gap: '' }, themes: [] };
}

export function emptyTheme(perspective: Perspective, patch: Partial<DecodeTheme> = {}): DecodeTheme {
  return { id: newRowId('d'), perspective, category: '', title: '', metric: '', value: '', supports: [], goalId: null, ...patch };
}

export function validateDecodeMap(map: DecodeMap, goals?: GoalTargets | null): Issue[] {
  const issues: Issue[] = [];
  const themes = map.themes ?? [];
  const byId = new Map(themes.map((t) => [t.id, t]));
  if (!filled(map.valueGap?.gap)) issues.push({ level: 'error', message: '子步骤 1：还没有写出股东价值差距', anchor: 'valueGap' });
  const labels: Record<Perspective, string> = { financial: '财务', customer: '客户', process: '内部流程', learning: '学习与成长' };
  for (const p of ['financial', 'customer', 'process', 'learning'] as Perspective[]) {
    if (!themes.some((t) => t.perspective === p)) issues.push({ level: 'error', message: `“${labels[p]}”层面还没有战略主题` });
  }
  const goalIds = new Set((goals?.goals ?? []).map((g) => g.id));
  for (const t of themes) {
    const name = t.title || '未命名主题';
    if (!filled(t.title)) issues.push({ level: 'error', message: '有战略主题没有名称', anchor: t.id });
    if (t.perspective === 'financial') {
      if (!t.goalId || (goalIds.size && !goalIds.has(t.goalId))) {
        issues.push({ level: 'warning', message: `财务主题“${name}”还没有对应年度目标`, anchor: t.id });
      }
    } else if ((t.supports ?? []).length === 0) {
      issues.push({ level: 'warning', message: `“${name}”还没有说明支撑哪个上层主题`, anchor: t.id });
    }
    for (const id of t.supports ?? []) {
      const upper = byId.get(id);
      if (!upper) issues.push({ level: 'error', message: `“${name}”支撑的主题已不存在`, anchor: t.id });
      else if (RANK[upper.perspective] <= RANK[t.perspective]) {
        issues.push({ level: 'error', message: `“${name}”只能支撑更上一层的主题，“${upper.title}”不在上层`, anchor: t.id });
      }
    }
    if (!filled(t.metric)) issues.push({ level: 'warning', message: `“${name}”还没有衡量指标`, anchor: t.id });
  }
  return issues;
}

/** The goal a theme ultimately serves, following `supports` upward. */
export function themeGoal(map: DecodeMap, themeId: string, seen = new Set<string>()): string | null {
  const theme = (map.themes ?? []).find((t) => t.id === themeId);
  if (!theme || seen.has(themeId)) return null;
  seen.add(themeId);
  if (theme.goalId) return theme.goalId;
  for (const up of theme.supports ?? []) {
    const goal = themeGoal(map, up, seen);
    if (goal) return goal;
  }
  return null;
}

// ── S2-03 / S2-06 路径系统 ──

/**
 * A path system hangs level-1 paths under goals (`goalId`), then levels 2–4 under
 * their parent. Company paths hang under the goals of the S2-03 target zone; department
 * paths under S2-05 rows.
 */
export interface GoalPathSystem extends PathSystem {
  /** `themeId`：从解码地图（S2-01）导入的路径记下来源主题，改名、删除可追溯。 */
  nodes: (PathNode & { goalId?: string | null; themeId?: string | null })[];
  /** S2-03 only: 第一步 定目标 (表 3-4/3-5) — the goals the company paths start from. */
  targets?: GoalTargets;
}

export function emptyPathSystem(): GoalPathSystem {
  return { nodes: [] };
}

export function emptyCompanyPathSystem(year: number): GoalPathSystem {
  return { nodes: [], targets: emptyGoalTargets(year) };
}

/** The S2-03 target zone, from an S2-03 payload (or a pre-merge S2-03-T payload). */
export function targetsOf(system: unknown): GoalTargets | undefined {
  if (!system || typeof system !== 'object') return undefined;
  const s = system as GoalPathSystem & Partial<GoalTargets>;
  if (s.targets) return s.targets;
  return Array.isArray(s.goals) ? (s as unknown as GoalTargets) : undefined;
}

export function pathNode(patch: Partial<PathNode & { goalId?: string | null; themeId?: string | null }> = {}): PathNode & { goalId?: string | null; themeId?: string | null } {
  return { id: newRowId('n'), parentId: null, goalId: null, level: 1, path: '', metric: '', value: '', amount: null, unit: '', ...patch };
}

/** Goal-aware checks on top of the per-node checks (分得下去、推得回来、MECE). */
export function validateGoalPathSystem(system: GoalPathSystem, goals: { id: string; label: string }[], goalWord = '年度目标'): Issue[] {
  const nodes = system.nodes ?? [];
  if (nodes.length === 0) return [{ level: 'error', message: '还没有任何路径' }];
  const issues = validatePathSystem({ nodes });
  const goalIds = new Set(goals.map((g) => g.id));
  for (const n of nodes) {
    if (n.level === 1 && goals.length > 0 && (!n.goalId || !goalIds.has(n.goalId))) {
      issues.push({ level: 'error', message: `一级路径“${n.path || '未命名路径'}”没有挂到${goalWord}上`, anchor: n.id });
    }
  }
  for (const g of goals) {
    if (!nodes.some((n) => n.level === 1 && n.goalId === g.id)) {
      issues.push({ level: 'error', message: `${goalWord}“${g.label}”还没有一级路径`, anchor: g.id });
    }
  }
  // MECE: same-named siblings usually mean overlap or double counting.
  const siblings = new Map<string, number>();
  for (const n of nodes) {
    const key = `${n.parentId ?? `goal:${n.goalId ?? ''}`}|${n.path.trim()}`;
    if (n.path.trim()) siblings.set(key, (siblings.get(key) ?? 0) + 1);
  }
  for (const [key, count] of siblings) {
    if (count > 1) issues.push({ level: 'warning', message: `同一层下有 ${count} 条“${key.split('|')[1]}”，注意重叠或重复计算` });
  }
  return issues;
}

/** Fill `amount` from `value` wherever it reads as a number, so 推得回来 can be checked. */
export function withAmounts<T extends PathNode>(nodes: T[]): T[] {
  return nodes.map((n) => ({ ...n, amount: parseAmount(n.value) }));
}

/** Depth-first order under each goal, for tables and exports. */
export function orderedPaths<T extends PathNode & { goalId?: string | null }>(nodes: T[], goalIds: string[]): T[] {
  const children = new Map<string, T[]>();
  for (const n of nodes) {
    const key = n.parentId ?? `goal:${n.goalId ?? ''}`;
    children.set(key, [...(children.get(key) ?? []), n]);
  }
  const out: T[] = [];
  const seen = new Set<string>();
  const walk = (key: string) => {
    for (const n of children.get(key) ?? []) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
      walk(n.id);
    }
  };
  for (const g of goalIds) walk(`goal:${g}`);
  walk('goal:');
  // Orphans (parent missing) last, so nothing silently disappears.
  for (const n of nodes) if (!seen.has(n.id)) out.push(n);
  return out;
}

/** 子步骤 5：导入路径系统表 — decode-map themes become level-1 paths under their goal. */
export function pathsFromDecodeMap(map: DecodeMap | null | undefined, goals: GoalTargets | null | undefined, existing: GoalPathSystem): GoalPathSystem {
  const fallbackGoal = goals?.goals?.[0]?.id ?? null;
  const imported = new Set(existing.nodes.map((n) => n.path.trim()));
  const importedThemes = new Set(existing.nodes.map((n) => n.themeId).filter(Boolean));
  const order: Perspective[] = ['financial', 'customer', 'process', 'learning'];
  const themes = [...(map?.themes ?? [])].sort((a, b) => order.indexOf(a.perspective) - order.indexOf(b.perspective));
  const nodes = themes
    .filter((t) => filled(t.title) && !imported.has(t.title.trim()) && !importedThemes.has(t.id))
    .map((t) =>
      pathNode({
        level: 1,
        goalId: themeGoal(map!, t.id) ?? fallbackGoal,
        perspective: t.perspective,
        path: t.title.trim(),
        metric: t.metric,
        value: t.value,
        amount: parseAmount(t.value),
        themeId: t.id,
      }),
    );
  return { ...existing, nodes: [...existing.nodes, ...nodes] };
}

/** 战略地图（S1-02）里还没进解码地图的目标，按层面带成主题（客户反馈：各表要可承接）。 */
export function themesFromStrategyMap(strategyMap: { objectives?: { id: string; perspective: Perspective; title: string }[] } | null | undefined, map: DecodeMap): DecodeTheme[] {
  const linked = new Set((map.themes ?? []).map((t) => t.objectiveId).filter(Boolean));
  const titles = new Set((map.themes ?? []).map((t) => t.title.trim()));
  return (strategyMap?.objectives ?? [])
    .filter((o) => filled(o.title) && !linked.has(o.id) && !titles.has(o.title.trim()))
    .map((o) => emptyTheme(o.perspective, { title: o.title.trim(), objectiveId: o.id, category: '战略地图' }));
}

// ── S2-08 关键项目列表（表 3-13） ──

export interface KeyProject {
  id: string;
  code: string;
  name: string;
  /** 战略关联 / 主题。 */
  theme: string;
  objective: string;
  start: string;
  end: string;
  milestones: string;
  owner: string;
  /** 来源路径（系统内追溯，导出可隐藏）。 */
  sourcePathIds: string[];
}

export interface KeyProjectList {
  projects: KeyProject[];
}

export function emptyKeyProjectList(): KeyProjectList {
  return { projects: [] };
}

export function emptyKeyProject(patch: Partial<KeyProject> = {}): KeyProject {
  return { id: newRowId('kp'), code: '', name: '', theme: '', objective: '', start: '', end: '', milestones: '', owner: '', sourcePathIds: [], ...patch };
}

export function validateKeyProjects(list: KeyProjectList): Issue[] {
  const issues: Issue[] = [];
  const projects = list.projects ?? [];
  if (projects.length === 0) return [{ level: 'error', message: '至少立一个关键项目' }];
  const codes = new Map<string, number>();
  for (const p of projects) {
    const name = p.name || '未命名项目';
    const missing = [
      ['name', '项目名称'],
      ['objective', '项目目标'],
      ['start', '开始时间'],
      ['end', '结束时间'],
      ['owner', '责任人'],
    ].filter(([key]) => !filled(p[key as keyof KeyProject] as string));
    if (missing.length) issues.push({ level: 'error', message: `“${name}”缺${missing.map(([, l]) => l).join('、')}`, anchor: p.id });
    if (filled(p.start) && filled(p.end) && p.end < p.start) {
      issues.push({ level: 'error', message: `“${name}”的结束时间早于开始时间`, anchor: p.id });
    }
    if ((p.sourcePathIds ?? []).length === 0) issues.push({ level: 'warning', message: `“${name}”没有关联来源路径，无法追溯`, anchor: p.id });
    if (filled(p.code)) codes.set(p.code.trim(), (codes.get(p.code.trim()) ?? 0) + 1);
  }
  for (const [code, count] of codes) if (count > 1) issues.push({ level: 'error', message: `项目编号 ${code} 重复了` });
  return issues;
}

/** 立项层级：paths at that level that no project traces back to yet. */
export function projectsFromPaths(system: GoalPathSystem | null | undefined, level: 1 | 2, existing: KeyProject[] = []): KeyProject[] {
  const used = new Set(existing.flatMap((p) => p.sourcePathIds ?? []));
  const nodes = (system?.nodes ?? []).filter((n) => n.level === level && filled(n.path) && !used.has(n.id));
  return nodes.map((n, i) =>
    emptyKeyProject({
      code: `KP-${String(existing.length + i + 1).padStart(2, '0')}`,
      name: n.path.trim(),
      objective: [n.metric, n.value].filter(filled).join(' '),
      sourcePathIds: [n.id],
    }),
  );
}

// ── S2-04 RACI ──

export interface RaciTableRow {
  id: string;
  name: string;
  cells: Record<string, RaciLetter[]>;
  /** Key project or path the row stands for. */
  sourceId: string | null;
  sourceKind: 'project' | 'path' | 'manual';
}

/** Columns are departments (or posts); rows are key projects or key paths. */
export interface RaciTable {
  columns: { id: string; name: string }[];
  rows: RaciTableRow[];
}

export function emptyRaciTable(): RaciTable {
  return { columns: [], rows: [] };
}

export function validateRaciTable(table: RaciTable): Issue[] {
  const issues: Issue[] = [];
  if ((table.columns ?? []).length === 0) issues.push({ level: 'error', message: '还没有列出责任部门 / 岗位' });
  if ((table.rows ?? []).length === 0) issues.push({ level: 'error', message: '还没有要分配责任的项目或路径' });
  if (issues.length) return issues;
  return validateRaci(table);
}

/** Rows for key projects (default) or paths not yet in the matrix. */
export function raciRowsFrom(
  source: { projects?: KeyProject[]; paths?: (PathNode & { goalId?: string | null })[] },
  existing: RaciTableRow[] = [],
): RaciTableRow[] {
  const used = new Set(existing.map((r) => r.sourceId).filter(Boolean));
  if (source.projects?.length) {
    return source.projects
      .filter((p) => filled(p.name) && !used.has(p.id))
      .map((p) => ({ id: newRowId('ra'), name: p.name.trim(), cells: {}, sourceId: p.id, sourceKind: 'project' as const }));
  }
  return (source.paths ?? [])
    .filter((n) => filled(n.path) && !used.has(n.id))
    .map((n) => ({ id: newRowId('ra'), name: n.path.trim(), cells: {}, sourceId: n.id, sourceKind: 'path' as const }));
}

/** Toggle one letter in a cell; A stays unique per row by moving it, and R never shares a cell with C / I (书：R 不兼任 C / I). */
export function toggleRaciLetter(table: RaciTable, rowId: string, columnId: string, letter: RaciLetter): RaciTable {
  return {
    ...table,
    rows: table.rows.map((row) => {
      if (row.id !== rowId) return row;
      const cells: Record<string, RaciLetter[]> = { ...row.cells };
      const current = cells[columnId] ?? [];
      const has = current.includes(letter);
      if (letter === 'A' && !has) {
        for (const key of Object.keys(cells)) cells[key] = (cells[key] ?? []).filter((l) => l !== 'A');
      }
      let base = cells[columnId] ?? [];
      if (!has && letter === 'R') base = base.filter((l) => l !== 'C' && l !== 'I');
      if (!has && (letter === 'C' || letter === 'I')) base = base.filter((l) => l !== 'R');
      cells[columnId] = has ? base.filter((l) => l !== letter) : [...base, letter].sort((a, b) => 'RACI'.indexOf(a) - 'RACI'.indexOf(b));
      return { ...row, cells };
    }),
  };
}

// ── S2-05 部门目标承接表 ──

export interface DeptUndertaking {
  id: string;
  deptId: string;
  deptName: string;
  role: 'A' | 'R';
  purpose: string;
  task: string;
  metric: string;
  value: string;
  /** RACI row the undertaking comes from. */
  sourceRowId: string | null;
}

export interface DeptUndertakingTable {
  rows: DeptUndertaking[];
}

export function emptyDeptUndertakingTable(): DeptUndertakingTable {
  return { rows: [] };
}

export function validateDeptUndertaking(table: DeptUndertakingTable, raci?: RaciTable | null): Issue[] {
  const issues: Issue[] = [];
  const rows = table.rows ?? [];
  if (rows.length === 0) return [{ level: 'error', message: '还没有部门承接目标' }];
  for (const r of rows) {
    const name = `${r.deptName || '未指定部门'} · ${r.task || '未命名任务'}`;
    const missing = [
      ['deptName', '部门'],
      ['task', '任务'],
      ['metric', '衡量指标'],
      ['value', '指标值'],
    ].filter(([key]) => !filled(r[key as keyof DeptUndertaking] as string));
    if (missing.length) issues.push({ level: 'error', message: `“${name}”缺${missing.map(([, l]) => l).join('、')}`, anchor: r.id });
    if (!filled(r.purpose)) issues.push({ level: 'warning', message: `“${name}”还没写目的（承接哪条公司级路径）`, anchor: r.id });
  }
  for (const row of raci?.rows ?? []) {
    for (const col of raci?.columns ?? []) {
      if ((row.cells?.[col.id] ?? []).includes('A') && !rows.some((u) => u.sourceRowId === row.id && u.deptId === col.id)) {
        issues.push({ level: 'warning', message: `${col.name}是“${row.name}”的 A，但还没有承接它` });
      }
    }
  }
  return issues;
}

/** One undertaking per A or R cell that is not yet undertaken; metric and value follow the source. */
export function undertakingsFromRaci(
  raci: RaciTable | null | undefined,
  lookup: (sourceId: string | null) => { metric: string; value: string; purpose: string } | null,
  existing: DeptUndertaking[] = [],
): DeptUndertaking[] {
  const done = new Set(existing.map((u) => `${u.sourceRowId}|${u.deptId}`));
  const out: DeptUndertaking[] = [];
  for (const row of raci?.rows ?? []) {
    for (const col of raci?.columns ?? []) {
      const letters = row.cells?.[col.id] ?? [];
      const role = letters.includes('A') ? 'A' : letters.includes('R') ? 'R' : null;
      if (!role || done.has(`${row.id}|${col.id}`)) continue;
      const src = lookup(row.sourceId);
      out.push({
        id: newRowId('u'),
        deptId: col.id,
        deptName: col.name,
        role,
        purpose: src?.purpose ?? `承接“${row.name}”`,
        task: row.name,
        metric: src?.metric ?? '',
        value: src?.value ?? '',
        sourceRowId: row.id,
      });
    }
  }
  return out;
}

// ── S2-07 绩效计分卡（表 3-21） ──

export interface ScorecardItem {
  id: string;
  task: string;
  metric: string;
  definition: string;
  floor: string;
  target: string;
  weight: number | null;
  scoring: string;
  source: string;
  /** Undertaking or path it comes from. */
  originId: string | null;
}

export interface Scorecard {
  /** Same as deptId, so proposals can address a card as `cards.<deptId>`. */
  id: string;
  deptId: string;
  deptName: string;
  items: ScorecardItem[];
}

export interface ScorecardSet {
  cards: Scorecard[];
}

export function emptyScorecardSet(): ScorecardSet {
  return { cards: [] };
}

export function emptyScorecardItem(patch: Partial<ScorecardItem> = {}): ScorecardItem {
  return { id: newRowId('sc'), task: '', metric: '', definition: '', floor: '', target: '', weight: null, scoring: '', source: '', originId: null, ...patch };
}

export function cardWeight(card: Scorecard): number {
  return (card.items ?? []).reduce((sum, i) => sum + (typeof i.weight === 'number' ? i.weight : 0), 0);
}

export function validateScorecards(set: ScorecardSet): Issue[] {
  const issues: Issue[] = [];
  const cards = set.cards ?? [];
  if (cards.length === 0) return [{ level: 'error', message: '还没有部门计分卡' }];
  for (const card of cards) {
    const items = card.items ?? [];
    if (items.length === 0) {
      issues.push({ level: 'error', message: `${card.deptName}的计分卡是空的`, anchor: card.deptId });
      continue;
    }
    for (const item of items) {
      const name = `${card.deptName} · ${item.metric || '未命名指标'}`;
      const missing = [
        ['task', '关键任务'],
        ['metric', '衡量指标'],
        ['target', '力争值'],
      ].filter(([key]) => !filled(item[key as keyof ScorecardItem] as string));
      if (missing.length) issues.push({ level: 'error', message: `“${name}”缺${missing.map(([, l]) => l).join('、')}`, anchor: item.id });
      if (typeof item.weight !== 'number' || item.weight <= 0) {
        issues.push({ level: 'error', message: `“${name}”的权重要大于 0`, anchor: item.id });
      }
      if (!filled(item.definition)) issues.push({ level: 'warning', message: `“${name}”还没有指标定义`, anchor: item.id });
      if (!filled(item.floor)) issues.push({ level: 'warning', message: `“${name}”还没有保底值`, anchor: item.id });
    }
    const total = cardWeight(card);
    if (Math.abs(total - 100) > 1e-9) {
      issues.push({ level: 'error', message: `${card.deptName}的权重合计是 ${total}，应为 100`, anchor: card.deptId });
    }
  }
  return issues;
}

/** Cards from the departments' A/R undertakings; items not yet on a card are appended. */
export function scorecardsFromUndertakings(table: DeptUndertakingTable | null | undefined, existing: ScorecardSet): ScorecardSet {
  const cards = existing.cards.map((c) => ({ ...c, items: [...c.items] }));
  const used = new Set(cards.flatMap((c) => c.items.map((i) => i.originId)).filter(Boolean));
  for (const u of table?.rows ?? []) {
    if (used.has(u.id) || !filled(u.deptName)) continue;
    let card = cards.find((c) => c.deptId === u.deptId);
    if (!card) {
      card = { id: u.deptId, deptId: u.deptId, deptName: u.deptName, items: [] };
      cards.push(card);
    }
    card.items.push(emptyScorecardItem({ task: u.task, metric: u.metric, target: u.value, originId: u.id }));
  }
  return { cards };
}
