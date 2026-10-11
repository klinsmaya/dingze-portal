import {
  CLASS_LABELS,
  NODE_STATUS_LABELS,
  PRIORITY_FACTORS,
  RESOURCE_CATEGORIES,
  SCREEN_QUESTIONS,
  type ProgressPlan,
  type ProjectCharterSet,
  type ResourceMatch,
  classify,
  priorityScore,
  timeColumns,
  timeIndex,
  DECODE_CATEGORIES,
  type DecodeMap,
  type DeptUndertakingTable,
  type GoalPathSystem,
  type GoalTargets,
  type KeyProjectList,
  type PathNode,
  type RaciTable,
  type ScorecardSet,
  cardWeight,
  orderedPaths,
  IPOOC_STAGES,
  PERSPECTIVES,
  SCREEN_DIMENSIONS,
  SIXFOLD_FIELDS,
  houseStarted,
  SMART_CHECKS,
  candidateTotal,
  type IpoocDesign,
  type KpiBreakdown,
  type KpiScreening,
  type MissionWorksheet,
  type StrategyContent,
  type StrategyKpiTable,
  type StrategyLogic,
  type StrategyMap,
  type VisionWorksheet,
} from "@dingze/shared";

// Artifact payloads as plain sheet models (header, rows, merged ranges), so the table
// layout follows the book and can be tested without generating a file.

export type Cell = string | number | null;

export type SheetModel = {
  name: string;
  columns: { header: string; width: number }[];
  rows: Cell[][];
  /** Merged ranges in body coordinates: [firstRow, firstCol, lastRow, lastCol], 0-based. */
  merges: [number, number, number, number][];
  /** Rows that act as section titles inside the sheet (bold, merged across). */
  sectionRows?: number[];
};

const sheet = (name: string, columns: [string, number][], rows: Cell[][] = []): SheetModel => ({
  name,
  columns: columns.map(([header, width]) => ({ header, width })),
  rows,
  merges: [],
});

function strategyContentSheets(c: StrategyContent): SheetModel[] {
  const house = sheet("战略屋", [
    ["项目", 16],
    ["内容", 60],
  ]);
  house.rows.push(["使命", c.mission], ["愿景", c.vision], ["价值观", c.values]);
  house.rows.push(["一年目标", c.goals?.y1 ?? ""], ["三年目标", c.goals?.y3 ?? ""], ["五年目标", c.goals?.y5 ?? ""]);
  (c.battlefields ?? []).forEach((b, i) => {
    house.rows.push([`主要战场 ${i + 1}`, b.name], [`如何致胜 ${i + 1}`, b.advantage], [`必赢之战 ${i + 1}`, b.mustWin]);
  });
  house.rows.push(
    ["落地保障 · 组织", c.foundation?.organization ?? ""],
    ["落地保障 · 机制", c.foundation?.mechanism ?? ""],
    ["落地保障 · 人才", c.foundation?.talent ?? ""]
  );
  const sixfold = sheet("战略简约六分法", [
    ["方面", 18],
    ["内容", 60],
  ]);
  for (const f of SIXFOLD_FIELDS) sixfold.rows.push([f.label, String(c[f.key] ?? "")]);
  // 六分法 is the required table; the house (P1) is exported only when it has content.
  return houseStarted(c) ? [sixfold, house] : [sixfold];
}

function strategyMapSheets(map: StrategyMap): SheetModel[] {
  const objectives = sheet("战略目标", [
    ["层面", 14],
    ["战略目标", 36],
    ["说明", 40],
  ]);
  for (const p of PERSPECTIVES) {
    const items = (map.objectives ?? []).filter((o) => o.perspective === p.key);
    if (items.length === 0) continue;
    const start = objectives.rows.length;
    items.forEach((o) => objectives.rows.push([p.label, o.title, o.note]));
    if (items.length > 1) objectives.merges.push([start, 0, start + items.length - 1, 0]);
  }
  const byId = new Map((map.objectives ?? []).map((o) => [o.id, o.title]));
  const links = sheet("因果与协同", [
    ["起点目标", 32],
    ["关系", 14],
    ["终点目标", 32],
  ]);
  for (const l of map.links ?? []) {
    links.rows.push([byId.get(l.from) ?? "", l.kind === "cause" ? "支撑（因果）" : "协同", byId.get(l.to) ?? ""]);
  }
  return [objectives, links];
}

