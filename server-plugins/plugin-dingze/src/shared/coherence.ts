// 上下游连贯性（客户反馈 2026-10-15：各工具产出的内容要连贯、可承接，避免脱节）。
// 下游从上游“带入”后各自保存；这里逐表核对带入的内容与上游当前内容是否一致、上游的条目是否
// 都有了下游、下游引用的上游条目是否还在。只出提示（warning），能自动修正的带 fix。

import type { ProjectCharterSet, ProgressPlan, ResourceMatch } from './actions';
import type { DeptUndertakingTable, GoalPathSystem, KeyProjectList, RaciTable, ScorecardSet } from './goals';
import type { DecodeMap } from './goals';
import type { IpoocDesign, KpiBreakdown, KpiScreening, StrategyKpiTable, StrategyLogic, StrategyMap } from './measures';
import type { Issue } from './validators';

const same = (a: unknown, b: unknown) => String(a ?? '').trim() === String(b ?? '').trim();
const filled = (v: unknown) => typeof v === 'string' && v.trim() !== '' && v.trim() !== '待补';
const names = (list: string[], max = 4) => list.slice(0, max).join('、') + (list.length > max ? ` 等 ${list.length} 项` : '');

/** S2-03 定目标 ↔ S1-07 本年度目标值（计划书 1.2 / 4.1 与 4.2 同时引用两边）。 */
export function goalsVsBreakdown(system: GoalPathSystem | undefined, breakdown: KpiBreakdown | undefined): Issue[] {
  const targets = system?.targets;
  if (!targets || !breakdown) return [];
  const year = String(targets.year || breakdown.years?.[0] || '');
  const issues: Issue[] = [];
  const rows = breakdown.rows ?? [];
  for (const g of targets.goals ?? []) {
    if (!g.sourceRowId) continue;
    const name = g.task || g.metric || '未命名目标';
    const row = rows.find((r) => r.id === g.sourceRowId);
    if (!row) {
      issues.push({ level: 'warning', message: `“${name}”来自的战略 KPI 已从 3—5 年分解表（S1-07）删除，确认这个年度目标是否还要保留`, anchor: g.id, zone: 'targets' });
      continue;
    }
    const value = row.values?.[year] ?? '';
    const diffs: string[] = [];
    const changes: { path: string; value: unknown; label?: string }[] = [];
    // 衡量指标改了说法（如 S1-07“售气量”→ 年度目标“新增售气量”）是有意换口径，不再比数值。
    const reframed = filled(g.metric) && filled(row.name) && !same(g.metric, row.name);
    if (!reframed && filled(value) && !same(g.value, value)) {
      diffs.push(`指标值 ${g.value || '空'} ≠ S1-07 的 ${year} 年 ${value}`);
      changes.push({ path: `targets.goals.${g.id}.value`, value, label: `${name} · 指标值` });
    }
    if (!reframed && filled(row.unit) && !same(g.unit, row.unit)) {
      diffs.push(`单位 ${g.unit || '空'} ≠ ${row.unit}`);
      changes.push({ path: `targets.goals.${g.id}.unit`, value: row.unit, label: `${name} · 单位` });
    }
    if (diffs.length)
      issues.push({
        level: 'warning',
        message: `“${name}”与 S1-07 本年度目标不一致：${diffs.join('；')}。计划书会同时印出两边的数`,
        anchor: g.id,
        zone: 'targets',
        fix: { label: '按 S1-07 更新', changes },
      });
  }
  const used = new Set((targets.goals ?? []).map((g) => g.sourceRowId).filter(Boolean));
  const missing = rows.filter((r) => filled(r.values?.[year]) && !used.has(r.id)).map((r) => r.name);
  if (missing.length) issues.push({ level: 'warning', message: `S1-07 的 ${year} 年目标还有 ${names(missing)} 没有对应的年度目标：用“从 S1-07 带入”补上，或确认不纳入`, zone: 'targets' });
  return issues;
}

