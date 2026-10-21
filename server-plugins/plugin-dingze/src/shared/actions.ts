// 定行动责 tables: project charters with screening and WBS (S3-02 / S3-03), the progress
// plan with nodes (S3-05 / S3-04), resource matching (S3-06) and the company and
// department plan books (S3-07 / S3-08). Spec V1.2 §二(八).

import type { GoalPathSystem, KeyProjectList } from './goals';
import { newRowId } from './measures';
import type { Issue } from './validators';

const PENDING_MARK = '待补';

function filled(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && text !== PENDING_MARK;
}

// ── 项目化判定（S3-02 前半） ──

export const SCREEN_QUESTIONS: { key: 'crossDept' | 'longRunning' | 'reusable' | 'risky'; label: string }[] = [
  { key: 'crossDept', label: '跨部门协同或存在关键依赖' },
  { key: 'longRunning', label: '持续 ≥4 周且需要专门资源 / 预算' },
  { key: 'reusable', label: '产出能力、制度、系统等可复用交付物' },
  { key: 'risky', label: '不做或拖延会带来明显经营或合规风险' },
];

export type ScreenAnswers = Record<(typeof SCREEN_QUESTIONS)[number]['key'], boolean | null>;

export type ProjectClass = 'P' | 'S' | 'R';

export const CLASS_LABELS: Record<ProjectClass, string> = { P: '项目', S: '专项任务', R: '例行（转部门日常）' };

export interface ScreeningItem {
  id: string;
  /** S2-08 project (S3-01 snapshot) or S2-06 department path it came from. */
  sourceId: string | null;
  sourceKind: 'project' | 'path' | 'manual';
  name: string;
  /** 成果导向重命名。 */
  renamed: string;
  answers: ScreenAnswers;
}

/** ≥2 yes = P, 1 = S, 0 = R; null while any question is unanswered (so the result can be recomputed). */
export function classify(answers: ScreenAnswers): ProjectClass | null {
  const values = SCREEN_QUESTIONS.map((q) => answers?.[q.key]);
  if (values.some((v) => v === null || v === undefined)) return null;
  const yes = values.filter(Boolean).length;
  return yes >= 2 ? 'P' : yes === 1 ? 'S' : 'R';
}

// ── S3-02 项目任务书（表 4-4）与 S3-03 WBS ──

export const PRIORITY_FACTORS: { key: 'fit' | 'roi' | 'urgency' | 'feasibility' | 'resources'; label: string; weight: number }[] = [
  { key: 'fit', label: '战略契合', weight: 0.3 },
  { key: 'roi', label: '价值 ROI', weight: 0.25 },
  { key: 'urgency', label: '紧迫性', weight: 0.2 },
  { key: 'feasibility', label: '可行性', weight: 0.15 },
  { key: 'resources', label: '资源可得性', weight: 0.1 },
];

export type PriorityScores = Record<(typeof PRIORITY_FACTORS)[number]['key'], number | null>;

/** Weighted 1–5 score, two decimals; null until every factor is scored. */
export function priorityScore(scores: PriorityScores): number | null {
  const values = PRIORITY_FACTORS.map((f) => scores?.[f.key]);
  if (!values.every((v) => typeof v === 'number' && v >= 1 && v <= 5)) return null;
  const sum = PRIORITY_FACTORS.reduce((acc, f) => acc + (scores[f.key] as number) * f.weight, 0);
  return Math.round(sum * 100) / 100;
}

export interface WbsPackage {
  id: string;
  parentId: string | null;
  /** 1–3. */
  level: number;
  name: string;
  deliverable: string;
  /** 完成定义。 */
  doneDefinition: string;
  owner: string;
  dependsOn: string[];
}

export interface CharterRisk {
  id: string;
  risk: string;
  trigger: string;
  response: string;
}

export interface ProjectCharter {
  id: string;
  screeningId: string | null;
  /** 年份＋职能英文简称＋P＋3 位序号，如 2026OPSP001。 */
  code: string;
  name: string;
  theme: string;
  priority: PriorityScores;
  objective: string;
  start: string;
  end: string;
  inScope: string;
  outOfScope: string;
  deliverables: string;
  milestones: string;
  /** Lead department (the RACI A), used for department plan books. */
  deptId: string;
  deptName: string;
  owner: string;
  raci: string;
  resources: { fte: string; budget: string; material: string };
  risks: CharterRisk[];
  assumptions: string;
  acceptance: { result: string; process: string; close: string };
  wbs: WbsPackage[];
}

