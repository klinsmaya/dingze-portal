import {
  type DeptUndertakingTable,
  type GoalPathSystem,
  type KpiBreakdown,
  NODE_STATUS_LABELS,
  PLAN_BOOK_CHAPTERS,
  PRIORITY_FACTORS,
  type PlanBookText,
  type ProgressPlan,
  type ProjectCharter,
  type ProjectCharterSet,
  RESOURCE_CATEGORIES,
  type ResourceMatch,
  type ScorecardSet,
  type StrategyContent,
  type StrategyKpiTable,
  type StrategyMap,
  currentYearTargets,
  targetsOf,
  houseStarted,
  orderedPaths,
  priorityScore,
} from "@dingze/shared";

import { type SvgDiagram, sixfoldSvg, strategyHouseSvg, strategyMapSvg } from "./diagram-svg";

// A plan book as plain blocks: entered chapters come from the payload, same-source chapters
// are assembled from upstream tables. The workspace preview and the Word export share it,
// and nothing here invents numbers — every value is copied from a confirmed table.

export type Block =
  /** `entered`: the enterprise's own text, which the editor shows as an input rather than a preview. */
  | { kind: "text"; text: string; entered?: true }
  | { kind: "heading"; text: string; entered?: true }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "note"; text: string }
  | { kind: "figure"; caption: string; diagram: SvgDiagram };

export type Chapter = { no: string; title: string; source: "same" | "entered"; blocks: Block[] };

/** 版本与来源 page: which plan book version this is and which upstream versions it was built from. */
export type Provenance = { lines: string[]; sources: { specId: string; name: string; version: string }[] };

export type PlanBookModel = { title: string; subtitle: string; chapters: Chapter[]; provenance?: Provenance };

export type PlanBookUpstream = {
  "S1-01"?: StrategyContent;
  "S1-02"?: StrategyMap;
  "S1-06"?: StrategyKpiTable;
  "S1-07"?: KpiBreakdown;
  "S2-03"?: GoalPathSystem;
  "S2-05"?: DeptUndertakingTable;
  "S2-06"?: GoalPathSystem;
  "S2-07"?: ScorecardSet;
  "S3-02"?: ProjectCharterSet;
  "S3-05"?: ProgressPlan;
  "S3-06"?: ResourceMatch;
};

const text = (value: string | undefined, empty = "（待企业填写）"): Block => ({ kind: "text", text: value?.trim() ? value.trim() : empty, entered: true });

/** “80 万元” + “30 万元” → “110 万元”; null when any amount is missing or the units differ. */
export function sumAmounts(values: string[]): string | null {
  let total = 0;
  let unit: string | null = null;
  for (const v of values) {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*(\S*)\s*$/.exec(v ?? "");
    if (!m) return null;
    if (unit !== null && m[2] !== unit) return null;
    unit = m[2];
    total += Number(m[1]);
  }
  if (unit === null) return null;
  return `${Math.round(total * 100) / 100} ${unit}`.trim();
}

function gapLine(match: ResourceMatch | undefined, charters: ProjectCharter[]): string {
  const ids = new Set(charters.map((c) => c.id));
  const gaps = (match?.rows ?? []).filter((r) => r.charterId && ids.has(r.charterId) && !r.none && r.gap?.trim() && !/^0(\D|$)/.test(r.gap.trim()));
  if (gaps.length === 0) return match ? "资源匹配未列出缺口" : "资源匹配尚未完成";
  const major = gaps.filter((r) => r.major).length;
  return `资源缺口 ${gaps.length} 项${major ? `，其中重大缺口 ${major} 项` : ""}`;
}

function projectsLine(charters: ProjectCharter[]): string {
  if (charters.length === 0) return "还没有关键项目";
  const budget = sumAmounts(charters.map((c) => c.resources?.budget ?? ""));
  return `靠 ${charters.length} 个关键项目做成${budget ? `，项目预算合计 ${budget}` : ""}（${charters.map((c) => c.name).join("、")}）`;
}