/** S2-04 RACI ↔ S2-08 关键项目 / S2-03 路径：每个关键项目都分了责，行的来源还在、名称一致。 */
export function raciVsSources(raci: RaciTable | undefined, projects: KeyProjectList | undefined, paths: GoalPathSystem | undefined): Issue[] {
  if (!raci) return [];
  const issues: Issue[] = [];
  const list = projects?.projects ?? [];
  const nodes = paths?.nodes ?? [];
  for (const row of raci.rows ?? []) {
    if (row.sourceKind === 'project' && row.sourceId) {
      const p = list.find((x) => x.id === row.sourceId);
      if (!p) issues.push({ level: 'warning', message: `“${row.name}”对应的关键项目已从关键项目清单（S2-08）删除，确认这一行是否还要保留`, anchor: row.id });
      else if (filled(p.name) && !same(p.name, row.name))
        issues.push({ level: 'warning', message: `“${row.name}”在关键项目清单里已改名为“${p.name.trim()}”`, anchor: row.id, fix: { label: '按关键项目改名', changes: [{ path: `rows.${row.id}.name`, value: p.name.trim(), label: `${row.name} · 名称` }] } });
    }
    if (row.sourceKind === 'path' && row.sourceId) {
      const n = nodes.find((x) => x.id === row.sourceId);
      if (!n) issues.push({ level: 'warning', message: `“${row.name}”对应的路径已从公司级路径系统表（S2-03）删除`, anchor: row.id });
      else if (filled(n.path) && !same(n.path, row.name))
        issues.push({ level: 'warning', message: `“${row.name}”在路径系统表里已改名为“${n.path.trim()}”`, anchor: row.id, fix: { label: '按路径改名', changes: [{ path: `rows.${row.id}.name`, value: n.path.trim(), label: `${row.name} · 名称` }] } });
    }
  }
  const covered = new Set((raci.rows ?? []).map((r) => r.sourceId).filter(Boolean));
  const missing = list.filter((p) => filled(p.name) && !covered.has(p.id)).map((p) => p.name.trim());
  if (missing.length) issues.push({ level: 'warning', message: `关键项目 ${names(missing)} 还没有分配 RACI 责任：用“带入关键项目”补上` });
  return issues;
}

/** S2-05 部门承接 ↔ S2-04：A、R 都要承接；承接的来源行和角色还在。 */
export function undertakingVsRaci(table: DeptUndertakingTable | undefined, raci: RaciTable | undefined): Issue[] {
  if (!table || !raci) return [];
  const issues: Issue[] = [];
  const rows = table.rows ?? [];
  for (const row of raci.rows ?? []) {
    for (const col of raci.columns ?? []) {
      const letters = row.cells?.[col.id] ?? [];
      if (letters.includes('R') && !letters.includes('A') && !rows.some((u) => u.sourceRowId === row.id && u.deptId === col.id))
        issues.push({ level: 'warning', message: `${col.name}是“${row.name}”的 R（执行者），还没有承接它：书中要求部门承接自己担任 A / R 的项目或路径` });
    }
  }
  for (const u of rows) {
    if (!u.sourceRowId) continue;
    const row = (raci.rows ?? []).find((r) => r.id === u.sourceRowId);
    const name = `${u.deptName || '未指定部门'} · ${u.task || '未命名任务'}`;
    if (!row) {
      issues.push({ level: 'warning', message: `“${name}”对应的 RACI 行已删除，确认是否还要保留这条承接`, anchor: u.id });
      continue;
    }
    const letters = row.cells?.[u.deptId] ?? [];
    const now = letters.includes('A') ? 'A' : letters.includes('R') ? 'R' : null;
    if (!now) issues.push({ level: 'warning', message: `“${name}”：${u.deptName}在 RACI 里已不再是“${row.name}”的 A 或 R`, anchor: u.id });
    else if (now !== u.role)
      issues.push({ level: 'warning', message: `“${name}”：RACI 里${u.deptName}现在是 ${now}，这里写的是 ${u.role}`, anchor: u.id, fix: { label: `改为 ${now}`, changes: [{ path: `rows.${u.id}.role`, value: now, label: `${name} · 角色` }] } });
  }
  return issues;
}

