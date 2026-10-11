// Artifact catalog for the three responsibility stages (spec V1.2 §4.1, §4.2).
// Shared by the server plugin and the Portal so the step order, unlock rules and
// dependencies are defined in exactly one place.

export type StageKey = 'strategy' | 'goal' | 'action';

export type Priority = 'P0' | 'P1' | 'method';

export type EditorKind =
  | 'strategy-content'
  | 'strategy-map'
  | 'table'
  | 'goal-target'
  | 'decode-map'
  | 'path-system'
  | 'raci'
  | 'project-charter'
  | 'schedule'
  | 'resource-match'
  | 'plan-book'
  | 'worksheet';

export interface ArtifactDef {
  /** Stable code stored on records, e.g. `S1-01`. Method worksheets use `M-*`. */
  code: string;
  /** Spec ID (附录 B). Method worksheets carry the spec ID of the artifact they belong to. */
  specId: string;
  /** The book's table name, shown in small print next to the spec ID. */
  name: string;
  /** Plain-language title for people new to the method; the main heading everywhere. */
  plain: string;
  stage: StageKey;
  /** Checklist columns: 工作任务 and 实施步骤. */
  task: string;
  step: string;
  bookRef: string;
  priority: Priority;
  editor: EditorKind;
  /** Artifacts that must reach "本步完成" (or later) before this one unlocks. P1 and method items never block. */
  unlockAfter: string[];
  /** Upstream artifacts whose content this one reads. Used for "上游已变更" propagation. */
  dependsOn: string[];
  /** Method worksheet attached to another artifact. */
  attachedTo?: string;
  /**
   * Artifacts whose current draft this one shows while editing, without “上游已变更”: S2-01 reads
   * the target zone of S2-03, which in turn imports from S2-01.
   */
  reads?: string[];
}

/** Views and embedded tables that keep a spec ID but have no lifecycle of their own. */
export interface DerivedDef {
  specId: string;
  name: string;
  stage: StageKey;
  /** The artifact whose data and status this view shares. */
  sourceCode: string;
  kind: 'view' | 'embedded' | 'snapshot';
}

export const STAGES: { key: StageKey; name: string; goal: string }[] = [
  { key: 'strategy', name: '定战略责', goal: '清晰共识' },
  { key: 'goal', name: '定目标责', goal: '纵横贯通' },
  { key: 'action', name: '定行动责', goal: '可视可控' },
];