/** 执行摘要 is same-source (spec 818): every sentence restates a locked table, nothing is entered. */
export function companySummary(u: PlanBookUpstream, year: number): string[] {
  const content = u["S1-01"];
  const targets = currentYearTargets(u["S1-07"], year);
  const goals = targetsOf(u["S2-03"])?.goals ?? [];
  const charters = u["S3-02"]?.charters ?? [];
  const lines: string[] = [];
  if (content?.mission?.trim()) lines.push(`使命：${content.mission.trim()}`);
  if (content?.vision?.trim()) lines.push(`愿景：${content.vision.trim()}`);
  lines.push(
    targets.length
      ? `${year} 年战略 KPI 目标 ${targets.length} 项：${targets.map((x) => `${x.name} ${`${x.value} ${x.unit}`.trim()}`).join("；")}`
      : `${year} 年战略 KPI 目标尚未定版`
  );
  const goalText = (g: (typeof goals)[number]) => {
    const name = g.task || g.metric;
    const value = `${g.value} ${g.unit}`.trim();
    return !value || name.replace(/\s/g, "").includes(value.replace(/\s/g, "")) ? name : `${name} ${value}`;
  };
  if (goals.length) lines.push(`公司级年度目标 ${goals.length} 项：${goals.map(goalText).join("；")}`);
  lines.push(projectsLine(charters));
  lines.push(gapLine(u["S3-06"], charters));
  return lines;
}

export function deptSummary(u: PlanBookUpstream, deptId: string): string[] {
  const rows = (u["S2-05"]?.rows ?? []).filter((r) => r.deptId === deptId);
  const charters = (u["S3-02"]?.charters ?? []).filter((c) => c.deptId === deptId);
  const card = (u["S2-07"]?.cards ?? []).find((c) => c.deptId === deptId);
  const lead = rows.filter((r) => r.role === "A").length;
  return [
    rows.length ? `承接公司目标 ${rows.length} 项（主责 ${lead} 项，协同 ${rows.length - lead} 项）` : "部门承接表里没有本部门的承接项",
    card?.items?.length ? `绩效计分卡 ${card.items.length} 项指标` : "绩效计分卡尚未建立",
    projectsLine(charters).replace("关键项目", "牵头项目"),
    gapLine(u["S3-06"], charters),
  ];
}

const summaryBlocks = (lines: string[], extra: string | undefined): Block[] => [
  { kind: "text", text: lines.join("\n") },
  ...(extra?.trim() ? [{ kind: "heading", text: "补充说明（企业录入，不改动定版数字）", entered: true } as Block, text(extra)] : []),
];

function chartersBlock(charters: ProjectCharter[]): Block {
  return {
    kind: "table",
    headers: ["项目编号", "项目名称", "战略关联", "优先级得分", "项目目标", "起止时间", "负责人"],
    rows: charters.map((c) => [
      c.code,
      c.name,
      c.theme,
      String(priorityScore(c.priority) ?? "—"),
      c.objective,
      [c.start, c.end].filter(Boolean).join(" ~ "),
      [c.deptName, c.owner].filter(Boolean).join(" · "),
    ]),
  };
}

function nodesBlock(plan: ProgressPlan | undefined, charters: ProjectCharter[]): Block | null {
  const ids = new Set(charters.map((c) => c.id));
  const rows = (plan?.rows ?? []).filter((r) => r.charterId && ids.has(r.charterId));
  if (rows.length === 0) return null;
  return {
    kind: "table",
    headers: ["项目", "时间", "节点", "成果", "验收标准", "责任人", "状态"],
    rows: rows.flatMap((r) =>
      (r.nodes ?? []).map((n) => [r.name, n.time, n.name, n.deliverable, n.acceptance, n.owner, NODE_STATUS_LABELS[n.status] ?? n.status])
    ),
  };
}

function resourcesBlock(match: ResourceMatch | undefined, charters: ProjectCharter[]): Block | null {
  const byId = new Map(charters.map((c) => [c.id, c]));
  const rows = (match?.rows ?? []).filter((r) => r.charterId && byId.has(r.charterId));
  if (rows.length === 0) return null;
  return {
    kind: "table",
    headers: ["项目", "类别", "需求", "存量", "缺口", "补齐方式", "责任人"],
    rows: rows.map((r) => [
      byId.get(r.charterId!)?.name ?? "",
      RESOURCE_CATEGORIES.find((c) => c.key === r.category)?.label.split("（")[0] ?? r.category,
      r.none ? "无" : r.need,
      r.none ? "" : r.stock,
      r.none ? "" : r.gap + (r.major ? "（重大）" : ""),
      r.approach,
      r.owner,
    ]),
  };
}