/** S2-07 计分卡 ↔ S2-05：每条部门承接都上了本部门的计分卡。 */
export function scorecardsVsUndertaking(set: ScorecardSet | undefined, table: DeptUndertakingTable | undefined): Issue[] {
  if (!set || !table) return [];
  const onCards = new Set((set.cards ?? []).flatMap((c) => c.items.map((i) => i.originId)).filter(Boolean));
  const missing = (table.rows ?? []).filter((u) => filled(u.task) && !onCards.has(u.id)).map((u) => `${u.deptName} · ${u.task}`);
  return missing.length ? [{ level: 'warning', message: `部门承接 ${names(missing)} 还没有上计分卡：用“按部门承接生成”补上，或确认不纳入考核` }] : [];
}

/** S3-02 任务书 ↔ S2-08 / S2-04：关键项目都做了项目化判定；时间、负责人与关键项目一致；牵头部门是 RACI 的 A。 */
export function chartersVsSources(set: ProjectCharterSet | undefined, projects: KeyProjectList | undefined, raci: RaciTable | undefined): Issue[] {
  if (!set) return [];
  const issues: Issue[] = [];
  const screening = set.screening ?? [];
  const list = projects?.projects ?? [];
  const judged = new Set(screening.map((s) => s.sourceId).filter(Boolean));
  const missing = list.filter((p) => filled(p.name) && !judged.has(p.id)).map((p) => p.name.trim());
  if (missing.length) issues.push({ level: 'warning', message: `关键项目 ${names(missing)} 还没有做项目化判定：用“带入关键项目与部门一级路径”补上` });
  for (const c of set.charters ?? []) {
    const item = screening.find((s) => s.id === c.screeningId);
    const project = item?.sourceKind === 'project' ? list.find((p) => p.id === item.sourceId) : undefined;
    if (item?.sourceKind === 'project' && item.sourceId && !project) {
      issues.push({ level: 'warning', message: `任务书“${c.name}”对应的关键项目已从关键项目清单（S2-08）删除`, anchor: c.id });
      continue;
    }
    if (project) {
      const diffs: string[] = [];
      const changes: { path: string; value: unknown; label?: string }[] = [];
      for (const [key, label] of [['start', '开始时间'], ['end', '结束时间'], ['owner', '负责人']] as const) {
        if (filled(project[key]) && !same(c[key], project[key])) {
          diffs.push(`${label} ${c[key] || '空'} ≠ ${project[key]}`);
          changes.push({ path: `charters.${c.id}.${key}`, value: project[key].trim(), label: `${c.name} · ${label}` });
        }
      }
      if (diffs.length) issues.push({ level: 'warning', message: `任务书“${c.name}”与关键项目清单不一致：${diffs.join('；')}`, anchor: c.id, fix: { label: '按关键项目更新', changes } });
    }
    const row = item?.sourceId ? (raci?.rows ?? []).find((r) => r.sourceId === item.sourceId) : undefined;
    const lead = row ? (raci?.columns ?? []).find((col) => (row.cells?.[col.id] ?? []).includes('A')) : undefined;
    if (lead && c.deptId !== lead.id)
      issues.push({
        level: 'warning',
        message: `任务书“${c.name}”的牵头部门是“${c.deptName || '未指定'}”，RACI 里的 A 是“${lead.name}”：部门计划书按牵头部门归集`,
        anchor: c.id,
        fix: { label: `改为${lead.name}`, changes: [{ path: `charters.${c.id}.deptId`, value: lead.id, label: `${c.name} · 牵头部门` }, { path: `charters.${c.id}.deptName`, value: lead.name }] },
      });
  }
  return issues;
}

/** S3-05 推进表 ↔ S3-02：推进表里的项目都还在。 */
export function planVsCharters(plan: ProgressPlan | undefined, set: ProjectCharterSet | undefined): Issue[] {
  if (!plan || !set) return [];
  const ids = new Set((set.charters ?? []).map((c) => c.id));
  return (plan.rows ?? [])
    .filter((r) => r.charterId && !ids.has(r.charterId))
    .map((r) => ({ level: 'warning' as const, message: `“${r.name}”对应的项目任务书已删除，确认这一行是否还要保留`, anchor: r.id }));
}