export const ARTIFACTS: ArtifactDef[] = [
  // ── 定战略责 ──
  {
    code: 'S1-01', specId: 'S1-01', name: '战略简约六分法表 / 战略屋', plain: '战略一页纸（六分法 / 战略屋）', stage: 'strategy',
    task: '内容共识：纷繁战略简约化', step: '战略简约六分法 / 战略屋', bookRef: '表 2-1、图 2-3',
    priority: 'P0', editor: 'strategy-content', unlockAfter: [], dependsOn: [],
  },
  {
    code: 'M-MISSION', specId: 'S1-01', name: '使命五要素萃取', plain: '提炼使命', stage: 'strategy',
    task: '逻辑共识：简约战略逻辑化', step: '使命共识', bookRef: '表 2-3',
    priority: 'method', editor: 'worksheet', unlockAfter: [], dependsOn: [], attachedTo: 'S1-01',
  },
  {
    code: 'M-VISION', specId: 'S1-01', name: '愿景三法', plain: '提炼愿景', stage: 'strategy',
    task: '逻辑共识：简约战略逻辑化', step: '愿景共识', bookRef: '战略推导法、对标一流法、引以为傲法',
    priority: 'method', editor: 'worksheet', unlockAfter: [], dependsOn: [], attachedTo: 'S1-01',
  },
  {
    code: 'S1-02', specId: 'S1-02', name: '战略地图', plain: '战略地图', stage: 'strategy',
    task: '逻辑共识：简约战略逻辑化', step: '战略内容的逻辑共识', bookRef: '图 2-8、图 2-9',
    priority: 'P0', editor: 'strategy-map', unlockAfter: ['S1-01'], dependsOn: ['S1-01'],
  },
  {
    code: 'S1-03', specId: 'S1-03', name: '企业战略、策略逻辑表', plain: '战略与策略对照表', stage: 'strategy',
    task: '衡量共识：逻辑战略指标化', step: '第一步 导出企业的战略和策略', bookRef: '表 2-7',
    priority: 'P0', editor: 'table', unlockAfter: ['S1-02'], dependsOn: ['S1-01'],
  },
  {
    code: 'S1-04', specId: 'S1-04', name: 'IPOOC 指标设计表', plain: '衡量指标设计', stage: 'strategy',
    task: '衡量共识：逻辑战略指标化', step: '第二步 设定衡量指标', bookRef: '表 2-8',
    priority: 'P1', editor: 'table', unlockAfter: ['S1-03'], dependsOn: ['S1-03'],
  },
  {
    code: 'S1-05', specId: 'S1-05', name: 'KPI 筛选评价表', plain: '指标筛选打分', stage: 'strategy',
    task: '衡量共识：逻辑战略指标化', step: '第三步 筛选战略 KPI', bookRef: '表 2-10、表 2-11',
    priority: 'P1', editor: 'table', unlockAfter: ['S1-04'], dependsOn: ['S1-04'],
  },
  {
    code: 'S1-06', specId: 'S1-06', name: '战略 KPI 表', plain: '战略指标清单', stage: 'strategy',
    task: '衡量共识：逻辑战略指标化', step: '第三步 筛选战略 KPI', bookRef: '表 2-10、表 2-11 筛选结果',
    priority: 'P0', editor: 'table', unlockAfter: ['S1-03'], dependsOn: ['S1-03', 'S1-05'],
  },
  {
    code: 'S1-07', specId: 'S1-07', name: '战略 KPI 3—5 年年度分解表', plain: '战略指标逐年目标值', stage: 'strategy',
    task: '衡量共识：逻辑战略指标化', step: '第四步 设定指标值并分解至 3—5 年', bookRef: '表 2-12',
    priority: 'P0', editor: 'table', unlockAfter: ['S1-06'], dependsOn: ['S1-06'],
  },

  // ── 定目标责 ──
  // S2-03 holds both 第一步 定目标 (target zone, 表 3-4/3-5) and 第二步 找路径 (paths, 表 3-9/3-10);
  // S2-01 sits in between and reads the target zone (spec 二(七)1–2, 附录 B #10, 4.4).
  {
    code: 'S2-03', specId: 'S2-03', name: '公司级目标路径系统表', plain: '公司级年度目标 · 路径', stage: 'goal',
    task: '路径支撑，确保结果必赢', step: '第一步 定目标 → 第二步 找路径', bookRef: '表 3-4、表 3-5、表 3-9、表 3-10',
    priority: 'P0', editor: 'path-system', unlockAfter: [], dependsOn: ['S1-02', 'S1-07', 'S2-01'],
  },
  {
    code: 'M-BUDGET', specId: 'S2-03', name: '年度经营预算', plain: '年度经营预算', stage: 'goal',
    task: '路径支撑，确保结果必赢', step: '第一步 定目标', bookRef: '表 3-5',
    priority: 'method', editor: 'worksheet', unlockAfter: [], dependsOn: [], attachedTo: 'S2-03',
  },
  {
    code: 'S2-01', specId: 'S2-01', name: '年度战略解码地图', plain: '年度目标解码图', stage: 'goal',
    task: '路径支撑，确保结果必赢', step: '第二步 找路径（解码地图子步骤 1–4）', bookRef: '图 3-3、图 3-7～3-10',
    priority: 'P0', editor: 'decode-map', unlockAfter: [], dependsOn: [], reads: ['S2-03'],
  },
  {
    code: 'S2-08', specId: 'S2-08', name: '关键项目列表', plain: '关键项目清单', stage: 'goal',
    task: '路径支撑，确保结果必赢', step: '第三步 抓关键 · 第四步 立项目', bookRef: '表 3-13',
    priority: 'P0', editor: 'table', unlockAfter: ['S2-03'], dependsOn: ['S2-03'],
  },
  {
    code: 'S2-04', specId: 'S2-04', name: 'RACI 责任分解矩阵', plain: '责任分工矩阵', stage: 'goal',
    task: '横向到边，责任全域协同', step: '列出责任者 → 构建 RACI → 验证与优化', bookRef: '表 3-17、表 3-18、表 3-20',
    priority: 'P0', editor: 'raci', unlockAfter: ['S2-03'], dependsOn: ['S2-03', 'S2-08'],
  },
  {
    code: 'S2-05', specId: 'S2-05', name: '部门目标承接表', plain: '部门目标承接', stage: 'goal',
    task: '纵向到底，目标层层击穿', step: '步骤 2 分部门', bookRef: '表 3-20',
    priority: 'P0', editor: 'table', unlockAfter: ['S2-04'], dependsOn: ['S2-03', 'S2-04', 'S2-08'],
  },
  {
    code: 'S2-06', specId: 'S2-06', name: '部门级目标路径系统图 / 表', plain: '部门目标 · 路径', stage: 'goal',
    task: '纵向到底，目标层层击穿', step: '部门级再找路径', bookRef: '同表 3-9',
    priority: 'P0', editor: 'path-system', unlockAfter: ['S2-05'], dependsOn: ['S2-04', 'S2-05'],
  },
  {
    code: 'S2-07', specId: 'S2-07', name: '绩效计分卡', plain: '部门绩效计分卡', stage: 'goal',
    task: '纵向到底，目标层层击穿', step: '步骤 3 挂考核', bookRef: '表 3-21',
    priority: 'P0', editor: 'table', unlockAfter: ['S2-06'], dependsOn: ['S2-04', 'S2-05'],
  },

  // ── 定行动责 ──
  {
    code: 'S3-02', specId: 'S3-02', name: '项目任务书（含 WBS）', plain: '项目任务书', stage: 'action',
    task: '任务明确，全局可视', step: '项目与项目制管理', bookRef: '表 4-4',
    priority: 'P0', editor: 'project-charter', unlockAfter: [], dependsOn: ['S2-08', 'S2-06', 'S2-04'],
  },
  {
    code: 'S3-05', specId: 'S3-05', name: '计划实施推进表（含节点表）', plain: '项目推进计划', stage: 'action',
    task: '节点明确，进程可控', step: '划分节点 → 输出《计划实施推进表》', bookRef: '表 4-5、表 4-6',
    priority: 'P0', editor: 'schedule', unlockAfter: ['S3-02'], dependsOn: ['S3-02'],
  },
  {
    code: 'S3-06', specId: 'S3-06', name: '项目资源匹配表', plain: '项目资源清单', stage: 'action',
    task: '资源明确，支撑可见', step: '算清需求 → 核对存量 → 补齐缺口', bookRef: '表 4-8',
    priority: 'P0', editor: 'resource-match', unlockAfter: ['S3-05'], dependsOn: ['S3-02', 'S3-05'],
  },
  {
    code: 'S3-07', specId: 'S3-07', name: '公司级年度经营计划书', plain: '公司年度经营计划书', stage: 'action',
    task: '年度经营计划书', step: '公司计划', bookRef: '公司级计划书模板（8 章）',
    priority: 'P0', editor: 'plan-book', unlockAfter: ['S3-06'], dependsOn: ['S1-01', 'S1-02', 'S1-06', 'S1-07', 'S2-03', 'S2-04', 'S2-05', 'S2-07', 'S3-02', 'S3-05', 'S3-06'],
  },
  {
    code: 'S3-08', specId: 'S3-08', name: '部门年度经营计划书', plain: '部门年度经营计划书', stage: 'action',
    task: '年度经营计划书', step: '部门计划', bookRef: '部门级计划书模板（8 章）',
    priority: 'P0', editor: 'plan-book', unlockAfter: ['S3-06'], dependsOn: ['S2-05', 'S2-06', 'S2-07', 'S3-02', 'S3-05', 'S3-06'],
  },
];