export interface ProjectCharterSet {
  screening: ScreeningItem[];
  charters: ProjectCharter[];
}

/** 年份＋职能英文简称＋P＋3 位序号; the book writes it with or without hyphens (2026OPSP001, 2024HR-P001, 2026-RP001). */
export const CHARTER_CODE_PATTERN = /^\d{4}-?[A-Z]{0,6}-?P\d{3}$/;
export const MAX_WBS_LEVEL = 3;

export function emptyCharterSet(): ProjectCharterSet {
  return { screening: [], charters: [] };
}

export function emptyScreening(patch: Partial<ScreeningItem> = {}): ScreeningItem {
  return {
    id: newRowId('sc'),
    sourceId: null,
    sourceKind: 'manual',
    name: '',
    renamed: '',
    answers: { crossDept: null, longRunning: null, reusable: null, risky: null },
    ...patch,
  };
}

export function emptyCharter(patch: Partial<ProjectCharter> = {}): ProjectCharter {
  return {
    id: newRowId('pc'),
    screeningId: null,
    code: '',
    name: '',
    theme: '',
    priority: { fit: null, roi: null, urgency: null, feasibility: null, resources: null },
    objective: '',
    start: '',
    end: '',
    inScope: '',
    outOfScope: '',
    deliverables: '',
    milestones: '',
    deptId: '',
    deptName: '',
    owner: '',
    raci: '',
    resources: { fte: '', budget: '', material: '' },
    risks: [],
    assumptions: '',
    acceptance: { result: '', process: '', close: '' },
    wbs: [],
    ...patch,
  };
}

export function wbsPackage(patch: Partial<WbsPackage> = {}): WbsPackage {
  return { id: newRowId('w'), parentId: null, level: 1, name: '', deliverable: '', doneDefinition: '', owner: '', dependsOn: [], ...patch };
}

/** Next code for a function abbreviation: 2026 + OPS + P + 001. */
export function nextCharterCode(year: number, func: string, existing: ProjectCharter[]): string {
  const prefix = `${year}${func.toUpperCase()}P`;
  const used = existing.map((c) => c.code).filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length)) || 0);
  return `${prefix}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`;
}

/** Ids involved in a dependency cycle, if any. */
export function dependencyCycle<T extends { id: string; dependsOn: string[] }>(items: T[]): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const state = new Map<string, 'visiting' | 'done'>();
  const cycle: string[] = [];
  const visit = (id: string, stack: string[]): boolean => {
    if (state.get(id) === 'done') return false;
    if (state.get(id) === 'visiting') {
      cycle.push(...stack.slice(stack.indexOf(id), -1));
      return true;
    }
    state.set(id, 'visiting');
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(dep) && visit(dep, [...stack, dep])) return true;
    }
    state.set(id, 'done');
    return false;
  };
  for (const item of items) if (visit(item.id, [item.id])) break;
  return cycle;
}

