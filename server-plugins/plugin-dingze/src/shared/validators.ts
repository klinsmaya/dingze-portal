// Structural validation of artifact payloads. `error` issues block “本步完成” and
// confirmation (Q3); `warning` issues are shown while editing but never block.

import {
  type IpoocDesign,
  type KpiBreakdown,
  type KpiScreening,
  type MissionWorksheet,
  type StrategyKpiTable,
  type StrategyLogic,
  type StrategyMap,
  type VisionWorksheet,
  validateIpooc,
  validateKpiBreakdown,
  validateKpiScreening,
  validateMissionWorksheet,
  validateStrategyKpis,
  validateStrategyLogic,
  validateStrategyMap,
  validateVisionWorksheet,
} from './measures';
import {
  type BudgetWorksheet,
  type DecodeMap,
  type DeptUndertakingTable,
  type GoalPathSystem,
  type GoalTargets,
  type KeyProjectList,
  type RaciTable,
  type ScorecardSet,
  validateBudgetWorksheet,
  validateDecodeMap,
  validateDeptUndertaking,
  validateGoalPathSystem,
  targetsOf,
  validateGoalTargets,
  validateKeyProjects,
  validateRaciTable,
  validateScorecards,
} from './goals';
import {
  type CompanyPlanBook,
  type DeptPlanBook,
  type ProgressPlan,
  type ProjectCharterSet,
  type ResourceMatch,
  validateCharterSet,
  validateCompanyPlanBook,
  validateDeptPlanBook,
  validateProgressPlan,
  validateResourceMatch,
} from './actions';

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  message: string;
  /** Item ID or field key the issue points at, for jump-to-cell. */
  anchor?: string;
}

const PENDING_MARK = '待补';

function filled(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && text !== PENDING_MARK;
}

// ── S1-01 六分法 / 战略屋 ──

export type StrategyExpression = 'sixfold' | 'house';

export interface Battlefield {
  id: string;
  /** 主要战场，如“第一增长曲线：城市燃气”。 */
  name: string;
  /** 如何致胜：可持续核心优势。 */
  advantage: string;
  /** 年度必赢之战。 */
  mustWin: string;
}

export interface StrategyContent {
  primary: StrategyExpression;
  /** Shared by both expressions: 目的 = 使命, 方向 = 愿景. */
  mission: string;
  vision: string;
  // 六分法
  strategicGoals: string;
  strategyChoice: string;
  stepsAndMeasures: string;
  indicatorSystem: string;
  // 战略屋
  values: string;
  goals: { y1: string; y3: string; y5: string };
  battlefields: Battlefield[];
  foundation: { organization: string; mechanism: string; talent: string };
}

export const SIXFOLD_FIELDS: { key: keyof StrategyContent; label: string }[] = [
  { key: 'mission', label: '目的（使命）' },
  { key: 'vision', label: '方向（愿景）' },
  { key: 'strategicGoals', label: '战略目标' },
  { key: 'strategyChoice', label: '策略选择' },
  { key: 'stepsAndMeasures', label: '步骤举措' },
  { key: 'indicatorSystem', label: '指标体系' },
];

export function emptyStrategyContent(primary: StrategyExpression): StrategyContent {
  return {
    primary,
    mission: '', vision: '',
    strategicGoals: '', strategyChoice: '', stepsAndMeasures: '', indicatorSystem: '',
    values: '', goals: { y1: '', y3: '', y5: '' }, battlefields: [],
    foundation: { organization: '', mechanism: '', talent: '' },
  };
}

export function validateSixfold(content: StrategyContent): Issue[] {
  return SIXFOLD_FIELDS.filter((f) => !filled(content[f.key])).map((f) => ({
    level: 'error' as const,
    message: `六分法缺“${f.label}”`,
    anchor: String(f.key),
  }));
}

export function validateHouse(content: StrategyContent): Issue[] {
  const issues: Issue[] = [];
  const need = (value: string, label: string, anchor: string) => {
    if (!filled(value)) issues.push({ level: 'error', message: `战略屋缺“${label}”`, anchor });
  };
  need(content.mission, '屋顶 · 使命', 'mission');
  need(content.vision, '屋顶 · 愿景', 'vision');
  need(content.values, '屋顶 · 价值观', 'values');
  need(content.goals.y1, '经营目标 · 一年', 'goals.y1');
  need(content.goals.y3, '经营目标 · 三年', 'goals.y3');
  need(content.goals.y5, '经营目标 · 五年', 'goals.y5');
  if (content.battlefields.length === 0) {
    issues.push({ level: 'error', message: '战略屋至少需要一个主要战场', anchor: 'battlefields' });
  }
  content.battlefields.forEach((b, i) => {
    const col = `第 ${i + 1} 个战场`;
    need(b.name, `${col} · 主要战场`, `battlefields.${b.id}.name`);
    need(b.advantage, `${col} · 如何致胜`, `battlefields.${b.id}.advantage`);
    need(b.mustWin, `${col} · 必赢之战`, `battlefields.${b.id}.mustWin`);
  });
  need(content.foundation.organization, '落地保障 · 组织', 'foundation.organization');
  need(content.foundation.mechanism, '落地保障 · 机制', 'foundation.mechanism');
  need(content.foundation.talent, '落地保障 · 人才', 'foundation.talent');
  return issues;
}