function strategyLogicSheets(logic: StrategyLogic, upstream?: StrategyContent): SheetModel[] {
  const s = sheet("战略策略逻辑表", [
    ["战略（做不做 / 做什么）", 36],
    ["策略（动词＋宾语）", 40],
    ["路径（可选）", 24],
  ]);
  if (upstream) {
    s.rows.push([`使命：${upstream.mission ?? ""}`, null, null], [`愿景：${upstream.vision ?? ""}`, null, null]);
    s.merges.push([0, 0, 0, 2], [1, 0, 1, 2]);
  }
  for (const line of logic.strategies ?? []) {
    const tactics = line.tactics?.length ? line.tactics : [{ id: "", text: "", path: "" }];
    const start = s.rows.length;
    tactics.forEach((t) => s.rows.push([line.statement, t.text, t.path]));
    if (tactics.length > 1) s.merges.push([start, 0, start + tactics.length - 1, 0]);
  }
  if (logic.levelNote) {
    s.rows.push([`层级相对性说明：${logic.levelNote}`, null, null]);
    s.merges.push([s.rows.length - 1, 0, s.rows.length - 1, 2]);
  }
  return [s];
}

function ipoocSheets(design: IpoocDesign): SheetModel[] {
  const s = sheet("IPOOC 指标设计", [
    ["IPOOC 环节", 12],
    ["关键要素拆解", 30],
    ["指标名", 20],
    ["计算公式", 24],
    ["目标值", 12],
    ["数据来源", 14],
    ["考核频率", 10],
  ]);
  s.sectionRows = [];
  for (const item of design.sheets ?? []) {
    s.sectionRows.push(s.rows.length);
    s.merges.push([s.rows.length, 0, s.rows.length, 6]);
    s.rows.push([`关键策略：${item.strategy} · 时间周期：${item.period} · 责任部门：${item.ownerDept}`, null, null, null, null, null, null]);
    for (const stage of IPOOC_STAGES) {
      const r = item.rows?.[stage.key];
      s.rows.push([stage.label, r?.elements ?? "", r?.indicator ?? "", r?.formula ?? "", r?.target ?? "", r?.source ?? "", r?.frequency ?? ""]);
    }
    const smart = SMART_CHECKS.map((c) => `${c.label}${item.smart?.[c.key] ? "✔" : "✘"}`).join("  ");
    s.merges.push([s.rows.length, 0, s.rows.length, 6]);
    s.rows.push([`SMART 验证：${smart}`, null, null, null, null, null, null]);
  }
  return [s];
}

function screeningSheets(screening: KpiScreening): SheetModel[] {
  const s = sheet("KPI 筛选评价", [
    ["候选指标", 24],
    ["来源", 24],
    ...SCREEN_DIMENSIONS.map((d) => [d.label, 11] as [string, number]),
    ["合计", 8],
    ["结论", 8],
    ["理由", 30],
  ]);
  for (const c of screening.candidates ?? []) {
    s.rows.push([
      c.name,
      c.origin,
      ...SCREEN_DIMENSIONS.map((d) => c.scores?.[d.key] ?? null),
      candidateTotal(c),
      c.keep === true ? "保留" : c.keep === false ? "剔除" : "未决",
      c.reason,
    ]);
  }
  return [s];
}

function strategyKpiSheets(table: StrategyKpiTable): SheetModel[] {
  const s = sheet("战略 KPI", [
    ["战略主题 / 要点", 22],
    ["战略 KPI", 20],
    ["口径 / 计算公式", 36],
    ["单位", 8],
    ["数据来源", 16],
    ["统计周期", 10],
    ["责任部门", 14],
  ]);
  for (const k of table.kpis ?? []) s.rows.push([k.theme, k.name, k.definition, k.unit, k.source, k.period, k.owner]);
  return [s];
}

/** Numbers stay numbers in Excel; anything else (“待补”, “≥95%”) stays text. */
function cellValue(v: string | undefined): Cell {
  const text = (v ?? "").trim();
  return text !== "" && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}