export const DERIVED: DerivedDef[] = [
  { specId: 'S2-02', name: '公司级目标路径系统图', stage: 'goal', sourceCode: 'S2-03', kind: 'view' },
  { specId: 'S3-01', name: '年度重点项目清单', stage: 'action', sourceCode: 'S2-08', kind: 'snapshot' },
  { specId: 'S3-03', name: '项目 WBS', stage: 'action', sourceCode: 'S3-02', kind: 'embedded' },
  { specId: 'S3-04', name: '项目 / 任务节点表', stage: 'action', sourceCode: 'S3-05', kind: 'embedded' },
];

/** 附录 B #24: kept in the catalog so the list stays complete, but moved out of V1 (Q7). */
export const OUT_OF_SCOPE = [{ specId: 'S3-09', name: '经营目标责任书', stage: 'action' as StageKey, note: '移出 V1（P1）：交付页以各部门绩效计分卡取代' }];

export type SpecItem =
  | { kind: 'artifact'; specId: string; code: string }
  | { kind: 'derived'; specId: string; derived: DerivedDef }
  | { kind: 'out'; specId: string; name: string; stage: StageKey; note: string };

/**
 * The 24 deliverables of 附录 B in its order: tables with their own lifecycle, views and
 * embedded tables that share their source's data and status, and S3-09 (out of V1). Method
 * worksheets (使命五要素、愿景三法、经营预算) carry no number and are not counted.
 */