/** Whether any field that only the house has (价值观, goals, battlefields, foundation) is filled. */
export function houseStarted(content: StrategyContent): boolean {
  return (
    filled(content.values) ||
    Object.values(content.goals ?? {}).some(filled) ||
    (content.battlefields ?? []).some((b) => filled(b.name) || filled(b.advantage) || filled(b.mustWin)) ||
    Object.values(content.foundation ?? {}).some(filled)
  );
}

/**
 * Spec 二(六)2 and Q14: the six aspects of 战略简约六分法 are P0 and must all be filled before
 * “本步完成”; the strategy house is a P1 expression, so a started house only produces warnings.
 */
export function validateStrategyContent(content: StrategyContent): Issue[] {
  const house = houseStarted(content) ? validateHouse(content).map((i) => ({ ...i, level: 'warning' as const })) : [];
  return [...validateSixfold(content), ...house];
}

// ── 路径系统表（S2-03 / S2-06）──

export type Perspective = 'financial' | 'customer' | 'process' | 'learning';

export interface PathNode {
  id: string;
  parentId: string | null;
  perspective?: Perspective;
  /** 1–4. */
  level: number;
  path: string;
  metric: string;
  /** Displayed value, e.g. “700 万方”, “≤10 分钟”. */
  value: string;
  /** Numeric part when the value is additive; used for “推得回来”. */
  amount?: number | null;
  unit?: string;
  /** 图 3-7 group a level-1 path was started from, e.g. “提高客户价值 › 开发新客户”. */
  groupTag?: string;
}

export interface PathSystem {
  nodes: PathNode[];
}

export const MAX_PATH_LEVEL = 4;

export function validatePathSystem(system: PathSystem): Issue[] {
  const issues: Issue[] = [];
  const children = new Map<string | null, PathNode[]>();
  for (const node of system.nodes) {
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }
  const byId = new Map(system.nodes.map((n) => [n.id, n]));

  for (const node of system.nodes) {
    const label = node.path.trim() || '未命名路径';
    if (node.level < 1 || node.level > MAX_PATH_LEVEL) {
      issues.push({ level: 'error', message: `“${label}”的层级超出 1–${MAX_PATH_LEVEL} 级`, anchor: node.id });
    }
    if (node.parentId && !byId.has(node.parentId)) {
      issues.push({ level: 'error', message: `“${label}”的上级路径不存在`, anchor: node.id });
    }
    if (!filled(node.path)) issues.push({ level: 'error', message: '有路径没有填写名称', anchor: node.id });
    if (!filled(node.metric)) issues.push({ level: 'error', message: `“${label}”缺衡量指标`, anchor: node.id });
    if (!filled(node.value)) issues.push({ level: 'error', message: `“${label}”缺指标值`, anchor: node.id });

    const kids = children.get(node.id) ?? [];
    if (node.level === 1 && kids.length === 0) {
      issues.push({ level: 'warning', message: `一级路径“${label}”还没有分解到二级`, anchor: node.id });
    }
    // 推得回来: only comparable when parent and all children share metric and unit and carry amounts.
    const comparable =
      kids.length > 0 &&
      typeof node.amount === 'number' &&
      kids.every((k) => typeof k.amount === 'number' && k.metric.trim() === node.metric.trim() && (k.unit ?? '') === (node.unit ?? ''));
    if (comparable) {
      const sum = kids.reduce((acc, k) => acc + (k.amount as number), 0);
      if (Math.abs(sum - (node.amount as number)) > 1e-9) {
        issues.push({
          level: 'error',
          message: `“${label}”推不回来：下级合计 ${sum}，本级 ${node.amount}`,
          anchor: node.id,
        });
      }
    }
  }
  return issues;
}

// ── RACI（S2-04）──

export type RaciLetter = 'R' | 'A' | 'C' | 'I';

export interface RaciMatrix {
  columns: { id: string; name: string }[];
  rows: { id: string; name: string; cells: Record<string, RaciLetter[]> }[];
}

export const A_LOAD_WARNING_RATIO = 0.5;
/** 表 3-18: a role carrying R on most rows is overloaded. */
export const R_LOAD_WARNING_RATIO = 0.6;
/** 表 3-18: 多 C / 多 I on one row dilute the consultation and the information flow. */
export const MAX_C_PER_ROW = 2;
export const MAX_I_PER_ROW = 3;
/** Column checks need a few rows before an empty or overloaded column means anything. */
const COLUMN_CHECK_MIN_ROWS = 4;