export function validateCharterSet(set: ProjectCharterSet): Issue[] {
  const issues: Issue[] = [];
  const screening = set.screening ?? [];
  const charters = set.charters ?? [];
  if (screening.length === 0 && charters.length === 0) return [{ level: 'error', message: '还没有要项目化判定的事项' }];
  for (const s of screening) {
    const name = s.renamed || s.name || '未命名事项';
    if (classify(s.answers) === null) issues.push({ level: 'error', message: `“${name}”的项目化判定还没答完四个问题`, anchor: s.id });
    if (classify(s.answers) === 'P' && !charters.some((c) => c.screeningId === s.id)) {
      issues.push({ level: 'error', message: `“${name}”判定为项目，但还没有项目任务书`, anchor: s.id });
    }
  }
  const codes = new Map<string, number>();
  for (const c of charters) {
    const name = c.name || '未命名项目';
    const missing = [
      ['name', '项目名称'],
      ['objective', '项目目标'],
      ['start', '开始时间'],
      ['end', '结束时间'],
      ['deliverables', '关键交付物'],
      ['owner', '项目负责人'],
    ].filter(([key]) => !filled(c[key as keyof ProjectCharter] as string));
    if (missing.length) issues.push({ level: 'error', message: `“${name}”缺${missing.map(([, l]) => l).join('、')}`, anchor: c.id });
    if (!CHARTER_CODE_PATTERN.test(c.code ?? '')) {
      issues.push({ level: 'error', message: `“${name}”的项目编号应为“年份＋职能英文简称＋P＋3 位序号”，如 2026OPSP001 或 2024HR-P001`, anchor: c.id });
    } else codes.set(c.code, (codes.get(c.code) ?? 0) + 1);
    if (filled(c.start) && filled(c.end) && c.end < c.start) issues.push({ level: 'error', message: `“${name}”的结束时间早于开始时间`, anchor: c.id });
    if (!filled(c.acceptance?.result)) issues.push({ level: 'error', message: `“${name}”缺验收标准中的结果指标`, anchor: c.id });
    if (priorityScore(c.priority) === null) issues.push({ level: 'warning', message: `“${name}”的优先级五因子还没打完分`, anchor: c.id });
    if ((c.risks ?? []).length === 0) issues.push({ level: 'warning', message: `“${name}”还没有列出风险`, anchor: c.id });
    if ((c.risks ?? []).length > 3) issues.push({ level: 'warning', message: `“${name}”列了 ${c.risks.length} 条风险，任务书只需 Top3`, anchor: c.id });
    if (!filled(c.outOfScope)) issues.push({ level: 'warning', message: `“${name}”还没写范围外：不做什么同样要讲清`, anchor: c.id });
    // 验收意见 A07：项目目标、交付物和验收标准要能验收，不能只写“推进顺利”“领导满意”。
    const vague = vagueWord(c.objective, c.deliverables, c.acceptance?.result, c.acceptance?.process, c.acceptance?.close);
    if (vague) issues.push({ level: 'warning', message: `“${name}”的目标、交付物或验收标准用了“${vague}”这类没法验收的说法：写清证据、测量办法和通过线`, anchor: c.id });

    const wbs = c.wbs ?? [];
    if (wbs.length === 0) issues.push({ level: 'error', message: `“${name}”还没有 WBS 工作包`, anchor: c.id });
    const ids = new Set(wbs.map((w) => w.id));
    for (const w of wbs) {
      const wname = `${name} · ${w.name || '未命名工作包'}`;
      if (w.level < 1 || w.level > MAX_WBS_LEVEL) issues.push({ level: 'error', message: `“${wname}”超出 ${MAX_WBS_LEVEL} 层`, anchor: w.id });
      if (w.parentId && !ids.has(w.parentId)) issues.push({ level: 'error', message: `“${wname}”的上级工作包不存在`, anchor: w.id });
      const wmissing = [
        ['name', '名称'],
        ['doneDefinition', '完成定义'],
        ['owner', '责任人'],
      ].filter(([key]) => !filled(w[key as keyof WbsPackage] as string));
      if (wmissing.length) issues.push({ level: 'error', message: `“${wname}”缺${wmissing.map(([, l]) => l).join('、')}`, anchor: w.id });
      const wvague = vagueWord(w.doneDefinition, w.deliverable);
      if (wvague) issues.push({ level: 'warning', message: `“${wname}”的完成定义用了“${wvague}”，写成看得见的成果`, anchor: w.id });
      for (const dep of w.dependsOn ?? []) {
        if (!ids.has(dep)) issues.push({ level: 'error', message: `“${wname}”依赖的工作包不存在`, anchor: w.id });
      }
    }
    const cycle = dependencyCycle(wbs);
    if (cycle.length) {
      const names = cycle.map((id) => wbs.find((w) => w.id === id)?.name || id);
      issues.push({ level: 'error', message: `“${name}”的 WBS 依赖形成了循环：${names.join(' → ')}`, anchor: c.id });
    }
  }
  for (const [code, count] of codes) if (count > 1) issues.push({ level: 'error', message: `项目编号 ${code} 重复了` });
  return issues;
}