export const SPEC_ITEMS: SpecItem[] = (() => {
  const order = ['S1-01', 'S1-02', 'S1-03', 'S1-04', 'S1-05', 'S1-06', 'S1-07', 'S2-01', 'S2-02', 'S2-03', 'S2-08', 'S2-04', 'S2-05', 'S2-06', 'S2-07', 'S3-01', 'S3-02', 'S3-03', 'S3-04', 'S3-05', 'S3-06', 'S3-07', 'S3-08', 'S3-09'];
  return order.map((specId): SpecItem => {
    const artifact = ARTIFACTS.find((a) => a.code === specId && a.priority !== 'method');
    if (artifact) return { kind: 'artifact', specId, code: artifact.code };
    const derived = DERIVED.find((d) => d.specId === specId);
    if (derived) return { kind: 'derived', specId, derived };
    const out = OUT_OF_SCOPE.find((o) => o.specId === specId)!;
    return { kind: 'out', ...out };
  });
})();

const byCode = new Map(ARTIFACTS.map((a) => [a.code, a]));

export function getArtifactDef(code: string): ArtifactDef {
  const def = byCode.get(code);
  if (!def) throw new Error(`Unknown artifact code: ${code}`);
  return def;
}

export function isArtifactCode(code: string): boolean {
  return byCode.has(code);
}

export function artifactsOfStage(stage: StageKey): ArtifactDef[] {
  return ARTIFACTS.filter((a) => a.stage === stage);
}

/** Artifacts that must all be Locked before the next stage opens. */
export function stageGateCodes(stage: StageKey): string[] {
  return artifactsOfStage(stage)
    .filter((a) => a.priority === 'P0')
    .map((a) => a.code);
}

export function previousStage(stage: StageKey): StageKey | null {
  const index = STAGES.findIndex((s) => s.key === stage);
  return index > 0 ? STAGES[index - 1].key : null;
}

/** Direct downstream artifacts that read `code`. */
export function dependentsOf(code: string): string[] {
  return ARTIFACTS.filter((a) => a.dependsOn.includes(code)).map((a) => a.code);
}