function breakdownSheets(b: KpiBreakdown): SheetModel[] {
  const years = b.years ?? [];
  const s = sheet("年度分解", [
    ["战略主题 / 要点", 22],
    ["战略 KPI", 20],
    ["单位", 8],
    ...years.map((y) => [`${y} 年`, 10] as [string, number]),
    ["基准值", 10],
    ["标杆值", 10],
    ["挑战值", 10],
  ]);
  for (const r of b.rows ?? []) {
    s.rows.push([
      r.theme,
      r.name,
      r.unit,
      ...years.map((y) => cellValue(r.values?.[String(y)])),
      cellValue(r.baseline),
      cellValue(r.benchmark),
      cellValue(r.challenge),
    ]);
  }
  return [s];
}

function missionSheets(m: MissionWorksheet): SheetModel[] {
  const s = sheet("使命五要素", [
    ["", 14],
    ["是谁？", 28],
    ["痛点与核心需求", 32],
    ["事业的哲学意义", 36],
  ]);
  s.rows.push(
    ["核心用户", m.coreUser?.who ?? "", m.coreUser?.need ?? "", m.philosophy],
    ["核心客户", m.coreCustomer?.who ?? "", m.coreCustomer?.need ?? "", null],
    ["独特差异化", m.differentiation, "—", null],
    ["核心竞争优势", m.advantage, "—", null],
    [`合成使命句：${m.statement}`, null, null, null]
  );
  s.merges.push([0, 3, 3, 3], [4, 0, 4, 3]);
  return [s];
}

function visionSheets(v: VisionWorksheet): SheetModel[] {
  const s = sheet("愿景三法", [
    ["方法", 18],
    ["内容", 60],
  ]);
  s.rows.push(
    ["战略推导法", v.derivation],
    ["对标一流 · 选标", v.benchmark?.select ?? ""],
    ["对标一流 · 对标", v.benchmark?.compare ?? ""],
    ["对标一流 · 定标", v.benchmark?.set ?? ""],
    ["引以为傲法", v.pride],
    ["时间跨度", v.horizon],
    ["愿景句", v.statement]
  );
  return [s];
}

const PERSPECTIVE_LABEL: Record<string, string> = Object.fromEntries(PERSPECTIVES.map((p) => [p.key, p.label]));

function goalTargetsSheets(t: GoalTargets): SheetModel[] {
  const s = sheet(`${t.year} 年度目标`, [
    ["层面", 10],
    ["目的", 30],
    ["任务", 26],
    ["衡量指标", 18],
    ["指标值", 14],
    ["单位", 8],
  ]);
  for (const g of t.goals ?? []) s.rows.push([PERSPECTIVE_LABEL[g.perspective] ?? "", g.purpose, g.task, g.metric, cellValue(g.value), g.unit]);
  if (t.strategyReview || t.lastPeriodIssues) {
    s.rows.push([`往上看：${t.strategyReview}`, null, null, null, null, null], [`往回看：${t.lastPeriodIssues}`, null, null, null, null, null]);
    s.merges.push([s.rows.length - 2, 0, s.rows.length - 2, 5], [s.rows.length - 1, 0, s.rows.length - 1, 5]);
  }
  return [s];
}

function decodeMapSheets(map: DecodeMap): SheetModel[] {
  const s = sheet("解码地图", [
    ["层面", 12],
    ["类别", 16],
    ["战略主题", 28],
    ["衡量指标", 18],
    ["指标值", 14],
    ["支撑", 28],
  ]);
  const gap = map.valueGap ?? { target: "", baseline: "", gap: "" };
  s.rows.push([`股东价值差距：目标 ${gap.target}；现状 ${gap.baseline}；差距 ${gap.gap}`, null, null, null, null, null]);
  s.merges.push([0, 0, 0, 5]);
  const byId = new Map((map.themes ?? []).map((t) => [t.id, t.title]));
  for (const p of PERSPECTIVES) {
    const items = (map.themes ?? []).filter((t) => t.perspective === p.key);
    if (!items.length) continue;
    const start = s.rows.length;
    for (const t of items) {
      const category = DECODE_CATEGORIES[p.key].find((c) => c.key === t.category)?.label ?? "";
      s.rows.push([p.label, category, t.title, t.metric, cellValue(t.value), (t.supports ?? []).map((id) => byId.get(id) ?? "").join("、")]);
    }
    if (items.length > 1) s.merges.push([start, 0, start + items.length - 1, 0]);
  }
  return [s];
}