/** 文字里的第一笔金额，折成万元（“建设投资 5400 万元（压缩后）”→ 5400）。 */
function moneyOf(text: string): number | null {
  const m = (text ?? '').match(/(-?\d+(?:\.\d+)?)\s*(亿元|亿|万元|万|元)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? '万元';
  return unit.startsWith('亿') ? n * 10000 : unit === '元' ? n / 10000 : n;
}

/** S3-06 资源 ↔ S3-02：财务需求的金额与任务书预算一致。 */
export function resourcesVsCharters(match: ResourceMatch | undefined, set: ProjectCharterSet | undefined): Issue[] {
  if (!match || !set) return [];
  const issues: Issue[] = [];
  for (const r of match.rows ?? []) {
    const c = (set.charters ?? []).find((x) => x.id === r.charterId);
    if (!c) {
      if (r.charterId) issues.push({ level: 'warning', message: `有一条资源对应的项目任务书已删除`, anchor: r.id });
      continue;
    }
    // 只比金额：说法可以不同（“设备投资 1500 万元”与“气化撬装设备投资 1500 万元”是一回事）。
    if (r.category !== 'finance' || r.none) continue;
    const need = moneyOf(r.need);
    const budget = moneyOf(c.resources?.budget ?? '');
    if (need !== null && budget !== null && Math.abs(need - budget) > 1e-6)
      issues.push({ level: 'warning', message: `“${c.name}”的财务需求 ${r.need} 与任务书预算 ${c.resources.budget.trim()} 金额不一致`, anchor: r.id, fix: { label: '按任务书预算更新', changes: [{ path: `rows.${r.id}.need`, value: c.resources.budget.trim(), label: `${c.name} · 需求` }] } });
  }
  return issues;
}

type Fix = { path: string; value: unknown; label?: string };
const renameFix = (label: string, path: string, value: string, what: string): { label: string; changes: Fix[] } => ({ label, changes: [{ path, value, label: what }] });

/** S1-03 逻辑表 ↔ S1-02 战略地图：带入的战略对应的目标还在、名称一致。 */
export function logicVsMap(logic: StrategyLogic | undefined, map: StrategyMap | undefined): Issue[] {
  if (!logic || !map) return [];
  const issues: Issue[] = [];
  for (const s of logic.strategies ?? []) {
    if (!s.objectiveId) continue;
    const o = (map.objectives ?? []).find((x) => x.id === s.objectiveId);
    if (!o) issues.push({ level: 'warning', message: `战略“${s.statement}”对应的战略地图目标已删除，确认是否保留`, anchor: s.id });
    else if (filled(o.title) && !same(o.title, s.statement))
      issues.push({ level: 'warning', message: `战略“${s.statement}”在战略地图里已改为“${o.title.trim()}”`, anchor: s.id, fix: renameFix('按战略地图改名', `strategies.${s.id}.statement`, o.title.trim(), s.statement) });
  }
  return issues;
}

/** S1-04 IPOOC ↔ S1-03：主题对应的策略还在、名称一致。 */
export function ipoocVsLogic(design: IpoocDesign | undefined, logic: StrategyLogic | undefined): Issue[] {
  if (!design || !logic) return [];
  const tactics = (logic.strategies ?? []).flatMap((s) => s.tactics ?? []);
  const issues: Issue[] = [];
  for (const sheet of design.sheets ?? []) {
    if (!sheet.tacticId) continue;
    const t = tactics.find((x) => x.id === sheet.tacticId);
    if (!t) issues.push({ level: 'warning', message: `主题“${sheet.strategy}”对应的策略已从逻辑表删除`, anchor: sheet.id });
    else if (filled(t.text) && !same(t.text, sheet.strategy))
      issues.push({ level: 'warning', message: `主题“${sheet.strategy}”在逻辑表里已改为“${t.text.trim()}”`, anchor: sheet.id, fix: renameFix('按逻辑表改名', `sheets.${sheet.id}.strategy`, t.text.trim(), sheet.strategy) });
  }
  return issues;
}

/** S1-05 筛选 ↔ S1-04：候选指标对应的 IPOOC 指标还在、名称一致。 */
export function screeningVsIpooc(screening: KpiScreening | undefined, design: IpoocDesign | undefined): Issue[] {
  if (!screening || !design) return [];
  const issues: Issue[] = [];
  for (const c of screening.candidates ?? []) {
    if (!c.sourceRef) continue;
    const [sheetId, stage] = c.sourceRef.split('.');
    const sheet = (design.sheets ?? []).find((x) => x.id === sheetId);
    const indicator = sheet?.rows?.[stage as keyof typeof sheet.rows]?.indicator?.trim() ?? '';
    if (!filled(indicator)) issues.push({ level: 'warning', message: `候选指标“${c.name}”在 IPOOC 表里已删除`, anchor: c.id });
    else if (!same(indicator, c.name))
      issues.push({ level: 'warning', message: `候选指标“${c.name}”在 IPOOC 表里已改为“${indicator}”`, anchor: c.id, fix: renameFix('按 IPOOC 改名', `candidates.${c.id}.name`, indicator, c.name) });
  }
  return issues;
}

/** S1-06 战略 KPI ↔ S1-05：对应的候选指标还在、仍是“保留”、名称一致。 */
export function kpisVsScreening(table: StrategyKpiTable | undefined, screening: KpiScreening | undefined): Issue[] {
  if (!table || !screening) return [];
  const issues: Issue[] = [];
  for (const k of table.kpis ?? []) {
    if (!k.candidateId) continue;
    const c = (screening.candidates ?? []).find((x) => x.id === k.candidateId);
    if (!c) issues.push({ level: 'warning', message: `战略 KPI“${k.name}”对应的候选指标已从筛选表删除`, anchor: k.id });
    else if (c.keep === false) issues.push({ level: 'warning', message: `战略 KPI“${k.name}”在筛选表里已被剔除，确认是否还保留`, anchor: k.id });
    else if (filled(c.name) && !same(c.name, k.name))
      issues.push({ level: 'warning', message: `战略 KPI“${k.name}”在筛选表里已改为“${c.name.trim()}”`, anchor: k.id, fix: renameFix('按筛选表改名', `kpis.${k.id}.name`, c.name.trim(), k.name) });
  }
  return issues;
}

/** S2-01 解码地图 ↔ S1-02 战略地图：带入的主题对应的目标还在、名称一致。 */
export function decodeVsStrategyMap(map: DecodeMap | undefined, strategyMap: StrategyMap | undefined): Issue[] {
  if (!map || !strategyMap) return [];
  const issues: Issue[] = [];
  for (const t of map.themes ?? []) {
    if (!t.objectiveId) continue;
    const o = (strategyMap.objectives ?? []).find((x) => x.id === t.objectiveId);
    if (!o) issues.push({ level: 'warning', message: `主题“${t.title}”对应的战略地图目标已删除`, anchor: t.id });
    else if (filled(o.title) && !same(o.title, t.title))
      issues.push({ level: 'warning', message: `主题“${t.title}”在战略地图里已改为“${o.title.trim()}”`, anchor: t.id, fix: renameFix('按战略地图改名', `themes.${t.id}.title`, o.title.trim(), t.title) });
  }
  return issues;
}

/** S2-03 路径 ↔ S2-01 解码地图：导入的一级路径对应的主题还在，名称、指标值一致。 */
export function pathsVsDecodeMap(system: GoalPathSystem | undefined, map: DecodeMap | undefined): Issue[] {
  if (!system || !map) return [];
  const issues: Issue[] = [];
  for (const n of system.nodes ?? []) {
    if (!n.themeId) continue;
    const t = (map.themes ?? []).find((x) => x.id === n.themeId);
    if (!t) {
      issues.push({ level: 'warning', message: `路径“${n.path}”对应的解码地图主题已删除，确认是否保留`, anchor: n.id, zone: 'paths' });
      continue;
    }
    const changes: Fix[] = [];
    const diffs: string[] = [];
    if (filled(t.title) && !same(t.title, n.path)) {
      diffs.push(`名称已改为“${t.title.trim()}”`);
      changes.push({ path: `nodes.${n.id}.path`, value: t.title.trim(), label: `${n.path} · 路径` });
    }
    if (filled(t.value) && !same(t.value, n.value)) {
      diffs.push(`指标值 ${n.value || '空'} ≠ 解码地图的 ${t.value}`);
      changes.push({ path: `nodes.${n.id}.value`, value: t.value.trim(), label: `${n.path} · 指标值` });
    }
    if (diffs.length) issues.push({ level: 'warning', message: `路径“${n.path}”与解码地图不一致：${diffs.join('；')}`, anchor: n.id, zone: 'paths', fix: { label: '按解码地图更新', changes } });
  }
  return issues;
}