/**
 * 表 3-18 RACI 验证优化表: the book's horizontal (per task) and vertical (per role) checks,
 * with the number of rows or columns that trip each one.
 */
export interface RaciVerification {
  horizontal: { noR: number; noA: number; multiA: number; multiR: number; manyC: number; manyI: number; rWithCI: number };
  vertical: { rOverload: string[]; aSprawl: string[]; noRA: string[] };
  /** Column checks only run once the matrix has enough rows. */
  verticalApplies: boolean;
}

export function verifyRaci(matrix: RaciMatrix): RaciVerification {
  const h = { noR: 0, noA: 0, multiA: 0, multiR: 0, manyC: 0, manyI: 0, rWithCI: 0 };
  const perColumn = new Map(matrix.columns.map((c) => [c.id, { r: 0, a: 0, any: false }]));
  for (const row of matrix.rows) {
    let a = 0;
    let r = 0;
    let c = 0;
    let i = 0;
    for (const col of matrix.columns) {
      const letters = row.cells[col.id] ?? [];
      const stat = perColumn.get(col.id)!;
      if (letters.includes('A')) {
        a += 1;
        stat.a += 1;
      }
      if (letters.includes('R')) {
        r += 1;
        stat.r += 1;
      }
      if (letters.includes('C')) c += 1;
      if (letters.includes('I')) i += 1;
      if (letters.length) stat.any = true;
      if (letters.includes('R') && (letters.includes('C') || letters.includes('I'))) h.rWithCI += 1;
    }
    if (r === 0) h.noR += 1;
    if (a === 0) h.noA += 1;
    if (a > 1) h.multiA += 1;
    if (r > 1) h.multiR += 1;
    if (c > MAX_C_PER_ROW) h.manyC += 1;
    if (i > MAX_I_PER_ROW) h.manyI += 1;
  }
  const rows = matrix.rows.length;
  const verticalApplies = rows >= COLUMN_CHECK_MIN_ROWS;
  const v = { rOverload: [] as string[], aSprawl: [] as string[], noRA: [] as string[] };
  if (verticalApplies) {
    for (const col of matrix.columns) {
      const stat = perColumn.get(col.id)!;
      if (stat.r / rows > R_LOAD_WARNING_RATIO) v.rOverload.push(col.name);
      if (stat.a / rows > A_LOAD_WARNING_RATIO) v.aSprawl.push(col.name);
      if (stat.r === 0 && stat.a === 0) v.noRA.push(col.name);
    }
  }
  return { horizontal: h, vertical: v, verticalApplies };
}

export function validateRaci(matrix: RaciMatrix): Issue[] {
  const issues: Issue[] = [];
  for (const row of matrix.rows) {
    let a = 0;
    let r = 0;
    let c = 0;
    let i = 0;
    for (const col of matrix.columns) {
      const letters = row.cells[col.id] ?? [];
      if (letters.includes('A')) a += 1;
      if (letters.includes('R')) r += 1;
      if (letters.includes('C')) c += 1;
      if (letters.includes('I')) i += 1;
      if (letters.includes('R') && letters.includes('A')) {
        issues.push({ level: 'warning', message: `“${row.name}”由${col.name}同时担任 R 与 A，确认是否有意为之`, anchor: row.id });
      }
      if (letters.includes('R') && (letters.includes('C') || letters.includes('I'))) {
        issues.push({ level: 'warning', message: `“${row.name}”里${col.name}既是 R 又是 C / I：执行者不必再被征询或知会`, anchor: row.id });
      }
    }
    if (a === 0) issues.push({ level: 'error', message: `“${row.name}”没有 A（最终负责人）`, anchor: row.id });
    if (a > 1) issues.push({ level: 'error', message: `“${row.name}”有 ${a} 个 A，A 只能有一个`, anchor: row.id });
    if (r === 0) issues.push({ level: 'error', message: `“${row.name}”没有 R（执行者）`, anchor: row.id });
    if (r > 1) issues.push({ level: 'warning', message: `“${row.name}”有 ${r} 个 R，注意分工边界`, anchor: row.id });
    if (c > MAX_C_PER_ROW) issues.push({ level: 'warning', message: `“${row.name}”要征询 ${c} 个部门，顾问过多会拖慢决策，精简到 ${MAX_C_PER_ROW} 个以内`, anchor: row.id });
    if (i > MAX_I_PER_ROW) issues.push({ level: 'warning', message: `“${row.name}”要知会 ${i} 个部门，按需设定知情范围`, anchor: row.id });
  }
  const { vertical, verticalApplies } = verifyRaci(matrix);
  if (verticalApplies) {
    const col = (name: string) => matrix.columns.find((c) => c.name === name)?.id;
    for (const name of vertical.aSprawl) issues.push({ level: 'warning', message: `${name}担任 A 的事项过多，注意负荷，梳理授权链`, anchor: col(name) });
    for (const name of vertical.rOverload) issues.push({ level: 'warning', message: `${name}在大多数事项上都是 R，执行超载，考虑拆分或下放`, anchor: col(name) });
    for (const name of vertical.noRA) issues.push({ level: 'warning', message: `${name}没有任何 R / A：确认它是支持性岗位（只 C / I），否则补充责任`, anchor: col(name) });
  }
  return issues;
}