type TreeGoal = { id: string; cells: Cell[] };

/**
 * One row per leaf path; each goal and path cell spans the rows of its leaves, as in
 * 表 3-9. `lead` columns (goal, or perspective for 表 3-10) come first.
 */
function pathTreeSheet(name: string, lead: [string, number][], goals: TreeGoal[], nodes: PathNode[], groupBy?: (n: PathNode) => string): SheetModel {
  const levels = Math.max(1, ...nodes.map((n) => n.level));
  const columns: [string, number][] = [...lead];
  for (let l = 1; l <= levels; l++) columns.push([`${"一二三四"[l - 1]}级路径`, 24], ["衡量指标", 14], ["指标值", 12]);
  const s = sheet(name, columns);
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);
  const leafCount = (n: PathNode): number => {
    const kids = childrenOf(n.id);
    return kids.length ? kids.reduce((sum, k) => sum + leafCount(k), 0) : 1;
  };
  const width = columns.length;
  const emit = (n: PathNode, prefix: Cell[]) => {
    const col = lead.length + (n.level - 1) * 3;
    const start = s.rows.length;
    const span = leafCount(n);
    const kids = childrenOf(n.id);
    const own: Cell[] = [n.path, n.metric, cellValue(n.value)];
    if (kids.length === 0) {
      const row: Cell[] = Array.from({ length: width }, () => null);
      prefix.forEach((v, i) => (row[i] = v));
      own.forEach((v, i) => (row[col + i] = v));
      s.rows.push(row);
    } else {
      kids.forEach((k, i) => emit(k, i === 0 ? [...prefix.slice(0, col), ...own] : Array.from({ length: col + 3 }, () => null)));
      const first = s.rows[start];
      own.forEach((v, i) => (first[col + i] = v));
    }
    if (span > 1) for (let i = 0; i < 3; i++) s.merges.push([start, col + i, start + span - 1, col + i]);
  };
  for (const goal of goals) {
    const roots = nodes.filter((n) => n.level === 1 && n.parentId === null && (n as PathNode & { goalId?: string | null }).goalId === goal.id);
    const groups = groupBy ? [...new Set(roots.map(groupBy))] : [""];
    for (const group of groups) {
      const groupRoots = groupBy ? roots.filter((r) => groupBy(r) === group) : roots;
      const start = s.rows.length;
      const leadCells = groupBy ? [group] : goal.cells;
      if (groupRoots.length === 0) {
        s.rows.push([...leadCells, ...Array.from({ length: width - lead.length }, () => null)]);
        continue;
      }
      groupRoots.forEach((r) => emit(r, Array.from({ length: lead.length }, () => null)));
      leadCells.forEach((v, i) => (s.rows[start][i] = v));
      const span = s.rows.length - start;
      if (span > 1) for (let i = 0; i < lead.length; i++) s.merges.push([start, i, start + span - 1, i]);
    }
  }
  return s;
}

function pathSystemSheets(system: GoalPathSystem, goals: { id: string; label: string; target: string }[], decodeLayout: boolean): SheetModel[] {
  const nodes = orderedPaths(system.nodes ?? [], goals.map((g) => g.id));
  const treeGoals = goals.map((g) => ({ id: g.id, cells: [g.label, g.target] as Cell[] }));
  const sheets = [pathTreeSheet("路径系统（表3-9）", [["目标", 24], ["目标值", 14]], treeGoals, nodes)];
  if (decodeLayout) {
    sheets.push(
      pathTreeSheet("解码地图导入（表3-10）", [["层面", 12]], treeGoals, nodes, (n) => PERSPECTIVE_LABEL[n.perspective ?? ""] ?? "未分层面")
    );
  }
  return sheets;
}