/** S3-01 snapshot (S2-08) and department level-1 paths (S2-06) not yet screened. */
export function screeningFrom(projects: KeyProjectList | null | undefined, deptPaths: GoalPathSystem | null | undefined, existing: ScreeningItem[] = []): ScreeningItem[] {
  const used = new Set(existing.map((s) => s.sourceId).filter(Boolean));
  const fromProjects = (projects?.projects ?? [])
    .filter((p) => filled(p.name) && !used.has(p.id))
    .map((p) => emptyScreening({ sourceId: p.id, sourceKind: 'project', name: p.name.trim() }));
  const fromPaths = (deptPaths?.nodes ?? [])
    .filter((n) => n.level === 1 && filled(n.path) && !used.has(n.id))
    .map((n) => emptyScreening({ sourceId: n.id, sourceKind: 'path', name: n.path.trim() }));
  return [...fromProjects, ...fromPaths];
}

/** A charter for a P item, prefilled from its S2-08 project when there is one. */
export function charterFor(item: ScreeningItem, projects: KeyProjectList | null | undefined, code: string): ProjectCharter {
  const project = item.sourceKind === 'project' ? projects?.projects?.find((p) => p.id === item.sourceId) : undefined;
  return emptyCharter({
    screeningId: item.id,
    code,
    name: item.renamed || item.name,
    theme: project?.theme ?? '',
    objective: project?.objective ?? '',
    start: project?.start ?? '',
    end: project?.end ?? '',
    milestones: project?.milestones ?? '',
    owner: project?.owner ?? '',
  });
}

// ── S3-05 计划实施推进表（表 4-6）与 S3-04 节点表（表 4-5） ──

export type NodeStatus = 'planned' | 'in_progress' | 'done' | 'delayed';

export const NODE_STATUS_LABELS: Record<NodeStatus, string> = { planned: '未开始', in_progress: '进行中', done: '已完成', delayed: '延期' };

export interface PlanNode {
  id: string;
  /** 项目阶段 (表 4-5), e.g. 立项 → 设计 → 试产 → 验证 → 上市; optional. */
  phase: string;
  /** Month “2026-03” or quarter “2026-Q2”, per the project's schedule scale. */
  time: string;
  name: string;
  deliverable: string;
  acceptance: string;
  owner: string;
  status: NodeStatus;
  dependsOn: string[];
}

export interface PlanRow {
  id: string;
  charterId: string | null;
  name: string;
  nodes: PlanNode[];
}

export interface ProgressPlan {
  scale: 'month' | 'quarter';
  rows: PlanRow[];
}

/** Words that describe effort, not an acceptable result (“推进、加强、持续优化”…). */
export const VAGUE_WORDS = ['推进', '加强', '持续优化', '进一步', '大力', '积极', '完善', '顺利', '满意', '基本完成', '尽快', '适当'];

/** The first effort word in a text meant to be checkable (验收标准、交付物、完成定义). */
export function vagueWord(...texts: (string | undefined | null)[]): string | undefined {
  return VAGUE_WORDS.find((w) => texts.some((t) => (t ?? '').includes(w)));
}

/** Node names that verify and nodes that put into production; a verify after production is suspicious. */
const VERIFY = /验证|测试|试运行|调试|评审|验收/;
const PRODUCE = /投产|投运|上线|交付使用|正式运行|量产/;

export function emptyProgressPlan(scale: 'month' | 'quarter'): ProgressPlan {
  return { scale, rows: [] };
}

