// 定战略责 tables after S1-01: strategy map (S1-02), strategy/tactic logic (S1-03),
// IPOOC (S1-04), KPI screening (S1-05), strategy KPIs (S1-06), annual breakdown (S1-07),
// and the mission / vision method worksheets. Field sets follow the book's tables
// (表 2-3、2-7、2-8、2-10、2-12) and spec V1.2 §二(六).

import type { Issue, Perspective, StrategyContent } from './validators';

const PENDING_MARK = '待补';

function filled(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && text !== PENDING_MARK;
}

let idCounter = 0;
/** Short client-side IDs for table rows; unique within one payload is enough. */
export function newRowId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36).slice(-4)}${idCounter.toString(36)}`;
}

// ── S1-02 战略地图 ──

/** Top to bottom, as the map is drawn. */
export const PERSPECTIVES: { key: Perspective; label: string; hint: string }[] = [
  { key: 'financial', label: '财务', hint: '股东与经营结果：增长、利润、回报' },
  { key: 'customer', label: '客户', hint: '为谁创造什么价值' },
  { key: 'process', label: '内部流程', hint: '靠哪些关键流程交付价值' },
  { key: 'learning', label: '学习与成长', hint: '人才、组织、信息与文化基础' },
];

const PERSPECTIVE_RANK: Record<Perspective, number> = { learning: 0, process: 1, customer: 2, financial: 3 };

export interface MapObjective {
  id: string;
  perspective: Perspective;
  title: string;
  note: string;
}

export interface MapLink {
  id: string;
  from: string;
  to: string;
  /** 纵向因果（自下而上支撑）或横向协同（同一层面）。 */
  kind: 'cause' | 'synergy';
}

export interface StrategyMap {
  objectives: MapObjective[];
  links: MapLink[];
}

export function emptyStrategyMap(): StrategyMap {
  return { objectives: [], links: [] };
}

export function validateStrategyMap(map: StrategyMap): Issue[] {
  const issues: Issue[] = [];
  const objectives = map.objectives ?? [];
  const links = map.links ?? [];
  if (objectives.length === 0) return [{ level: 'error', message: '至少需要一个战略目标' }];

  for (const o of objectives) {
    if (!filled(o.title)) issues.push({ level: 'error', message: '战略目标名称未填写', anchor: o.id });
  }
  const used = new Set(objectives.map((o) => o.perspective));
  if (used.size < 3) {
    issues.push({ level: 'error', message: '战略地图至少要覆盖三个层面（财务、客户、内部流程、学习与成长）' });
  } else {
    for (const p of PERSPECTIVES) {
      if (!used.has(p.key)) issues.push({ level: 'warning', message: `“${p.label}”层面还没有战略目标` });
    }
  }

  const byId = new Map(objectives.map((o) => [o.id, o]));
  const seen = new Set<string>();
  let causeCount = 0;
  for (const link of links) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from || !to || from.id === to.id) {
      issues.push({ level: 'error', message: '有一条关系没有选好两端的目标', anchor: link.id });
      continue;
    }
    const key = [link.kind, ...(link.kind === 'synergy' ? [from.id, to.id].sort() : [from.id, to.id])].join(':');
    if (seen.has(key)) issues.push({ level: 'warning', message: `“${from.title}”与“${to.title}”的关系重复了`, anchor: link.id });
    seen.add(key);
    if (link.kind === 'cause') {
      causeCount += 1;
      if (PERSPECTIVE_RANK[to.perspective] <= PERSPECTIVE_RANK[from.perspective]) {
        issues.push({
          level: 'error',
          message: `因果关系应自下而上：“${from.title}”支撑的目标要在更上一层`,
          anchor: link.id,
        });
      }
    } else if (from.perspective !== to.perspective) {
      issues.push({ level: 'error', message: `横向协同只连接同一层面的目标：“${from.title}”与“${to.title}”不在同一层`, anchor: link.id });
    }
  }
  if (objectives.length > 1 && causeCount === 0) {
    issues.push({ level: 'error', message: '还没有画出纵向因果关系：说明下层目标如何支撑上层目标' });
  }
  if (objectives.length > 1) {
    const linked = new Set(links.flatMap((l) => [l.from, l.to]));
    for (const o of objectives) {
      if (filled(o.title) && !linked.has(o.id)) {
        issues.push({ level: 'warning', message: `“${o.title}”还没有与其他目标建立关系`, anchor: o.id });
      }
    }
  }
  return issues;
}

/** Starting objectives from S1-01: the house's goals and battlefields, or the sixfold goals. */
export function seedStrategyMap(content: StrategyContent): StrategyMap {
  const objectives: MapObjective[] = [];
  const add = (perspective: Perspective, title: string, note = '') => {
    if (filled(title)) objectives.push({ id: newRowId('o'), perspective, title: title.trim(), note });
  };
  // 六分法 is always there; a filled-in strategy house adds its battlefields and foundation.
  if (filled(content.strategicGoals)) add('financial', content.strategicGoals, '战略目标');
  else add('financial', content.goals?.y3 ?? '', '三年经营目标');
  if ((content.battlefields ?? []).some((b) => filled(b.name))) {
    for (const b of content.battlefields ?? []) {
      add('customer', b.name, '主要战场');
      add('process', b.advantage, `如何致胜 · ${b.name}`);
    }
    add('learning', content.foundation?.talent ?? '', '落地保障 · 人才');
    add('learning', content.foundation?.organization ?? '', '落地保障 · 组织');
  } else {
    add('customer', content.strategyChoice, '策略选择');
    add('process', content.stepsAndMeasures, '步骤举措');
  }
  return { objectives, links: [] };
}

// ── S1-03 企业战略、策略逻辑表（表 2-7） ──

export interface StrategyTactic {
  id: string;
  /** 策略：动词＋宾语。 */
  text: string;
  /** 可选：路径（在定目标责展开）。 */
  path: string;
}

export interface StrategyLine {
  id: string;
  /** 战略：做不做、做什么。 */
  statement: string;
  tactics: StrategyTactic[];
}

export interface StrategyLogic {
  strategies: StrategyLine[];
  /** 层级相对性说明：集团的策略可能是业务单元的战略。 */
  levelNote: string;
}

export function emptyStrategyLogic(): StrategyLogic {
  return { strategies: [], levelNote: '' };
}

export function validateStrategyLogic(logic: StrategyLogic): Issue[] {
  const issues: Issue[] = [];
  const strategies = logic.strategies ?? [];
  if (strategies.length === 0) return [{ level: 'error', message: '至少导出一条战略' }];
  for (const s of strategies) {
    if (!filled(s.statement)) issues.push({ level: 'error', message: '战略（做不做 / 做什么）未填写', anchor: s.id });
    const tactics = s.tactics ?? [];
    if (tactics.length === 0) {
      issues.push({ level: 'error', message: `战略“${s.statement || '未命名'}”下还没有策略`, anchor: s.id });
    }
    for (const t of tactics) {
      if (!filled(t.text)) issues.push({ level: 'error', message: '策略未填写', anchor: t.id });
      else if (t.text.trim().length < 4) {
        issues.push({ level: 'warning', message: `策略“${t.text}”过短，建议写成“动词＋宾语”`, anchor: t.id });
      }
    }
  }
  if (!filled(logic.levelNote)) {
    issues.push({ level: 'warning', message: '建议说明层级相对性：哪些策略到业务单元会成为单元战略' });
  }
  return issues;
}

/** One strategy per line of the sixfold strategy choice (or per battlefield when the house has them), each with an empty tactic. */
export function seedStrategyLogic(content: StrategyContent): StrategyLogic {
  const battlefields = (content.battlefields ?? []).map((b) => b.name).filter(filled);
  const statements = battlefields.length ? battlefields : (content.strategyChoice ?? '').split(/[\n；;]+/);
  return {
    strategies: statements
      .map((s) => s.trim())
      .filter(filled)
      .map((statement) => ({ id: newRowId('s'), statement, tactics: [{ id: newRowId('t'), text: '', path: '' }] })),
    levelNote: '',
  };
}

// ── S1-04 IPOOC 指标设计表（表 2-8） ──

export type IpoocStage = 'I' | 'P' | 'O1' | 'O2' | 'C';

export const IPOOC_STAGES: { key: IpoocStage; label: string; hint: string; dimensions: string }[] = [
  { key: 'I', label: 'I 投入', hint: '实现目标所需的资源、资金、信息、人力', dimensions: '资源投入量 / 配置效率 / 人员到位率' },
  { key: 'P', label: 'P 过程', hint: '推动目标实现的关键步骤、活动、流程', dimensions: '进度 / 质量 / 效率 / 完成率' },
  { key: 'O1', label: 'O 产出', hint: '直接交付成果（制度、产品、服务等）', dimensions: '数量 / 完成率 / 交付时间' },
  { key: 'O2', label: 'O 结果', hint: '客户、市场或组织视角的最终成效', dimensions: '增长率 / 满意度 / 市场份额' },
  { key: 'C', label: 'C 成本', hint: '费用支出与节约水平（本书约定 C = Cost）', dimensions: '总成本 / 单位成本 / 成本节降率' },
];

export const SMART_CHECKS: { key: keyof IpoocSheet['smart']; label: string }[] = [
  { key: 's', label: '具体（S）' },
  { key: 'm', label: '可衡量（M）' },
  { key: 'a', label: '可达成（A）' },
  { key: 'r', label: '相关（R）' },
  { key: 't', label: '有时限（T）' },
];

export interface IpoocRow {
  elements: string;
  indicator: string;
  formula: string;
  target: string;
  source: string;
  frequency: string;
}

export interface IpoocSheet {
  id: string;
  /** 关键策略（来自 S1-03）。 */
  strategy: string;
  period: string;
  ownerDept: string;
  rows: Record<IpoocStage, IpoocRow>;
  smart: { s: boolean; m: boolean; a: boolean; r: boolean; t: boolean };
}

export interface IpoocDesign {
  sheets: IpoocSheet[];
}

const emptyIpoocRow = (): IpoocRow => ({ elements: '', indicator: '', formula: '', target: '', source: '', frequency: '' });

export function emptyIpoocSheet(strategy = ''): IpoocSheet {
  return {
    id: newRowId('i'),
    strategy,
    period: '',
    ownerDept: '',
    rows: { I: emptyIpoocRow(), P: emptyIpoocRow(), O1: emptyIpoocRow(), O2: emptyIpoocRow(), C: emptyIpoocRow() },
    smart: { s: false, m: false, a: false, r: false, t: false },
  };
}

export function emptyIpoocDesign(): IpoocDesign {
  return { sheets: [] };
}

export function validateIpooc(design: IpoocDesign): Issue[] {
  const issues: Issue[] = [];
  const sheets = design.sheets ?? [];
  if (sheets.length === 0) return [{ level: 'error', message: '至少选一个核心主题做 IPOOC 拆解' }];
  for (const sheet of sheets) {
    const name = sheet.strategy || '未命名主题';
    if (!filled(sheet.strategy)) issues.push({ level: 'error', message: '关键策略未填写', anchor: sheet.id });
    const rows = IPOOC_STAGES.map((s) => ({ stage: s, row: sheet.rows?.[s.key] ?? emptyIpoocRow() }));
    const withIndicator = rows.filter((r) => filled(r.row.indicator));
    if (withIndicator.length === 0) {
      issues.push({ level: 'error', message: `“${name}”还没有设计任何指标`, anchor: sheet.id });
    }
    for (const { stage, row } of withIndicator) {
      if (!filled(row.target)) {
        issues.push({ level: 'warning', message: `“${name}”的${stage.label}指标还没有目标值`, anchor: `${sheet.id}.${stage.key}` });
      }
    }
    if (!SMART_CHECKS.every((c) => sheet.smart?.[c.key])) {
      issues.push({ level: 'warning', message: `“${name}”还没有通过 SMART 验证`, anchor: sheet.id });
    }
  }
  return issues;
}

/** Key tactics from S1-03 that do not have an IPOOC sheet yet. */
export function tacticsFromLogic(logic: StrategyLogic | null | undefined): string[] {
  return (logic?.strategies ?? []).flatMap((s) => (s.tactics ?? []).map((t) => t.text.trim()).filter(filled));
}

// ── S1-05 KPI 筛选评价表（表 2-10/2-11） ──

export type ScreenDimension = 'relevance' | 'measurability' | 'controllability' | 'motivation';

export const SCREEN_DIMENSIONS: { key: ScreenDimension; label: string; hint: string }[] = [
  { key: 'relevance', label: '战略相关性', hint: '与战略目标的关联程度' },
  { key: 'measurability', label: '可测量性', hint: '数据是否可获得、口径是否清楚' },
  { key: 'controllability', label: '可控性', hint: '责任主体能否影响结果' },
  { key: 'motivation', label: '可激发性', hint: '能否牵引和激发团队' },
];

/** The book suggests keeping no more than six strategy KPIs. */
export const MAX_STRATEGY_KPIS = 6;

export interface KpiCandidate {
  id: string;
  name: string;
  /** 来源：IPOOC 主题与环节，或手工补充。 */
  origin: string;
  scores: Record<ScreenDimension, number | null>;
  /** 保留为战略 KPI（true）、剔除（false）、未决（null）。 */
  keep: boolean | null;
  reason: string;
}

export interface KpiScreening {
  candidates: KpiCandidate[];
}

export function emptyKpiScreening(): KpiScreening {
  return { candidates: [] };
}

export function emptyCandidate(name = '', origin = ''): KpiCandidate {
  return {
    id: newRowId('k'),
    name,
    origin,
    scores: { relevance: null, measurability: null, controllability: null, motivation: null },
    keep: null,
    reason: '',
  };
}

const validScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

export function candidateTotal(candidate: KpiCandidate): number | null {
  const values = SCREEN_DIMENSIONS.map((d) => candidate.scores?.[d.key]);
  return values.every(validScore) ? values.reduce((sum, v) => sum + (v as number), 0) : null;
}

export function validateKpiScreening(screening: KpiScreening): Issue[] {
  const issues: Issue[] = [];
  const candidates = screening.candidates ?? [];
  if (candidates.length === 0) return [{ level: 'error', message: '还没有候选指标' }];
  for (const c of candidates) {
    const name = c.name || '未命名指标';
    if (!filled(c.name)) issues.push({ level: 'error', message: '候选指标名称未填写', anchor: c.id });
    const missing = SCREEN_DIMENSIONS.filter((d) => !validScore(c.scores?.[d.key]));
    if (missing.length) {
      issues.push({ level: 'error', message: `“${name}”的${missing.map((d) => d.label).join('、')}未打分（1—5 分）`, anchor: c.id });
    }
    if (c.keep === null || c.keep === undefined) {
      issues.push({ level: 'error', message: `“${name}”还没有给出保留或剔除的结论`, anchor: c.id });
    } else if (c.keep === false && !filled(c.reason)) {
      issues.push({ level: 'warning', message: `建议写明剔除“${name}”的理由，便于追溯`, anchor: c.id });
    }
  }
  const kept = candidates.filter((c) => c.keep === true).length;
  if (kept === 0) issues.push({ level: 'error', message: '至少保留一个战略 KPI' });
  if (kept > MAX_STRATEGY_KPIS) {
    issues.push({ level: 'warning', message: `保留了 ${kept} 个战略 KPI，书中建议不超过 ${MAX_STRATEGY_KPIS} 个` });
  }
  return issues;
}

/** Candidates from the IPOOC indicators that are not already listed. */
export function candidatesFromIpooc(design: IpoocDesign | null | undefined, existing: KpiCandidate[] = []): KpiCandidate[] {
  const names = new Set(existing.map((c) => c.name.trim()));
  const out: KpiCandidate[] = [];
  for (const sheet of design?.sheets ?? []) {
    for (const stage of IPOOC_STAGES) {
      const indicator = sheet.rows?.[stage.key]?.indicator?.trim() ?? '';
      if (!filled(indicator) || names.has(indicator)) continue;
      names.add(indicator);
      out.push(emptyCandidate(indicator, `${sheet.strategy} · ${stage.label}`));
    }
  }
  return out;
}

// ── S1-06 战略 KPI 表 ──

export interface StrategyKpi {
  id: string;
  /** 战略主题 / 战略要点。 */
  theme: string;
  name: string;
  /** 口径 / 计算公式。 */
  definition: string;
  unit: string;
  source: string;
  period: string;
  owner: string;
}

export interface StrategyKpiTable {
  kpis: StrategyKpi[];
}

export function emptyStrategyKpiTable(): StrategyKpiTable {
  return { kpis: [] };
}

export function emptyKpi(name = '', theme = ''): StrategyKpi {
  return { id: newRowId('p'), theme, name, definition: '', unit: '', source: '', period: '', owner: '' };
}

export function validateStrategyKpis(table: StrategyKpiTable): Issue[] {
  const issues: Issue[] = [];
  const kpis = table.kpis ?? [];
  if (kpis.length === 0) return [{ level: 'error', message: '至少定义一个战略 KPI' }];
  const names = new Map<string, number>();
  for (const k of kpis) {
    const name = k.name || '未命名指标';
    if (!filled(k.name)) issues.push({ level: 'error', message: '指标名称未填写', anchor: k.id });
    const missing = [
      ['definition', '口径'],
      ['source', '数据来源'],
      ['period', '统计周期'],
    ].filter(([key]) => !filled(k[key as keyof StrategyKpi]));
    if (missing.length) {
      issues.push({ level: 'error', message: `“${name}”的${missing.map(([, label]) => label).join('、')}未填写`, anchor: k.id });
    }
    if (!filled(k.owner)) issues.push({ level: 'warning', message: `“${name}”还没有责任部门`, anchor: k.id });
    if (filled(k.name)) names.set(k.name.trim(), (names.get(k.name.trim()) ?? 0) + 1);
  }
  for (const [name, count] of names) {
    if (count > 1) issues.push({ level: 'warning', message: `指标“${name}”出现了 ${count} 次` });
  }
  if (kpis.length > MAX_STRATEGY_KPIS) {
    issues.push({ level: 'warning', message: `共有 ${kpis.length} 个战略 KPI，书中建议不超过 ${MAX_STRATEGY_KPIS} 个` });
  }
  return issues;
}

/** Kept screening candidates that are not in the KPI table yet. */
export function kpisFromScreening(screening: KpiScreening | null | undefined, existing: StrategyKpi[] = []): StrategyKpi[] {
  const names = new Set(existing.map((k) => k.name.trim()));
  return (screening?.candidates ?? [])
    .filter((c) => c.keep === true && filled(c.name) && !names.has(c.name.trim()))
    .map((c) => emptyKpi(c.name.trim(), c.origin.split(' · ')[0] ?? ''));
}

// ── S1-07 战略 KPI 3—5 年年度分解表（表 2-12） ──

export interface KpiBreakdownRow {
  id: string;
  /** The S1-06 KPI this row breaks down, when imported. */
  kpiId: string | null;
  theme: string;
  name: string;
  unit: string;
  /** Value per year, keyed by the year. */
  values: Record<string, string>;
  baseline: string;
  benchmark: string;
  challenge: string;
}

export interface KpiBreakdown {
  years: number[];
  rows: KpiBreakdownRow[];
}

/** 前三后一：the next three years in detail, plus the fifth year. */
export function defaultBreakdownYears(startYear: number): number[] {
  return [startYear, startYear + 1, startYear + 2, startYear + 4];
}

export function emptyKpiBreakdown(startYear: number): KpiBreakdown {
  return { years: defaultBreakdownYears(startYear), rows: [] };
}

export function breakdownRow(kpi?: Partial<StrategyKpi>): KpiBreakdownRow {
  return {
    id: newRowId('y'),
    kpiId: kpi?.id ?? null,
    theme: kpi?.theme ?? '',
    name: kpi?.name ?? '',
    unit: kpi?.unit ?? '',
    values: {},
    baseline: '',
    benchmark: '',
    challenge: '',
  };
}

export function validateKpiBreakdown(breakdown: KpiBreakdown, upstream?: StrategyKpiTable | null): Issue[] {
  const issues: Issue[] = [];
  const years = breakdown.years ?? [];
  if (years.length < 3) issues.push({ level: 'error', message: '至少分解到 3 个年度' });
  if (new Set(years).size !== years.length || years.some((y, i) => i > 0 && y <= years[i - 1])) {
    issues.push({ level: 'error', message: '年度要从早到晚排列且不能重复' });
  }
  const rows = breakdown.rows ?? [];
  if (rows.length === 0) return [...issues, { level: 'error', message: '还没有要分解的战略 KPI' }];
  const firstYear = years[0];
  for (const row of rows) {
    const name = row.name || '未命名指标';
    if (!filled(row.name)) issues.push({ level: 'error', message: '指标名称未填写', anchor: row.id });
    if (firstYear !== undefined && !filled(row.values?.[String(firstYear)])) {
      issues.push({ level: 'error', message: `“${name}”缺少 ${firstYear} 年的指标值：本年度目标必须明确`, anchor: row.id });
    }
    const blanks = years.slice(1).filter((y) => !filled(row.values?.[String(y)]));
    if (blanks.length) {
      issues.push({ level: 'warning', message: `“${name}”的 ${blanks.join('、')} 年还没有值，可共创补齐`, anchor: row.id });
    }
    if (!filled(row.challenge)) issues.push({ level: 'warning', message: `“${name}”还没有挑战值`, anchor: row.id });
  }
  const covered = new Set(rows.map((r) => r.kpiId).filter(Boolean));
  for (const kpi of upstream?.kpis ?? []) {
    if (filled(kpi.name) && !covered.has(kpi.id) && !rows.some((r) => r.name.trim() === kpi.name.trim())) {
      issues.push({ level: 'warning', message: `战略 KPI 表里的“${kpi.name}”还没有年度分解` });
    }
  }
  return issues;
}

/** Rows for S1-06 KPIs that are not broken down yet. */
export function breakdownRowsFromKpis(table: StrategyKpiTable | null | undefined, existing: KpiBreakdownRow[] = []): KpiBreakdownRow[] {
  const ids = new Set(existing.map((r) => r.kpiId).filter(Boolean));
  const names = new Set(existing.map((r) => r.name.trim()));
  return (table?.kpis ?? [])
    .filter((k) => filled(k.name) && !ids.has(k.id) && !names.has(k.name.trim()))
    .map((k) => breakdownRow(k));
}

/** This year's targets, for 定目标责 (S2-03-T reads them). */
export function currentYearTargets(breakdown: KpiBreakdown | null | undefined, year?: number) {
  const target = year ?? breakdown?.years?.[0];
  if (!breakdown || target === undefined) return [];
  return (breakdown.rows ?? [])
    .filter((r) => filled(r.values?.[String(target)]))
    .map((r) => ({ name: r.name, unit: r.unit, value: r.values[String(target)], theme: r.theme }));
}

// ── M-MISSION 使命五要素萃取（表 2-3） ──

export interface MissionWorksheet {
  coreUser: { who: string; need: string };
  coreCustomer: { who: string; need: string };
  differentiation: string;
  advantage: string;
  /** 事业的哲学意义。 */
  philosophy: string;
  /** 合成的使命句。 */
  statement: string;
}

export function emptyMissionWorksheet(): MissionWorksheet {
  return {
    coreUser: { who: '', need: '' },
    coreCustomer: { who: '', need: '' },
    differentiation: '',
    advantage: '',
    philosophy: '',
    statement: '',
  };
}

export function validateMissionWorksheet(sheet: MissionWorksheet): Issue[] {
  const issues: Issue[] = [];
  if (!filled(sheet.statement)) issues.push({ level: 'error', message: '还没有合成使命句', anchor: 'statement' });
  const parts = [sheet.coreUser?.who, sheet.coreCustomer?.who, sheet.differentiation, sheet.advantage, sheet.philosophy];
  const done = parts.filter(filled).length;
  if (done < parts.length) issues.push({ level: 'warning', message: `五要素已萃取 ${done}/5 项` });
  return issues;
}

// ── M-VISION 愿景三法 ──

export interface VisionWorksheet {
  /** 战略推导法。 */
  derivation: string;
  /** 对标一流：选标 → 对标 → 定标。 */
  benchmark: { select: string; compare: string; set: string };
  /** 引以为傲法。 */
  pride: string;
  /** 愿景的时间跨度，通常 7—10 年。 */
  horizon: string;
  statement: string;
}

export function emptyVisionWorksheet(): VisionWorksheet {
  return { derivation: '', benchmark: { select: '', compare: '', set: '' }, pride: '', horizon: '', statement: '' };
}

export function validateVisionWorksheet(sheet: VisionWorksheet): Issue[] {
  const issues: Issue[] = [];
  if (!filled(sheet.statement)) issues.push({ level: 'error', message: '还没有写出愿景句', anchor: 'statement' });
  const used = [filled(sheet.derivation), filled(sheet.benchmark?.set) || filled(sheet.benchmark?.select), filled(sheet.pride)].filter(
    Boolean,
  ).length;
  if (used === 0) issues.push({ level: 'warning', message: '建议至少用一种方法推导愿景：战略推导、对标一流或引以为傲' });
  return issues;
}