function charterAppendix(c: ProjectCharter): Block[] {
  return [
    { kind: "heading", text: `${c.code} ${c.name}` },
    {
      kind: "table",
      headers: ["项目", "内容"],
      rows: [
        ["战略关联 / 主题", c.theme],
        ["优先级", PRIORITY_FACTORS.map((f) => `${f.label} ${c.priority?.[f.key] ?? "—"}`).join("；") + `（加权 ${priorityScore(c.priority) ?? "—"}）`],
        ["项目目标", c.objective],
        ["起止时间", [c.start, c.end].filter(Boolean).join(" ~ ")],
        ["范围内", c.inScope],
        ["范围外", c.outOfScope],
        ["关键交付物", c.deliverables],
        ["关键节点", c.milestones],
        ["RACI", c.raci],
        ["资源与预算", `人力 FTE：${c.resources?.fte ?? ""}；财务预算：${c.resources?.budget ?? ""}；物力与支持：${c.resources?.material ?? ""}`],
        ["风险与应对", (c.risks ?? []).map((r) => `${r.risk}（触发：${r.trigger}；应对：${r.response}）`).join("\n")],
        ["关键假设", c.assumptions],
        ["验收标准", `结果：${c.acceptance?.result ?? ""}；过程：${c.acceptance?.process ?? ""}；关闭：${c.acceptance?.close ?? ""}`],
      ],
    },
    {
      kind: "table",
      headers: ["WBS 工作包", "交付物", "完成定义", "责任人"],
      rows: (c.wbs ?? []).map((w) => [`${"　".repeat(Math.max(0, w.level - 1))}${w.name}`, w.deliverable, w.doneDefinition, w.owner]),
    },
  ];
}

/** S3-02 on its own (spec: 表单 → Word, 验收 D08): the project list, then one section per charter with its WBS. */
export function buildCharterBook(params: { enterprise: string; year: number; charters: ProjectCharter[] }): PlanBookModel {
  const charters = params.charters ?? [];
  return {
    title: `${params.enterprise} ${params.year} 年度项目任务书`,
    subtitle: "S3-02 项目任务书（含 WBS）· 表 4-4",
    chapters: [
      { no: "一", title: "项目清单", source: "same", blocks: charters.length ? [chartersBlock(charters)] : [{ kind: "note", text: "还没有项目任务书" }] },
      ...charters.map((c, i) => ({ no: CHINESE_NUMBERS[i + 1] ?? String(i + 2), title: `${c.code} ${c.name}`, source: "same" as const, blocks: charterAppendix(c).slice(1) })),
    ],
  };
}

const CHINESE_NUMBERS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];

/** S3-07: the company plan book. */
/** 六分法 (and the strategy house when it was filled in) and the strategy map. */
function strategyFigures(u: PlanBookUpstream): Block[] {
  const figures: { caption: string; diagram: SvgDiagram }[] = [];
  const content = u["S1-01"];
  if (content) {
    figures.push({ caption: "战略简约六分法表（S1-01）", diagram: sixfoldSvg(content) });
    if (houseStarted(content)) figures.push({ caption: "战略屋（S1-01）", diagram: strategyHouseSvg(content) });
  }
  if (u["S1-02"]?.objectives?.length) figures.push({ caption: "战略地图（S1-02）", diagram: strategyMapSvg(u["S1-02"]) });
  return figures.map((f, i) => ({ kind: "figure", caption: `图 1-${i + 1} ${f.caption}`, diagram: f.diagram }));
}