export function planNode(patch: Partial<PlanNode> = {}): PlanNode {
  return { id: newRowId('pn'), phase: '', time: '', name: '', deliverable: '', acceptance: '', owner: '', status: 'planned', dependsOn: [], ...patch };
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER = /^(\d{4})-Q([1-4])$/;

/** Comparable index for a time cell; months and quarters both map onto months. */
export function timeIndex(time: string): number | null {
  const m = (time ?? '').match(MONTH);
  if (m) return Number(m[1]) * 12 + Number(m[2]) - 1;
  const q = (time ?? '').match(QUARTER);
  if (q) return Number(q[1]) * 12 + (Number(q[2]) - 1) * 3 + 2;
  return null;
}

/** Time columns between two months for the plan's scale. */
export function timeColumns(scale: 'month' | 'quarter', year: number): string[] {
  return scale === 'quarter'
    ? [1, 2, 3, 4].map((q) => `${year}-Q${q}`)
    : Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

export function validateProgressPlan(plan: ProgressPlan, charters?: ProjectCharterSet | null): Issue[] {
  const issues: Issue[] = [];
  const rows = plan.rows ?? [];
  if (rows.length === 0) return [{ level: 'error', message: '还没有导入项目及关键节点' }];
  const pattern = plan.scale === 'quarter' ? QUARTER : MONTH;
  const allNodes = rows.flatMap((r) => r.nodes ?? []);
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  for (const row of rows) {
    const nodes = row.nodes ?? [];
    if (nodes.length === 0) issues.push({ level: 'error', message: `“${row.name}”还没有关键节点`, anchor: row.id });
    else if (nodes.length < 3) issues.push({ level: 'warning', message: `“${row.name}”只有 ${nodes.length} 个节点，一般分 3—5 个阶段`, anchor: row.id });
    // 验收意见 A07：节点超出任务书的起止时间、验证排在投产之后，都要企业自己决定怎么调。
    const charter = charters?.charters?.find((c) => c.id === row.charterId);
    const end = charter?.end ? timeIndex(String(charter.end).slice(0, 7)) : null;
    for (const n of nodes) {
      const t = timeIndex(n.time);
      if (end !== null && t !== null && t > end) {
        issues.push({ level: 'warning', message: `“${row.name} · ${n.name || '未命名节点'}”晚于任务书的结束时间 ${charter!.end}：改节点，或回任务书调整工期`, anchor: n.id });
      }
    }
    const verify = nodes.filter((n) => VERIFY.test(`${n.name}${n.phase ?? ''}`));
    const produce = nodes.filter((n) => PRODUCE.test(`${n.name}${n.phase ?? ''}`));
    for (const v of verify) {
      const tv = timeIndex(v.time);
      const early = produce.find((p) => {
        const tp = timeIndex(p.time);
        return tv !== null && tp !== null && tp < tv;
      });
      if (early) issues.push({ level: 'warning', message: `“${row.name}”的“${v.name}”排在“${early.name}”之后：先投产后验证，可能顺序倒了`, anchor: v.id });
    }
    for (const n of nodes) {
      const name = `${row.name} · ${n.name || '未命名节点'}`;
      const missing = [
        ['time', '时间'],
        ['name', '节点名称'],
        ['deliverable', '成果'],
        ['acceptance', '验收标准'],
      ].filter(([key]) => !filled(n[key as keyof PlanNode] as string));
      if (missing.length) issues.push({ level: 'error', message: `“${name}”缺${missing.map(([, l]) => l).join('、')}`, anchor: n.id });
      if (filled(n.time) && !pattern.test(n.time)) {
        issues.push({ level: 'error', message: `“${name}”的时间应写成${plan.scale === 'quarter' ? '“2026-Q2”' : '“2026-03”'}`, anchor: n.id });
      }
      const vague = VAGUE_WORDS.find((w) => (n.deliverable ?? '').includes(w) || (n.acceptance ?? '').includes(w));
      if (vague) issues.push({ level: 'warning', message: `“${name}”用了“${vague}”这类不可验收的描述，写成具体成果`, anchor: n.id });
      if (!filled(n.owner)) issues.push({ level: 'warning', message: `“${name}”还没有责任人`, anchor: n.id });
      for (const dep of n.dependsOn ?? []) {
        const before = byId.get(dep);
        if (!before) {
          issues.push({ level: 'error', message: `“${name}”依赖的节点不存在`, anchor: n.id });
          continue;
        }
        const a = timeIndex(before.time);
        const b = timeIndex(n.time);
        if (a !== null && b !== null && a > b) {
          issues.push({ level: 'error', message: `“${name}”早于它依赖的“${before.name}”，前后顺序不连贯`, anchor: n.id });
        }
      }
    }
  }
  const cycle = dependencyCycle(allNodes);
  if (cycle.length) issues.push({ level: 'error', message: `节点依赖形成了循环：${cycle.map((id) => byId.get(id)?.name || id).join(' → ')}` });
  for (const c of charters?.charters ?? []) {
    if (!rows.some((r) => r.charterId === c.id)) issues.push({ level: 'warning', message: `项目“${c.name}”还没有导入推进表` });
  }
  return issues;
}

/** One row per charter not yet in the plan, with a node per level-1 WBS package. */
export function planRowsFromCharters(set: ProjectCharterSet | null | undefined, existing: PlanRow[] = []): PlanRow[] {
  const used = new Set(existing.map((r) => r.charterId).filter(Boolean));
  return (set?.charters ?? [])
    .filter((c) => filled(c.name) && !used.has(c.id))
    .map((c) => ({
      id: newRowId('pr'),
      charterId: c.id,
      name: `${c.code} ${c.name}`.trim(),
      nodes: (c.wbs ?? [])
        .filter((w) => w.level === 1)
        .map((w) => planNode({ name: w.name, deliverable: w.deliverable, acceptance: w.doneDefinition, owner: w.owner })),
    }));
}

// ── S3-06 项目资源匹配表（表 4-8） ──

export type ResourceCategory = 'finance' | 'people' | 'it' | 'material';

export const RESOURCE_CATEGORIES: { key: ResourceCategory; label: string }[] = [
  { key: 'finance', label: '财务' },
  { key: 'people', label: '人（人力 / FTE）' },
  { key: 'it', label: '信息化（信息化 / 数据）' },
  { key: 'material', label: '物料（设备 / 物料）' },
];

export interface ResourceRow {
  id: string;
  charterId: string | null;
  category: ResourceCategory;
  need: string;
  stock: string;
  gap: string;
  approach: string;
  owner: string;
  /** 显式填写“无”：该类不需要。 */
  none: boolean;
  major: boolean;
}

export interface ResourceMatch {
  rows: ResourceRow[];
}

export function emptyResourceMatch(): ResourceMatch {
  return { rows: [] };
}

export function resourceRow(patch: Partial<ResourceRow> = {}): ResourceRow {
  return { id: newRowId('rs'), charterId: null, category: 'finance', need: '', stock: '', gap: '', approach: '', owner: '', none: false, major: false, ...patch };
}

export function validateResourceMatch(match: ResourceMatch, charters?: ProjectCharterSet | null): Issue[] {
  const issues: Issue[] = [];
  const rows = match.rows ?? [];
  if (rows.length === 0) return [{ level: 'error', message: '还没有算资源需求' }];
  for (const r of rows) {
    if (r.none) continue;
    const cat = RESOURCE_CATEGORIES.find((c) => c.key === r.category)?.label ?? r.category;
    const name = `${charters?.charters?.find((c) => c.id === r.charterId)?.name ?? '未关联项目'} · ${cat}`;
    if (!filled(r.need)) issues.push({ level: 'error', message: `“${name}”缺需求`, anchor: r.id });
    if (!filled(r.stock)) issues.push({ level: 'warning', message: `“${name}”还没核对存量`, anchor: r.id });
    // 验收意见 A08：需求、存量、缺口都是同一单位的数字时，缺口应等于需求减存量。
    const nums = [r.need, r.stock, r.gap].map((v) => (v ?? '').trim().match(/^(-?\d+(?:\.\d+)?)\s*(\S*)$/));
    if (nums.every(Boolean) && nums[0]![2] === nums[1]![2] && nums[1]![2] === nums[2]![2]) {
      const expect = Math.max(0, Number((Number(nums[0]![1]) - Number(nums[1]![1])).toFixed(6)));
      if (Math.abs(expect - Number(nums[2]![1])) > 1e-6) {
        issues.push({ level: 'warning', message: `“${name}”需求 ${r.need}、存量 ${r.stock}，缺口应为 ${expect}${nums[0]![2]}，表里写的是 ${r.gap}`, anchor: r.id });
      }
    }
    const hasGap = filled(r.gap) && !/^(0|无|没有)$/.test(r.gap.trim());
    if ((hasGap || r.major) && (!filled(r.approach) || !filled(r.owner))) {
      issues.push({ level: r.major ? 'error' : 'warning', message: `“${name}”有缺口，要写明补齐方式和责任人`, anchor: r.id });
    }
  }
  for (const c of charters?.charters ?? []) {
    const own = rows.filter((r) => r.charterId === c.id);
    const missing = RESOURCE_CATEGORIES.filter((cat) => !own.some((r) => r.category === cat.key));
    if (missing.length) {
      issues.push({ level: 'warning', message: `项目“${c.name}”还没有${missing.map((m) => m.label.split('（')[0]).join('、')}类资源（不需要请填“无”）` });
    }
  }
  return issues;
}

/** 表 4-4 三分法 → 四类：人力→人，财务预算→财务，物力与支持→物料（信息化另列）。 */
export function resourceRowsFromCharters(set: ProjectCharterSet | null | undefined, existing: ResourceRow[] = []): ResourceRow[] {
  const used = new Set(existing.map((r) => `${r.charterId}|${r.category}`));
  const out: ResourceRow[] = [];
  for (const c of set?.charters ?? []) {
    const seeds: [ResourceCategory, string][] = [
      ['people', c.resources?.fte ?? ''],
      ['finance', c.resources?.budget ?? ''],
      ['material', c.resources?.material ?? ''],
      ['it', ''],
    ];
    for (const [category, need] of seeds) {
      if (used.has(`${c.id}|${category}`)) continue;
      out.push(resourceRow({ charterId: c.id, category, need }));
    }
  }
  return out;
}

// ── S3-07 / S3-08 年度经营计划书（8 章） ──

/** Chapters entered by the enterprise (non-same-source); the rest is assembled from locked tables. */
export interface PlanBookText {
  /** 一 执行摘要的补充说明（选填）：摘要本身由定版成果自动汇总（同源），这里不得改写定版数字。 */
  summary: string;
  /** 二 上年度总结概述。 */
  lastYear: string;
  /** 三 本年度环境分析 / 部门的环境承接与应对。 */
  environment: string;
  /** 七 风险评估与应对措施。 */
  risks: string;
  /** 七 “不做什么”边界 / 部门“三不做”清单。 */
  notDo: string;
  /** 8.3 指标字典说明（公司级）。 */
  dictionaryNote: string;
}

export const PLAN_BOOK_CHAPTERS: { no: string; company: string; dept: string; source: 'same' | 'entered' }[] = [
  { no: '一', company: '执行摘要', dept: '执行摘要', source: 'same' },
  { no: '二', company: '上年度总结概述', dept: '上年度总结概述', source: 'entered' },
  { no: '三', company: '本年度环境分析', dept: '本年度环境承接与部门应对', source: 'entered' },
  { no: '四', company: '本年度关键目标分解', dept: '本年度目标分解', source: 'same' },
  { no: '五', company: '本年度关键项目及实施计划', dept: '本年度关键项目及实施计划', source: 'same' },
  { no: '六', company: '资源与能力配置', dept: '资源与能力匹配', source: 'same' },
  { no: '七', company: '风险评估与应对措施（含“不做什么”边界）', dept: '风险评估与应对措施（含“三不做”清单）', source: 'entered' },
  { no: '八', company: '附件', dept: '附件', source: 'same' },
];

export function emptyPlanBookText(): PlanBookText {
  return { summary: '', lastYear: '', environment: '', risks: '', notDo: '', dictionaryNote: '' };
}

export interface CompanyPlanBook {
  text: PlanBookText;
}

export interface DeptPlanBook {
  /** `id` equals `deptId` so path-based AI changes can address a department. */
  depts: ({ id: string; deptId: string; deptName: string } & PlanBookText)[];
}

export function emptyCompanyPlanBook(): CompanyPlanBook {
  return { text: emptyPlanBookText() };
}

export function emptyDeptPlanBook(): DeptPlanBook {
  return { depts: [] };
}

function validateText(text: PlanBookText, who: string, anchor: string): Issue[] {
  const issues: Issue[] = [];
  const required: [keyof PlanBookText, string][] = [
    ['lastYear', '二 上年度总结概述'],
    ['environment', '三 环境分析'],
    ['risks', '七 风险评估与应对措施'],
  ];
  const missing = required.filter(([key]) => !filled(text?.[key]));
  if (missing.length) issues.push({ level: 'error', message: `${who}还缺：${missing.map(([, l]) => l).join('、')}`, anchor });
  if (!filled(text?.notDo)) issues.push({ level: 'warning', message: `${who}还没写“不做什么”的边界`, anchor });
  return issues;
}

export function validateCompanyPlanBook(book: CompanyPlanBook): Issue[] {
  return validateText(book.text ?? emptyPlanBookText(), '公司级计划书', 'text');
}

export function validateDeptPlanBook(book: DeptPlanBook): Issue[] {
  const depts = book.depts ?? [];
  if (depts.length === 0) return [{ level: 'error', message: '还没有部门计划书' }];
  return depts.flatMap((d) => validateText(d, `${d.deptName}计划书`, d.deptId));
}

/** Artifacts the company plan book embeds: they are confirmed and locked together with it. */
export const PLAN_BOOK_BUNDLE = ['S3-02', 'S3-05', 'S3-06'];