function keyProjectSheets(list: KeyProjectList): SheetModel[] {
  const s = sheet("关键项目列表", [
    ["项目编号", 10],
    ["项目名称", 26],
    ["战略关联 / 主题", 20],
    ["项目目标", 30],
    ["起止时间", 18],
    ["关键节点", 30],
    ["责任人", 12],
  ]);
  for (const p of list.projects ?? []) s.rows.push([p.code, p.name, p.theme, p.objective, [p.start, p.end].filter(Boolean).join(" ~ "), p.milestones, p.owner]);
  return [s];
}

function raciSheets(table: RaciTable): SheetModel[] {
  const columns = table.columns ?? [];
  const s = sheet("RACI", [["关键项目 / 路径", 30], ...columns.map((c) => [c.name, 12] as [string, number])]);
  for (const row of table.rows ?? []) s.rows.push([row.name, ...columns.map((c) => (row.cells?.[c.id] ?? []).join("/"))]);
  s.rows.push(["R 执行者　A 最终负责者　C 咨询 / 协同　I 知情", ...columns.map(() => null)]);
  s.merges.push([s.rows.length - 1, 0, s.rows.length - 1, Math.max(columns.length, 1)]);
  return [s];
}

function undertakingSheets(table: DeptUndertakingTable): SheetModel[] {
  const s = sheet("部门目标承接", [
    ["部门", 16],
    ["角色", 6],
    ["目的", 30],
    ["任务", 26],
    ["衡量指标", 16],
    ["指标值", 14],
  ]);
  const rows = [...(table.rows ?? [])].sort((a, b) => a.deptName.localeCompare(b.deptName, "zh-CN"));
  let start = 0;
  rows.forEach((r, i) => {
    s.rows.push([r.deptName, r.role, r.purpose, r.task, r.metric, cellValue(r.value)]);
    const last = i === rows.length - 1 || rows[i + 1].deptName !== r.deptName;
    if (last) {
      if (i > start) s.merges.push([start, 0, i, 0]);
      start = i + 1;
    }
  });
  return [s];
}

function scorecardSheets(set: ScorecardSet): SheetModel[] {
  return (set.cards ?? []).map((card) => {
    const s = sheet(`计分卡-${card.deptName}`, [
      ["关键任务", 24],
      ["衡量指标", 16],
      ["指标定义", 28],
      ["保底值", 10],
      ["力争值", 10],
      ["权重", 8],
      ["评分方法", 24],
      ["数据来源", 14],
    ]);
    for (const i of card.items ?? []) s.rows.push([i.task, i.metric, i.definition, cellValue(i.floor), cellValue(i.target), i.weight, i.scoring, i.source]);
    s.rows.push(["权重合计", null, null, null, null, cardWeight(card), null, null]);
    return s;
  });
}

const yesNo = (v: boolean | null | undefined): Cell => (v === true ? "是" : v === false ? "否" : null);