// ── Dispatcher ──


/**
 * `upstream` carries upstream payloads by code where a check compares against them
 * (S1-07 against S1-06); those checks only ever produce warnings.
 */
export const INCOMPLETE_ROW_MESSAGE = '表里有一条内容不完整（缺少必需的字段），请补全或删除这一条后再检查';

/**
 * Never throws: a draft can be partial (an AI suggestion being previewed, an old payload), and a
 * validator that trips over a missing row would take the whole page down.
 */
export function validateArtifact(code: string, payload: unknown, upstream: Record<string, unknown> = {}): Issue[] {
  try {
    return validateArtifactUnsafe(code, payload, upstream);
  } catch {
    return [{ level: 'error', message: INCOMPLETE_ROW_MESSAGE }];
  }
}

function validateArtifactUnsafe(code: string, payload: unknown, upstream: Record<string, unknown> = {}): Issue[] {
  if (payload === null || typeof payload !== 'object') {
    return [{ level: 'error', message: '成果内容为空' }];
  }
  switch (code) {
    case 'S1-01':
      return validateStrategyContent(payload as StrategyContent);
    case 'S1-02':
      return validateStrategyMap(payload as StrategyMap);
    case 'S1-03':
      return validateStrategyLogic(payload as StrategyLogic);
    case 'S1-04':
      return validateIpooc(payload as IpoocDesign);
    case 'S1-05':
      return validateKpiScreening(payload as KpiScreening);
    case 'S1-06':
      return validateStrategyKpis(payload as StrategyKpiTable);
    case 'S1-07':
      return validateKpiBreakdown(payload as KpiBreakdown, upstream['S1-06'] as StrategyKpiTable | undefined);
    case 'M-MISSION':
      return validateMissionWorksheet(payload as MissionWorksheet);
    case 'M-VISION':
      return validateVisionWorksheet(payload as VisionWorksheet);
    case 'M-BUDGET':
      return validateBudgetWorksheet(payload as BudgetWorksheet);
    case 'S2-01':
      return validateDecodeMap(payload as DecodeMap, targetsOf(upstream['S2-03']));
    case 'S2-03': {
      // 第一步 定目标 first: without goals there is nothing to find paths for.
      const targets = targetsOf(payload) ?? { year: 0, strategyReview: '', lastPeriodIssues: '', goals: [] };
      const targetIssues = validateGoalTargets(targets).map((i) => ({ ...i, message: `定目标：${i.message}` }));
      const goals = (targets.goals ?? []).map((g) => ({ id: g.id, label: g.task || g.metric }));
      return [...targetIssues, ...validateGoalPathSystem(payload as GoalPathSystem, goals).map((i) => ({ ...i, message: `找路径：${i.message}` }))];
    }
    case 'S2-06': {
      const rows = (upstream['S2-05'] as DeptUndertakingTable | undefined)?.rows ?? [];
      const goals = rows.map((r) => ({ id: r.id, label: `${r.deptName} · ${r.task}` }));
      return validateGoalPathSystem(payload as GoalPathSystem, goals, '部门目标');
    }
    case 'S2-08':
      return validateKeyProjects(payload as KeyProjectList);
    case 'S2-04':
      return validateRaciTable(payload as RaciTable);
    case 'S2-05':
      return validateDeptUndertaking(payload as DeptUndertakingTable, upstream['S2-04'] as RaciTable | undefined);
    case 'S2-07':
      return validateScorecards(payload as ScorecardSet);
    case 'S3-02':
      return validateCharterSet(payload as ProjectCharterSet);
    case 'S3-05':
      return validateProgressPlan(payload as ProgressPlan, upstream['S3-02'] as ProjectCharterSet | undefined);
    case 'S3-06':
      return validateResourceMatch(payload as ResourceMatch, upstream['S3-02'] as ProjectCharterSet | undefined);
    case 'S3-07':
      return validateCompanyPlanBook(payload as CompanyPlanBook);
    case 'S3-08':
      return validateDeptPlanBook(payload as DeptPlanBook);
    default:
      return [];
  }
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