export function buildCompanyPlanBook(params: {
  enterprise: string;
  year: number;
  text: PlanBookText;
  upstream: PlanBookUpstream;
}): PlanBookModel {
  const { text: t, upstream: u, year } = params;
  const charters = u["S3-02"]?.charters ?? [];
  const goals = targetsOf(u["S2-03"])?.goals ?? [];
  const paths = orderedPaths(u["S2-03"]?.nodes ?? [], goals.map((g) => g.id));
  const targets = currentYearTargets(u["S1-07"], year);

  const chapter4: Block[] = [
    { kind: "heading", text: "4.1 战略 KPI 本年度目标（S1-07）" },
    targets.length
      ? { kind: "table", headers: ["战略主题", "战略 KPI", "本年度目标"], rows: targets.map((x) => [x.theme, x.name, `${x.value} ${x.unit}`.trim()]) }
      : { kind: "note", text: "S1-07 没有本年度目标值" },
    { kind: "heading", text: "4.2 公司级年度目标与路径（S2-03）" },
    {
      kind: "table",
      headers: ["年度目标", "路径", "衡量指标", "指标值"],
      rows: [
        ...goals.map((g) => [g.task || g.metric, "（目标）", g.metric, `${g.value} ${g.unit}`.trim()]),
        ...paths.filter((n) => n.level <= 2).map((n) => [goals.find((g) => g.id === n.goalId)?.task ?? "", `${"　".repeat(n.level - 1)}${n.path}`, n.metric, n.value]),
      ],
    },
    { kind: "heading", text: "4.3 部门承接（S2-05）" },
    {
      kind: "table",
      headers: ["部门", "角色", "任务", "衡量指标", "指标值"],
      rows: (u["S2-05"]?.rows ?? []).map((r) => [r.deptName, r.role, r.task, r.metric, r.value]),
    },
    { kind: "heading", text: "4.4 部门绩效计分卡（S2-07）" },
    {
      kind: "table",
      headers: ["部门", "关键任务", "衡量指标", "保底值", "力争值", "权重"],
      rows: (u["S2-07"]?.cards ?? []).flatMap((c) => c.items.map((i) => [c.deptName, i.task, i.metric, i.floor, i.target, String(i.weight ?? "")])),
    },
  ];
  const nodes = nodesBlock(u["S3-05"], charters);
  const resources = resourcesBlock(u["S3-06"], charters);
  const chapters: Chapter[] = PLAN_BOOK_CHAPTERS.map((c) => ({ no: c.no, title: c.company, source: c.source, blocks: [] }));
  chapters[0].blocks = [
    { kind: "heading", text: "1.1 总体战略目标与愿景承接" },
    ...summaryBlocks(companySummary(u, year), t.summary),
    ...strategyFigures(u),
    { kind: "heading", text: "1.2 本年度关键 KPI" },
    targets.length
      ? { kind: "table", headers: ["战略主题", "战略 KPI", "本年度目标"], rows: targets.map((x) => [x.theme, x.name, `${x.value} ${x.unit}`.trim()]) }
      : { kind: "note", text: "S1-07 没有本年度目标值" },
    { kind: "heading", text: "1.3 本年度关键项目清单及关键节点" },
    charters.length
      ? { kind: "table", headers: ["项目编号", "项目名称", "项目目标", "起止时间", "关键节点", "负责人"], rows: charters.map((c) => [c.code, c.name, c.objective, [c.start, c.end].filter(Boolean).join(" ~ "), c.milestones, c.owner]) }
      : { kind: "note", text: "S3-02 还没有项目任务书" },
  ];
  chapters[1].blocks = [text(t.lastYear)];
  chapters[2].blocks = [text(t.environment)];
  chapters[3].blocks = chapter4;
  chapters[4].blocks = [chartersBlock(charters), ...(nodes ? [{ kind: "heading", text: "关键节点" } as Block, nodes] : [])];
  chapters[5].blocks = resources ? [resources] : [{ kind: "note", text: "S3-06 还没有资源匹配结果" }];
  chapters[6].blocks = [text(t.risks), { kind: "heading", text: "不做什么" }, text(t.notDo, "（未填写）")];
  chapters[7].blocks = [
    { kind: "heading", text: "8.1 项目任务书合集" },
    ...charters.flatMap(charterAppendix),
    { kind: "heading", text: "8.2 计划实施推进表合集" },
    ...(nodes ? [nodes] : [{ kind: "note", text: "（无）" } as Block]),
    { kind: "heading", text: "8.3 指标字典" },
    {
      kind: "table",
      headers: ["战略 KPI", "口径", "单位", "数据来源", "周期", "责任部门"],
      rows: (u["S1-06"]?.kpis ?? []).map((k) => [k.name, k.definition, k.unit, k.source, k.period, k.owner]),
    },
    ...(t.dictionaryNote?.trim() ? [text(t.dictionaryNote)] : []),
  ];
  return { title: `${params.enterprise} ${year} 年度经营计划书`, subtitle: "公司级 · 报告对象：董事会 / 经营层", chapters };
}