function charterSheets(set: ProjectCharterSet): SheetModel[] {
  const screening = sheet("项目甄别", [
    ["候选项目 / 路径", 28],
    ["成果导向命名", 28],
    ...SCREEN_QUESTIONS.map((q) => [q.label, 16] as [string, number]),
    ["甄别结果", 16],
  ]);
  for (const item of set.screening ?? []) {
    const cls = classify(item.answers);
    screening.rows.push([item.name, item.renamed, ...SCREEN_QUESTIONS.map((q) => yesNo(item.answers?.[q.key])), cls ? CLASS_LABELS[cls] : null]);
  }
  const charters = set.charters ?? [];
  const list = sheet("项目任务书", [
    ["项目编号", 14],
    ["项目名称", 24],
    ["战略关联", 18],
    ...PRIORITY_FACTORS.map((f) => [`${f.label}（${f.weight * 100}%）`, 10] as [string, number]),
    ["优先级得分", 10],
    ["项目目标", 30],
    ["起止时间", 18],
    ["范围（做）", 24],
    ["范围（不做）", 24],
    ["交付物", 24],
    ["里程碑", 24],
    ["牵头部门", 12],
    ["负责人", 10],
    ["RACI", 20],
    ["人力 FTE", 10],
    ["预算", 10],
    ["物料", 14],
    ["风险与应对", 30],
    ["假设与约束", 20],
    ["结果验收", 20],
    ["过程验收", 20],
    ["结项", 20],
  ]);
  for (const c of charters) {
    list.rows.push([
      c.code,
      c.name,
      c.theme,
      ...PRIORITY_FACTORS.map((f) => c.priority?.[f.key] ?? null),
      priorityScore(c.priority),
      c.objective,
      [c.start, c.end].filter(Boolean).join(" ~ "),
      c.inScope,
      c.outOfScope,
      c.deliverables,
      c.milestones,
      c.deptName,
      c.owner,
      c.raci,
      c.resources?.fte,
      c.resources?.budget,
      c.resources?.material,
      (c.risks ?? []).map((r) => `${r.risk}（触发：${r.trigger}；应对：${r.response}）`).join("\n"),
      c.assumptions,
      c.acceptance?.result,
      c.acceptance?.process,
      c.acceptance?.close,
    ]);
  }
  const wbs = sheet("WBS", [
    ["项目编号", 14],
    ["项目名称", 22],
    ["WBS 编码", 10],
    ["工作包", 26],
    ["交付物", 24],
    ["完成定义", 26],
    ["责任人", 10],
    ["前置工作包", 18],
  ]);
  for (const c of charters) {
    const items = c.wbs ?? [];
    const numbers = new Map<string, string>();
    const walk = (parentId: string | null, prefix: string) =>
      items
        .filter((w) => (w.parentId ?? null) === parentId)
        .forEach((w, i) => {
          const no = prefix ? `${prefix}.${i + 1}` : String(i + 1);
          numbers.set(w.id, no);
          wbs.rows.push([c.code, c.name, no, w.name, w.deliverable, w.doneDefinition, w.owner, ""]);
          walk(w.id, no);
        });
    const start = wbs.rows.length;
    walk(null, "");
    for (let r = start; r < wbs.rows.length; r++) {
      const w = items.find((x) => numbers.get(x.id) === wbs.rows[r][2]);
      wbs.rows[r][7] = (w?.dependsOn ?? []).map((d) => numbers.get(d) ?? "").filter(Boolean).join("、");
    }
  }
  return [screening, list, wbs];
}

/** 表 4-5 节点表 (one row per node) and 表 4-6 推进表 (成果 / 验收标准 per month or quarter). */
function progressPlanSheets(plan: ProgressPlan): SheetModel[] {
  const nodesSheet = sheet("节点表（表4-5）", [
    ["项目", 24],
    ["项目阶段", 10],
    ["节点名称", 22],
    ["完成时间", 10],
    ["节点成果", 28],
    ["验收标准", 28],
    ["责任人", 10],
    ["状态", 8],
    ["前置节点", 22],
  ]);
  const names = new Map((plan.rows ?? []).flatMap((r) => (r.nodes ?? []).map((n) => [n.id, n.name] as const)));
  for (const row of plan.rows ?? []) {
    const start = nodesSheet.rows.length;
    for (const n of row.nodes ?? [])
      nodesSheet.rows.push([row.name, n.phase ?? "", n.name, n.time, n.deliverable, n.acceptance, n.owner, NODE_STATUS_LABELS[n.status] ?? n.status, (n.dependsOn ?? []).map((d) => names.get(d) ?? "").filter(Boolean).join("、")]);
    if (nodesSheet.rows.length - start > 1) nodesSheet.merges.push([start, 0, nodesSheet.rows.length - 1, 0]);
  }

  const times = (plan.rows ?? []).flatMap((r) => (r.nodes ?? []).map((n) => n.time)).filter((t) => timeIndex(t) !== null);
  const year = times.length ? Math.min(...times.map((t) => Number(t.slice(0, 4)))) : new Date().getFullYear();
  const columns = timeColumns(plan.scale ?? "month", year);
  const label = (c: string) => (plan.scale === "quarter" ? c.slice(5) : `${Number(c.slice(5))} 月`);
  const progress = sheet("计划实施推进表（表4-6）", [
    ["项目", 24],
    ["责任人", 10],
    ...columns.flatMap((c) => [[`${label(c)}成果`, 16] as [string, number], [`${label(c)}验收标准`, 16] as [string, number]]),
  ]);
  for (const row of plan.rows ?? []) {
    const cells: Cell[] = [row.name, [...new Set((row.nodes ?? []).map((n) => n.owner).filter(Boolean))].join("、")];
    for (const c of columns) {
      const here = (row.nodes ?? []).filter((n) => timeIndex(n.time) === timeIndex(c));
      cells.push(here.map((n) => `${n.name}：${n.deliverable}`).join("\n") || null, here.map((n) => n.acceptance).join("\n") || null);
    }
    progress.rows.push(cells);
  }
  return [nodesSheet, progress];
}

function resourceSheets(match: ResourceMatch, charters?: ProjectCharterSet): SheetModel[] {
  const s = sheet("项目资源匹配表", [
    ["项目", 24],
    ["类别", 16],
    ["需求", 24],
    ["存量", 20],
    ["缺口", 18],
    ["补齐方式", 26],
    ["责任人", 10],
    ["重大缺口", 8],
  ]);
  const label = new Map(RESOURCE_CATEGORIES.map((c) => [c.key, c.label]));
  const projectName = (id: string | null) => {
    const c = (charters?.charters ?? []).find((x) => x.id === id);
    return c ? `${c.code} ${c.name}` : "未关联项目";
  };
  for (const r of match.rows ?? [])
    s.rows.push(r.none ? [projectName(r.charterId), label.get(r.category) ?? r.category, "无", null, null, null, null, null] : [projectName(r.charterId), label.get(r.category) ?? r.category, r.need, r.stock, r.gap, r.approach, r.owner, r.major ? "是" : null]);
  return [s];
}

/** The sheets an artifact exports to; empty for artifacts without an export yet. */
export function artifactSheets(code: string, payload: unknown, upstream: Record<string, unknown> = {}): SheetModel[] {
  if (!payload || typeof payload !== "object") return [];
  switch (code) {
    case "S1-01":
      return strategyContentSheets(payload as StrategyContent);
    case "S1-02":
      return strategyMapSheets(payload as StrategyMap);
    case "S1-03":
      return strategyLogicSheets(payload as StrategyLogic, upstream["S1-01"] as StrategyContent | undefined);
    case "S1-04":
      return ipoocSheets(payload as IpoocDesign);
    case "S1-05":
      return screeningSheets(payload as KpiScreening);
    case "S1-06":
      return strategyKpiSheets(payload as StrategyKpiTable);
    case "S1-07":
      return breakdownSheets(payload as KpiBreakdown);
    case "M-MISSION":
      return missionSheets(payload as MissionWorksheet);
    case "M-VISION":
      return visionSheets(payload as VisionWorksheet);
    case "S2-03-T":
      return goalTargetsSheets(payload as GoalTargets);
    case "S2-01":
      return decodeMapSheets(payload as DecodeMap);
    case "S2-03": {
      const goals = ((upstream["S2-03-T"] as GoalTargets | undefined)?.goals ?? []).map((g) => ({
        id: g.id,
        label: g.task || g.metric,
        target: [g.metric, g.value].filter(Boolean).join(" "),
      }));
      return pathSystemSheets(payload as GoalPathSystem, goals, true);
    }
    case "S2-06": {
      const goals = ((upstream["S2-05"] as DeptUndertakingTable | undefined)?.rows ?? []).map((r) => ({
        id: r.id,
        label: `${r.deptName} · ${r.task}`,
        target: [r.metric, r.value].filter(Boolean).join(" "),
      }));
      return pathSystemSheets(payload as GoalPathSystem, goals, false);
    }
    case "S2-08":
      return keyProjectSheets(payload as KeyProjectList);
    case "S2-04":
      return raciSheets(payload as RaciTable);
    case "S2-05":
      return undertakingSheets(payload as DeptUndertakingTable);
    case "S2-07":
      return scorecardSheets(payload as ScorecardSet);
    case "S3-02":
      return charterSheets(payload as ProjectCharterSet);
    case "S3-05":
      return progressPlanSheets(payload as ProgressPlan);
    case "S3-06":
      return resourceSheets(payload as ResourceMatch, upstream["S3-02"] as ProjectCharterSet | undefined);
    default:
      return [];
  }
}