/** S3-08: one department's plan book, filtered to what that department undertakes. */
export function buildDeptPlanBook(params: {
  enterprise: string;
  year: number;
  dept: { deptId: string; deptName: string };
  text: PlanBookText;
  upstream: PlanBookUpstream;
}): PlanBookModel {
  const { text: t, upstream: u, dept } = params;
  const undertakings = (u["S2-05"]?.rows ?? []).filter((r) => r.deptId === dept.deptId);
  const ids = new Set(undertakings.map((r) => r.id));
  const deptPaths = (u["S2-06"]?.nodes ?? []).filter((n) => n.level === 1 && n.goalId && ids.has(n.goalId));
  const card = (u["S2-07"]?.cards ?? []).find((c) => c.deptId === dept.deptId);
  const charters = (u["S3-02"]?.charters ?? []).filter((c) => c.deptId === dept.deptId);
  const nodes = nodesBlock(u["S3-05"], charters);
  const resources = resourcesBlock(u["S3-06"], charters);
  const chapters: Chapter[] = PLAN_BOOK_CHAPTERS.map((c) => ({ no: c.no, title: c.dept, source: c.source, blocks: [] }));
  chapters[0].blocks = [
    { kind: "heading", text: "1.1 部门年度目标（承接公司）" },
    ...summaryBlocks(deptSummary(u, dept.deptId), t.summary),
    undertakings.length
      ? { kind: "table", headers: ["角色", "任务", "衡量指标", "指标值"], rows: undertakings.map((r) => [r.role, r.task, r.metric, r.value]) }
      : { kind: "note", text: "S2-05 里没有本部门的承接项" },
    { kind: "heading", text: "1.2 部门关键项目" },
    charters.length
      ? { kind: "table", headers: ["项目编号", "项目名称", "项目目标", "起止时间", "负责人"], rows: charters.map((c) => [c.code, c.name, c.objective, [c.start, c.end].filter(Boolean).join(" ~ "), c.owner]) }
      : { kind: "note", text: "本部门没有牵头的项目" },
  ];
  chapters[1].blocks = [text(t.lastYear)];
  chapters[2].blocks = [text(t.environment)];
  chapters[3].blocks = [
    { kind: "heading", text: "4.1 部门承接目标（S2-05）" },
    { kind: "table", headers: ["角色", "目的", "任务", "衡量指标", "指标值"], rows: undertakings.map((r) => [r.role, r.purpose, r.task, r.metric, r.value]) },
    { kind: "heading", text: "4.2 部门一级路径（S2-06）" },
    { kind: "table", headers: ["路径", "衡量指标", "指标值"], rows: deptPaths.map((n) => [n.path, n.metric, n.value]) },
    { kind: "heading", text: "4.3 绩效计分卡（S2-07）" },
    {
      kind: "table",
      headers: ["关键任务", "衡量指标", "保底值", "力争值", "权重"],
      rows: (card?.items ?? []).map((i) => [i.task, i.metric, i.floor, i.target, String(i.weight ?? "")]),
    },
  ];
  chapters[4].blocks = charters.length ? [chartersBlock(charters), ...(nodes ? [nodes] : [])] : [{ kind: "note", text: "本部门没有牵头的项目" }];
  chapters[5].blocks = resources ? [resources] : [{ kind: "note", text: "本部门牵头项目没有资源匹配结果" }];
  chapters[6].blocks = [text(t.risks), { kind: "heading", text: "三不做清单" }, text(t.notDo, "（未填写）")];
  chapters[7].blocks = [
    { kind: "heading", text: "8.1 部门项目任务书合集" },
    ...charters.flatMap(charterAppendix),
    { kind: "heading", text: "8.2 部门计划实施推进表合集" },
    ...(nodes ? [nodes] : [{ kind: "note", text: "（无）" } as Block]),
  ];
  return { title: `${params.enterprise} ${dept.deptName} ${params.year} 年度经营计划书`, subtitle: "部门级", chapters };
}

/** The entered chapters of one department entry (without its identity fields). */
export function deptText(d: PlanBookText): PlanBookText {
  return { summary: d.summary, lastYear: d.lastYear, environment: d.environment, risks: d.risks, notDo: d.notDo, dictionaryNote: d.dictionaryNote };
}
