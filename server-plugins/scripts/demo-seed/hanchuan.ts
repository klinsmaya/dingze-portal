/* eslint-disable @typescript-eslint/no-explicit-any -- demo payloads are edited as untyped JSON */
// 瀚川燃气有限公司 · 2026 年度战略落地 — a mid-size city gas company (fictional), with numbers that
// add up across the tables: 战略 → 指标 → 年度目标 → 路径 → 关键项目 → RACI → 部门 → 任务书.

type Org = Record<string, number>;
const col = (org: Org, name: string) => `org-${org[name]}`;

export function hanchuan2026(org: Org) {
  const S101 = {
    primary: 'sixfold',
    mission: '让城市用上安全、清洁、可负担的能源',
    vision: '2030 年成为长三角领先的城市综合能源服务商',
    values: '安全第一 · 客户至上 · 务实担当 · 协同共赢',
    strategicGoals:
      '2026 年：售气量 5.8 亿方、营业收入 20.5 亿元、重大安全事故 0 起；2028 年：营业收入 25 亿元，综合能源收入占比 15%；2030 年：营业收入 32 亿元，综合能源收入占比 25%，进入长三角城市燃气企业前五。',
    strategyChoice:
      '稳住城市燃气基本盘（居民＋工商业），做大车用气增量（LNG 重卡、公交出租），培育工业点供与分布式能源第二曲线。不做：跨省长输管道、单纯气源贸易、与主业无关的多元化投资。',
    indicatorSystem:
      '财务：售气量、营业收入、净利润率；客户：工商业新增用户、车用气签约车队、客户满意度；内部流程：管网完好率、安检覆盖率、新站投运数；学习与成长：持证站长人数、智慧燃气平台覆盖率。',
    stepsAndMeasures:
      '2026 夯基础：老旧管网改造 120 公里，新建加气站 4 座，物流车队签约 60 家，智慧燃气平台一期上线；2027 拓增量：点供项目 30 个，综合能源示范园区 2 个；2028 上台阶：综合能源收入占比 15%，平台覆盖全部场站。',
    goals: { y1: '售气量 5.8 亿方，营收 20.5 亿元', y3: '营收 25 亿元，综合能源占比 15%', y5: '营收 32 亿元，综合能源占比 25%' },
    battlefields: [
      { id: 'b1', name: '城市燃气（工商业）', mustWin: '工商业新增售气 3200 万方', advantage: '特许经营区内管网全覆盖，接驳周期 30 天以内' },
      { id: 'b2', name: '车用气', mustWin: '车用气新增 1800 万方', advantage: '城区与港区站点密度全市最高，气价联动机制成熟' },
      { id: 'b3', name: '工业点供与分布式能源', mustWin: '点供新增 1000 万方，签约 30 个项目', advantage: 'LNG 槽车调度与安全运营经验 12 年' },
    ],
    foundation: {
      talent: '三年培养 30 名持证站长、15 名综合能源项目经理',
      organization: '设立综合能源事业部，点供业务独立核算',
      mechanism: '关键项目制＋季度经营分析会＋增量利润分享',
    },
  };

  const S102 = {
    objectives: [
      { id: 'o1', perspective: 'financial', title: '营业收入 20.5 亿元', note: '同比 +10%' },
      { id: 'o2', perspective: 'financial', title: '售气量 5.8 亿方', note: '新增 6000 万方' },
      { id: 'o3', perspective: 'customer', title: '工商业用户快速接驳', note: '接驳周期 ≤30 天' },
      { id: 'o4', perspective: 'customer', title: '车用气车队客户首选', note: '签约车队 60 家' },
      { id: 'o5', perspective: 'customer', title: '点供客户稳定供气', note: '断供 0 次' },
      { id: 'o6', perspective: 'process', title: '管网本质安全', note: '老旧管网改造 120 公里' },
      { id: 'o7', perspective: 'process', title: '加气站网络加密', note: '新建 4 座' },
      { id: 'o8', perspective: 'process', title: 'LNG 调度保障', note: '槽车准点率 98%' },
      { id: 'o9', perspective: 'learning', title: '站长与安全人才梯队', note: '持证站长 30 名' },
      { id: 'o10', perspective: 'learning', title: '智慧燃气平台', note: '一期覆盖 60% 场站' },
    ],
    links: [
      { id: 'r1', from: 'o3', to: 'o2', kind: 'cause' },
      { id: 'r2', from: 'o4', to: 'o2', kind: 'cause' },
      { id: 'r3', from: 'o5', to: 'o2', kind: 'cause' },
      { id: 'r4', from: 'o2', to: 'o1', kind: 'synergy' },
      { id: 'r5', from: 'o6', to: 'o3', kind: 'cause' },
      { id: 'r6', from: 'o7', to: 'o4', kind: 'cause' },
      { id: 'r7', from: 'o8', to: 'o5', kind: 'cause' },
      { id: 'r8', from: 'o9', to: 'o7', kind: 'cause' },
      { id: 'r9', from: 'o10', to: 'o8', kind: 'cause' },
      { id: 'r10', from: 'o10', to: 'o6', kind: 'cause' },
      { id: 'r11', from: 'o7', to: 'o8', kind: 'synergy' },
    ],
  };

  const S103 = {
    levelNote: '综合能源在事业部层面是单元战略，由综合能源事业部承接',
    strategies: [
      { id: 's1', statement: '稳住城市燃气基本盘，工商业用户快接快通', tactics: [
        { id: 't1', text: '园区工业用户“一企一策”接驳', path: '' },
        { id: 't2', text: '商业综合体与酒店“瓶改管”', path: '' },
        { id: 't3', text: '老旧管网三年改造计划', path: '' },
      ] },
      { id: 's2', statement: '做大车用气增量，抢占 LNG 重卡市场', tactics: [
        { id: 't4', text: '港区与城际物流车队年度长协', path: '' },
        { id: 't5', text: '城区与港区新建加气站 4 座', path: '' },
        { id: 't6', text: '公交出租 CNG 稳量', path: '' },
      ] },
      { id: 's3', statement: '培育工业点供与分布式能源第二曲线', tactics: [
        { id: 't7', text: '产业园 LNG 点供项目群', path: '' },
        { id: 't8', text: '乡镇集中供气', path: '' },
        { id: 't9', text: '冷热电三联供示范项目', path: '' },
      ] },
    ],
  };

  const kpis = [
    { id: 'p1', theme: '经营结果', name: '营业收入', definition: '合并报表营业收入', unit: '亿元', source: '财务报表', period: '季', owner: '财务部' },
    { id: 'p2', theme: '经营结果', name: '售气量', definition: '全年天然气销售总量（含车用、点供）', unit: '亿方', source: '营销系统', period: '月', owner: '市场营销部' },
    { id: 'p3', theme: '稳住基本盘', name: '工商业新增用户', definition: '当年完成通气的工商业新用户数', unit: '户', source: '营销系统', period: '月', owner: '市场营销部' },
    { id: 'p4', theme: '做大车用气', name: '车用气签约车队', definition: '签订年度供气长协的物流与客运车队数', unit: '家', source: '合同台账', period: '月', owner: '燃气运营部' },
    { id: 'p5', theme: '本质安全', name: '重大安全事故', definition: '按集团标准认定的重大及以上安全事故', unit: '起', source: '安全台账', period: '月', owner: '安全质量部' },
    { id: 'p6', theme: '第二曲线', name: '综合能源收入占比', definition: '综合能源服务收入 / 营业收入', unit: '%', source: '财务报表', period: '季', owner: '综合能源事业部' },
  ];
  const S106 = { kpis };
  const S107 = {
    years: [2026, 2027, 2028, 2030],
    rows: [
      { id: 'y1', kpiId: 'p1', theme: '经营结果', name: '营业收入', unit: '亿元', values: { '2026': '20.5', '2027': '22.6', '2028': '25', '2030': '32' }, baseline: '18.6', benchmark: '24', challenge: '21.5' },
      { id: 'y2', kpiId: 'p2', theme: '经营结果', name: '售气量', unit: '亿方', values: { '2026': '5.8', '2027': '6.4', '2028': '7', '2030': '8.5' }, baseline: '5.2', benchmark: '6.5', challenge: '6' },
      { id: 'y3', kpiId: 'p3', theme: '稳住基本盘', name: '工商业新增用户', unit: '户', values: { '2026': '420', '2027': '460', '2028': '500', '2030': '560' }, baseline: '350', benchmark: '480', challenge: '450' },
      { id: 'y4', kpiId: 'p4', theme: '做大车用气', name: '车用气签约车队', unit: '家', values: { '2026': '60', '2027': '85', '2028': '110', '2030': '150' }, baseline: '28', benchmark: '90', challenge: '70' },
      { id: 'y5', kpiId: 'p5', theme: '本质安全', name: '重大安全事故', unit: '起', values: { '2026': '0', '2027': '0', '2028': '0', '2030': '0' }, baseline: '0', benchmark: '0', challenge: '0' },
      { id: 'y6', kpiId: 'p6', theme: '第二曲线', name: '综合能源收入占比', unit: '%', values: { '2026': '6', '2027': '10', '2028': '15', '2030': '25' }, baseline: '3', benchmark: '12', challenge: '8' },
    ],
  };

  const goals = [
    { id: 'g1', perspective: 'financial', task: '新增售气量', purpose: '售气量从 5.2 亿方提升到 5.8 亿方，支撑三年营收 25 亿元', metric: '新增售气量', value: '6000', unit: '万方', sourceRowId: 'y2' },
    { id: 'g2', perspective: 'financial', task: '营业收入达到 20.5 亿元', purpose: '经营结果，同比增长 10%', metric: '营业收入', value: '20.5', unit: '亿元', sourceRowId: 'y1' },
    { id: 'g3', perspective: 'process', task: '重大安全事故为零', purpose: '本质安全是城燃企业的生命线', metric: '重大安全事故', value: '0', unit: '起', sourceRowId: 'y5' },
  ];
  const N = (id: string, parentId: string | null, level: number, path: string, metric: string, value: string, unit: string, extra: Record<string, unknown> = {}) => ({
    id, parentId, level, path, metric, value, unit, amount: Number.isFinite(Number(value)) ? Number(value) : null, goalId: null as string | null, ...extra,
  });
  const nodes = [
    N('n1', null, 1, '开拓工商业新用户', '新增售气量', '3200', '万方', { goalId: 'g1', perspective: 'financial', groupTag: '提高客户价值 › 开发新客户' }),
    N('n11', 'n1', 2, '园区工业用户接驳', '新增售气量', '2000', '万方'),
    N('n111', 'n11', 3, '高新区陶瓷与玻璃企业', '新增售气量', '1200', '万方'),
    N('n112', 'n11', 3, '临港化工园区', '新增售气量', '800', '万方'),
    N('n12', 'n1', 2, '商业综合体与酒店“瓶改管”', '新增售气量', '1200', '万方'),
    N('n121', 'n12', 3, '新建商业综合体接驳', '新增售气量', '700', '万方'),
    N('n122', 'n12', 3, '酒店餐饮瓶改管', '新增售气量', '500', '万方'),
    N('n2', null, 1, '做大车用气', '新增售气量', '1800', '万方', { goalId: 'g1', perspective: 'financial', groupTag: '增加收入机会 › 业务' }),
    N('n21', 'n2', 2, 'LNG 物流重卡', '新增售气量', '1100', '万方'),
    N('n211', 'n21', 3, '港区集卡车队长协', '新增售气量', '600', '万方'),
    N('n212', 'n21', 3, '城际干线物流车队', '新增售气量', '500', '万方'),
    N('n22', 'n2', 2, '公交与出租车', '新增售气量', '700', '万方'),
    N('n221', 'n22', 3, '公交集团 CNG 增量', '新增售气量', '400', '万方'),
    N('n222', 'n22', 3, '出租车与网约车', '新增售气量', '300', '万方'),
    N('n3', null, 1, '发展工业点供', '新增售气量', '1000', '万方', { goalId: 'g1', perspective: 'financial', groupTag: '增加收入机会 › 区域' }),
    N('n31', 'n3', 2, '产业园 LNG 点供', '新增售气量', '600', '万方'),
    N('n32', 'n3', 2, '乡镇集中供气', '新增售气量', '400', '万方'),
    N('r1', null, 1, '售气收入', '营业收入', '17.2', '亿元', { goalId: 'g2', perspective: 'financial' }),
    N('r11', 'r1', 2, '居民售气', '营业收入', '5.1', '亿元'),
    N('r12', 'r1', 2, '工商业售气', '营业收入', '8.4', '亿元'),
    N('r13', 'r1', 2, '车用气', '营业收入', '2.6', '亿元'),
    N('r14', 'r1', 2, '工业点供', '营业收入', '1.1', '亿元'),
    N('r2', null, 1, '工程安装收入', '营业收入', '2.1', '亿元', { goalId: 'g2', perspective: 'financial' }),
    N('r21', 'r2', 2, '工商业接驳安装', '营业收入', '1.3', '亿元'),
    N('r22', 'r2', 2, '居民新装与改装', '营业收入', '0.8', '亿元'),
    N('r3', null, 1, '综合能源服务收入', '营业收入', '1.2', '亿元', { goalId: 'g2', perspective: 'financial', groupTag: '增加收入机会 › 经营模式' }),
    N('r31', 'r3', 2, '分布式光伏运维', '营业收入', '0.5', '亿元'),
    N('r32', 'r3', 2, '冷热电三联供', '营业收入', '0.7', '亿元'),
    N('s1', null, 1, '老旧管网改造', '改造长度', '120', '公里', { goalId: 'g3', perspective: 'process' }),
    N('s11', 's1', 2, '灰口铸铁管更换', '改造长度', '70', '公里'),
    N('s12', 's1', 2, '老化 PE 管与立管更换', '改造长度', '50', '公里'),
    N('s2', null, 1, '用户安检全覆盖', '安检覆盖率', '100%', '', { goalId: 'g3', perspective: 'process' }),
    N('s21', 's2', 2, '居民入户安检', '安检户数', '62 万', '户'),
    N('s22', 's2', 2, '工商业用户安检', '安检户数', '1.8 万', '户'),
    N('s3', null, 1, '管网智能监测', '监测点', '3000', '个', { goalId: 'g3', perspective: 'learning' }),
    N('s31', 's3', 2, '场站 SCADA 接入', '监测点', '1200', '个'),
    N('s32', 's3', 2, '中压管网监测终端', '监测点', '1800', '个'),
  ];
  const S203 = {
    nodes,
    targets: {
      year: 2026,
      strategyReview: '承接战略：三年营收 25 亿元、综合能源占比 15%；今年稳基本盘、做大车用气、培育点供。',
      lastPeriodIssues: '2025 年售气量 5.2 亿方，工商业接驳平均 46 天、流失 3 家大客户；港区缺少加气站，物流车队被竞争对手抢走 12 家；老旧铸铁管泄漏报警同比上升 18%。',
      goals,
    },
  };

  const S201 = {
    valueGap: { target: '售气量 5.8 亿方', baseline: '不做改变自然增长到 5.2 亿方', gap: '6000 万方' },
    themes: [
      { id: 'd1', perspective: 'financial', category: 'grow-new-customer', title: '开拓工商业新用户', metric: '新增售气量', value: '3200 万方', supports: [], goalId: 'g1' },
      { id: 'd2', perspective: 'financial', category: 'grow-new-product', title: '做大车用气', metric: '新增售气量', value: '1800 万方', supports: [], goalId: 'g1' },
      { id: 'd3', perspective: 'financial', category: 'grow-new-market', title: '发展工业点供', metric: '新增售气量', value: '1000 万方', supports: [], goalId: 'g1' },
      { id: 'd4', perspective: 'customer', category: 'availability', title: '工商业用户 30 天接驳', metric: '平均接驳周期', value: '≤30 天', supports: ['d1'], goalId: null },
      { id: 'd5', perspective: 'customer', category: 'availability', title: '物流车队就近加气', metric: '签约车队', value: '60 家', supports: ['d2'], goalId: null },
      { id: 'd6', perspective: 'customer', category: 'quality', title: '点供客户稳定供气', metric: '断供次数', value: '0 次', supports: ['d3'], goalId: null },
      { id: 'd7', perspective: 'process', category: 'operations', title: '加气站网络加密', metric: '新建站点', value: '4 座', supports: ['d5'], goalId: null },
      { id: 'd8', perspective: 'process', category: 'operations', title: '老旧管网改造', metric: '改造长度', value: '120 公里', supports: ['d4'], goalId: null },
      { id: 'd9', perspective: 'process', category: 'customer', title: 'LNG 槽车智能调度', metric: '槽车准点率', value: '98%', supports: ['d6'], goalId: null },
      { id: 'd10', perspective: 'learning', category: 'human', title: '站长与安全人才梯队', metric: '持证站长', value: '30 名', supports: ['d7', 'd8'], goalId: null },
      { id: 'd11', perspective: 'learning', category: 'information', title: '智慧燃气平台一期', metric: '场站覆盖率', value: '60%', supports: ['d9', 'd8'], goalId: null },
    ],
  };

  const kp = (id: string, code: string, name: string, theme: string, objective: string, start: string, end: string, milestones: string, owner: string, sourcePathIds: string[]) => ({ id, code, name, theme, objective, start, end, milestones, owner, sourcePathIds });
  const S208 = {
    projects: [
      kp('kp1', 'KP-01', '高新区工业用户开发', '开拓工商业新用户', '新增售气量 1200 万方，新接驳工业用户 45 户', '2026-01', '2026-12', '3 月完成 20 户意向；6 月通气 25 户；11 月通气 45 户', '赵部长', ['n111']),
      kp('kp2', 'KP-02', '港区与城际物流车队签约', '做大车用气', '签约物流车队 60 家，新增车用气 1100 万方', '2026-01', '2026-12', '3 月签约 25 家；6 月 40 家；9 月 60 家', '王经理', ['n21']),
      kp('kp3', 'KP-03', '城区与港区加气站建设', '做大车用气', '新建并投运 LNG/CNG 合建站 4 座', '2026-02', '2026-11', '4 月完成选址批复；7 月首站投运；11 月 4 座全部投运', '孙工', ['n2']),
      kp('kp4', 'KP-04', '老旧管网三年改造（2026 批次）', '老旧管网改造', '完成铸铁管与老化 PE 管改造 120 公里', '2026-03', '2026-11', '5 月完成 40 公里；8 月 85 公里；11 月 120 公里', '孙工', ['s1']),
      kp('kp5', 'KP-05', '智慧燃气平台一期', '管网智能监测', '上线 SCADA＋GIS＋调度一体化平台，接入监测点 3000 个', '2026-02', '2026-12', '5 月完成选型；9 月试运行；12 月验收', '郑主任', ['s3']),
      kp('kp6', 'KP-06', '产业园 LNG 点供项目群', '发展工业点供', '签约点供项目 18 个，新增售气 600 万方', '2026-01', '2026-12', '4 月签约 6 个；8 月 12 个；12 月 18 个', '马总', ['n31']),
    ],
  };

  const L = (cells: Record<string, string[]>) => Object.fromEntries(Object.entries(cells).map(([name, v]) => [col(org, name), v]));
  const raciColumns = ['战略发展部', '市场营销部', '燃气运营部', '工程建设部', '安全质量部', '综合能源事业部', '财务部', '信息中心'].map((name) => ({ id: col(org, name), name }));
  const S204 = {
    columns: raciColumns,
    rows: [
      { id: 'ra1', name: '高新区工业用户开发', sourceKind: 'project', sourceId: 'kp1', cells: L({ 市场营销部: ['A'], 工程建设部: ['R'], 燃气运营部: ['C'], 财务部: ['I'] }) },
      { id: 'ra2', name: '港区与城际物流车队签约', sourceKind: 'project', sourceId: 'kp2', cells: L({ 燃气运营部: ['A', 'R'], 市场营销部: ['C'], 财务部: ['C'] }) },
      { id: 'ra3', name: '城区与港区加气站建设', sourceKind: 'project', sourceId: 'kp3', cells: L({ 工程建设部: ['A'], 燃气运营部: ['R'], 安全质量部: ['C'], 战略发展部: ['C'], 财务部: ['I'] }) },
      { id: 'ra4', name: '老旧管网三年改造（2026 批次）', sourceKind: 'project', sourceId: 'kp4', cells: L({ 工程建设部: ['A'], 安全质量部: ['R'], 燃气运营部: ['C'], 财务部: ['C'] }) },
      { id: 'ra5', name: '智慧燃气平台一期', sourceKind: 'project', sourceId: 'kp5', cells: L({ 信息中心: ['A'], 燃气运营部: ['R'], 安全质量部: ['C'], 战略发展部: ['I'] }) },
      { id: 'ra6', name: '产业园 LNG 点供项目群', sourceKind: 'project', sourceId: 'kp6', cells: L({ 综合能源事业部: ['A'], 燃气运营部: ['R'], 市场营销部: ['C'], 财务部: ['C'] }) },
    ],
  };

  const U = (id: string, dept: string, role: 'A' | 'R', task: string, metric: string, value: string, sourceRowId: string, purpose: string) => ({ id, deptId: col(org, dept), deptName: dept, role, task, metric, value, sourceRowId, purpose });
  const S205 = {
    rows: [
      U('u1', '市场营销部', 'A', '高新区工业用户开发', '新增售气量', '1200 万方', 'ra1', '开拓工商业新用户，支撑新增售气 6000 万方'),
      U('u2', '工程建设部', 'R', '高新区工业用户开发', '通气用户', '45 户', 'ra1', '按期完成用户接驳工程'),
      U('u3', '燃气运营部', 'A', '港区与城际物流车队签约', '签约车队', '60 家', 'ra2', '做大车用气'),
      U('u4', '工程建设部', 'A', '城区与港区加气站建设', '新建站点', '4 座', 'ra3', '加密加气站网络'),
      U('u5', '燃气运营部', 'R', '城区与港区加气站建设', '新站投运', '4 座', 'ra3', '新站按期投运并达产'),
      U('u6', '工程建设部', 'A', '老旧管网三年改造（2026 批次）', '改造长度', '120 公里', 'ra4', '本质安全'),
      U('u7', '安全质量部', 'R', '老旧管网三年改造（2026 批次）', '泄漏报警下降', '30%', 'ra4', '本质安全'),
      U('u8', '信息中心', 'A', '智慧燃气平台一期', '监测点接入', '3000 个', 'ra5', '管网智能监测'),
      U('u9', '综合能源事业部', 'A', '产业园 LNG 点供项目群', '新增售气量', '600 万方', 'ra6', '培育第二曲线'),
      U('u10', '燃气运营部', 'R', '智慧燃气平台一期', '场站接入', '46 座', 'ra5', '场站数据接入与调度试运行'),
      U('u11', '燃气运营部', 'R', '产业园 LNG 点供项目群', '槽车准点率', '98%', 'ra6', '点供客户稳定供气'),
    ],
  };

  const M = (id: string, parentId: string | null, level: number, path: string, metric: string, value: string, unit: string, goalId: string | null = null) => ({ id, parentId, level, path, metric, value, unit, amount: Number.isFinite(Number(value)) ? Number(value) : null, goalId });
  const S206 = {
    nodes: [
      M('m1', null, 1, '陶瓷企业煤改气', '新增售气量', '700', '万方', 'u1'),
      M('m11', 'm1', 2, '东区 8 家陶瓷厂', '新增售气量', '450', '万方'),
      M('m12', 'm1', 2, '西区 5 家陶瓷厂', '新增售气量', '250', '万方'),
      M('m2', null, 1, '玻璃深加工企业', '新增售气量', '500', '万方', 'u1'),
      M('m3', null, 1, '接驳工程按月排产', '通气用户', '45', '户', 'u2'),
      M('m4', null, 1, '港区集卡车队', '签约车队', '35', '家', 'u3'),
      M('m5', null, 1, '城际干线物流车队', '签约车队', '25', '家', 'u3'),
      M('m6', null, 1, '港区 LNG/CNG 合建站', '新建站点', '2', '座', 'u4'),
      M('m7', null, 1, '城区北部与东部新站', '新建站点', '2', '座', 'u4'),
      M('m8', null, 1, '新站开业营销与达产', '新站投运', '4', '座', 'u5'),
      M('m9', null, 1, '灰口铸铁管更换', '改造长度', '70', '公里', 'u6'),
      M('m10', null, 1, '老化 PE 管与立管更换', '改造长度', '50', '公里', 'u6'),
      M('m13', null, 1, '改造区域泄漏巡检', '泄漏报警下降', '30%', '', 'u7'),
      M('m14', null, 1, '场站 SCADA 接入', '监测点接入', '1200', '个', 'u8'),
      M('m15', null, 1, '中压管网智能监测', '监测点接入', '1800', '个', 'u8'),
      M('m16', null, 1, '高新区与临港产业园点供', '新增售气量', '600', '万方', 'u9'),
      M('m17', null, 1, '场站 SCADA 改造配合', '场站接入', '46', '座', 'u10'),
      M('m18', null, 1, 'LNG 槽车智能排班', '槽车准点率', '98%', '', 'u11'),
    ],
  };

  const card = (dept: string, items: [string, string, string, string, string, string, number, string, string, string][]) => ({
    id: col(org, dept), deptId: col(org, dept), deptName: dept,
    items: items.map(([id, task, metric, definition, floor, target, weight, scoring, source, originId]) => ({ id, task, metric, definition, floor, target, weight, scoring, source, originId })),
  });
  const S207 = {
    cards: [
      card('市场营销部', [['c1', '高新区工业用户开发', '新增售气量（万方）', '高新区新接驳工业用户当年售气量', '1000', '1200', 60, '线性插值，低于保底 0 分', '营销系统', 'u1'], ['c2', '工商业客户满意度', '满意度（分）', '第三方年度测评', '85', '90', 40, '每低 1 分扣 10%', '第三方测评', '']]),
      card('燃气运营部', [['c3', '港区与城际物流车队签约', '签约车队（家）', '年度供气长协车队数', '50', '60', 50, '线性插值', '合同台账', 'u3'], ['c4', '新站开业达产', '新站投运（座）', '当年投运并日销 ≥1 万方', '3', '4', 30, '达成即满分', '运营日报', 'u5'], ['c5', 'LNG 调度保障', '槽车准点率（%）', '按时到达点供客户', '95', '98', 20, '线性插值', '调度系统', 'u11']]),
      card('工程建设部', [['c6', '老旧管网改造', '改造长度（公里）', '当年完工验收长度', '100', '120', 50, '线性插值', '工程台账', 'u6'], ['c7', '加气站建设', '新建站点（座）', '取得验收的站点', '3', '4', 30, '达成即满分', '工程台账', 'u4'], ['c8', '用户接驳', '通气用户（户）', '高新区接驳通气户数', '38', '45', 20, '线性插值', '营销系统', 'u2']]),
      card('信息中心', [['c9', '智慧燃气平台一期', '监测点接入（个）', '平台在线监测点', '2400', '3000', 70, '线性插值', '平台后台', 'u8'], ['c10', '平台可用率', '可用率（%）', '月均可用时间占比', '99', '99.5', 30, '低于保底 0 分', '运维报告', '']]),
      card('综合能源事业部', [['c11', '产业园 LNG 点供项目群', '新增售气量（万方）', '点供项目当年售气量', '480', '600', 70, '线性插值', '营销系统', 'u9'], ['c12', '点供项目签约', '签约项目（个）', '当年签约点供项目', '14', '18', 30, '线性插值', '合同台账', '']]),
    ],
  };

  const wbs = (prefix: string, owner: string, items: [string, string, string, string[]][]) =>
    items.map(([id, name, deliverable, deps]) => {
      const parts = id.split('.');
      return { id: `${prefix}${id}`, parentId: parts.length > 1 ? `${prefix}${parts.slice(0, -1).join('.')}` : null, level: parts.length, name, deliverable, doneDefinition: `${deliverable}经项目经理验收签字`, owner, dependsOn: deps.map((d) => `${prefix}${d}`) };
    });
  const charter = (o: Record<string, any>) => ({
    priority: { fit: 5, roi: 4, urgency: 4, feasibility: 4, resources: 3 },
    inScope: '', outOfScope: '', assumptions: '', risks: [], ...o,
  });
  const S302 = {
    screening: [
      { id: 'sc1', name: '高新区工业用户开发', sourceKind: 'project', sourceId: 'kp1', answers: { crossDept: true, longRunning: true, risky: true, reusable: true }, renamed: '高新区工业用户通气 45 户' },
      { id: 'sc2', name: '港区与城际物流车队签约', sourceKind: 'project', sourceId: 'kp2', answers: { crossDept: true, longRunning: true, risky: false, reusable: true }, renamed: '物流车队长协签约 60 家' },
      { id: 'sc3', name: '城区与港区加气站建设', sourceKind: 'project', sourceId: 'kp3', answers: { crossDept: true, longRunning: true, risky: true, reusable: false }, renamed: '新建加气站 4 座投运' },
      { id: 'sc4', name: '老旧管网三年改造（2026 批次）', sourceKind: 'project', sourceId: 'kp4', answers: { crossDept: true, longRunning: true, risky: true, reusable: true }, renamed: '老旧管网改造 120 公里' },
      { id: 'sc5', name: '智慧燃气平台一期', sourceKind: 'project', sourceId: 'kp5', answers: { crossDept: true, longRunning: true, risky: true, reusable: false }, renamed: '智慧燃气平台一期验收' },
      { id: 'sc6', name: '产业园 LNG 点供项目群', sourceKind: 'project', sourceId: 'kp6', answers: { crossDept: true, longRunning: true, risky: false, reusable: true }, renamed: '点供项目签约 18 个' },
    ],
    charters: [
      charter({ id: 'pc1', screeningId: 'sc1', code: '2026MKTP001', name: '高新区工业用户通气 45 户', theme: '开拓工商业新用户', deptId: col(org, '市场营销部'), deptName: '市场营销部', owner: '赵部长',
        objective: '2026 年 11 月底前高新区新接驳工业用户 45 户，当年新增售气 1200 万方', start: '2026-01', end: '2026-12',
        inScope: '高新区陶瓷、玻璃、食品加工企业的用气开发与接驳', outOfScope: '居民用户与临港化工园区（另立项）', deliverables: '用户开发台账、供用气合同 45 份、接驳工程验收单',
        milestones: '3 月：意向 20 户；6 月：通气 25 户；11 月：通气 45 户', raci: '市场营销部 A/R；工程建设部 R；燃气运营部 C；财务部 I',
        resources: { fte: '专职 4 人、兼职 6 人', budget: '接驳补贴 380 万元', material: '中压调压箱 20 台' },
        risks: [{ id: 'k1', risk: '企业煤改气意愿不足', trigger: '4 月底意向不足 15 户', response: '联合园区管委会出台用气补贴' }, { id: 'k2', risk: '接驳工程排队', trigger: '单户接驳超过 30 天', response: '启用第二施工队并按月排产' }],
        assumptions: '园区燃煤锅炉淘汰政策年内落地', acceptance: { result: '45 户通气、售气 1200 万方', process: '月度经营分析会复盘', close: '12 月结项评审，经验沉淀为《工业用户开发手册》' },
        wbs: wbs('a', '赵部长', [['1', '用户摸排与分级', '重点用户名单（A/B/C 三级）', []], ['1.1', '园区 82 家企业用能调研', '用能调研表', []], ['1.2', '用户分级与拜访计划', '拜访计划', ['1.1']], ['2', '商务签约', '供用气合同', ['1']], ['2.1', '价格与补贴方案', '定价方案（经价格委员会批准）', []], ['2.2', '合同谈判与签约', '合同 45 份', ['2.1']], ['3', '接驳工程', '接驳验收单', ['2']], ['3.1', '设计与报装', '施工图', []], ['3.2', '施工与通气', '通气记录', ['3.1']]]) }),
      charter({ id: 'pc2', screeningId: 'sc2', code: '2026OPSP001', name: '物流车队长协签约 60 家', theme: '做大车用气', deptId: col(org, '燃气运营部'), deptName: '燃气运营部', owner: '王经理',
        objective: '9 月底前与港区及城际物流车队签订年度长协 60 家，新增车用气 1100 万方', start: '2026-01', end: '2026-12',
        inScope: '港区集卡、城际干线 LNG 重卡车队', outOfScope: '公交与出租车（日常运营）', deliverables: '车队长协 60 份、加气卡发放记录',
        milestones: '3 月：25 家；6 月：40 家；9 月：60 家', raci: '燃气运营部 A/R；市场营销部 C；财务部 C',
        resources: { fte: '客户经理 5 人', budget: '价格优惠与营销费用 260 万元', material: '车队加气卡 3000 张' },
        risks: [{ id: 'k3', risk: '柴油价格下跌导致 LNG 经济性下降', trigger: '油气价差小于 1.2 元/公斤', response: '启动阶梯价与里程奖励' }],
        assumptions: '港区新站 7 月投运', acceptance: { result: '签约 60 家、售气 1100 万方', process: '周例会跟踪签约漏斗', close: '12 月结项' },
        wbs: wbs('b', '王经理', [['1', '客户名单与竞对分析', '车队名单（含车辆数、线路）', []], ['2', '长协方案', '长协价格与服务方案', ['1']], ['3', '签约与发卡', '长协 60 份', ['2']], ['3.1', '港区集卡签约', '长协 35 份', []], ['3.2', '城际干线签约', '长协 25 份', []]]) }),
      charter({ id: 'pc3', screeningId: 'sc3', code: '2026ENGP001', name: '新建加气站 4 座投运', theme: '做大车用气', deptId: col(org, '工程建设部'), deptName: '工程建设部', owner: '孙工',
        objective: '11 月底前新建并投运 LNG/CNG 合建站 4 座（港区 2 座、城区 2 座）', start: '2026-02', end: '2026-11',
        inScope: '选址、报批、建设、验收、投运', outOfScope: '既有站点改造', deliverables: '规划许可 4 份、竣工验收报告 4 份、投运记录',
        milestones: '4 月：选址批复；7 月：港区首站投运；11 月：4 座全部投运', raci: '工程建设部 A/R；燃气运营部 R；安全质量部 C；战略发展部 C',
        resources: { fte: '项目经理 2 人、现场工程师 6 人', budget: '建设投资 6400 万元', material: 'LNG 储罐 4 台、加气机 16 台' },
        risks: [{ id: 'k4', risk: '用地审批延迟', trigger: '4 月底未取得 2 座以上批复', response: '启用备选地块并提请市住建局协调' }],
        assumptions: '年度投资计划获董事会批准', acceptance: { result: '4 座投运、日销 ≥1 万方', process: '双周工程例会', close: '竣工验收与后评价' },
        wbs: wbs('c', '孙工', [['1', '选址与报批', '规划许可', []], ['2', '港区站建设', '港区 2 座竣工验收', ['1']], ['3', '城区站建设', '城区 2 座竣工验收', ['1']], ['4', '投运与达产', '投运记录', ['2', '3']]]) }),
      charter({ id: 'pc4', screeningId: 'sc4', code: '2026ENGP002', name: '老旧管网改造 120 公里', theme: '老旧管网改造', deptId: col(org, '工程建设部'), deptName: '工程建设部', owner: '孙工',
        objective: '11 月底前完成灰口铸铁管 70 公里、老化 PE 管与立管 50 公里改造', start: '2026-03', end: '2026-11',
        inScope: '中低压铸铁管、2005 年前敷设的 PE 管、楼栋立管', outOfScope: '高压管线', deliverables: '改造竣工资料、GIS 更新记录',
        milestones: '5 月：40 公里；8 月：85 公里；11 月：120 公里', raci: '工程建设部 A/R；安全质量部 R；燃气运营部 C',
        resources: { fte: '施工队 4 支', budget: '9800 万元（含政府补助 3000 万元）', material: 'PE 管材 130 公里' },
        risks: [{ id: 'k5', risk: '雨季停工', trigger: '6—7 月有效施工日少于 30 天', response: '提前抢工并增加夜间施工' }],
        assumptions: '政府老旧管网补助资金按季拨付', acceptance: { result: '120 公里完工、泄漏报警下降 30%', process: '月度质量巡检', close: '年度安全评估' },
        wbs: wbs('d', '孙工', [['1', '管网普查与排序', '改造清单', []], ['2', '铸铁管更换', '70 公里竣工', ['1']], ['3', 'PE 管与立管更换', '50 公里竣工', ['1']], ['4', 'GIS 更新与资料归档', 'GIS 更新记录', ['2', '3']]]) }),
      charter({ id: 'pc5', screeningId: 'sc5', code: '2026ITP001', name: '智慧燃气平台一期验收', theme: '管网智能监测', deptId: col(org, '信息中心'), deptName: '信息中心', owner: '郑主任',
        objective: '12 月底前上线 SCADA＋GIS＋调度一体化平台，接入监测点 3000 个', start: '2026-02', end: '2026-12',
        inScope: '场站 SCADA、中压管网监测、调度工作台', outOfScope: '客服与收费系统改造', deliverables: '平台上线报告、监测点接入清单、运维手册',
        milestones: '5 月：完成选型；9 月：试运行；12 月：验收', raci: '信息中心 A/R；燃气运营部 R；安全质量部 C',
        resources: { fte: '信息中心 5 人＋厂商 8 人', budget: '2200 万元', material: '物联网监测终端 1800 套' },
        risks: [{ id: 'k6', risk: '老旧场站数据接口不统一', trigger: '8 月接入率低于 60%', response: '加装边缘网关统一协议' }],
        assumptions: '厂商 5 月完成合同签订', acceptance: { result: '3000 点在线、可用率 99.5%', process: '月度里程碑评审', close: '第三方验收' },
        wbs: wbs('e', '郑主任', [['1', '需求与选型', '选型报告', []], ['2', '平台建设', '平台部署', ['1']], ['2.1', 'SCADA 接入', '1200 点接入', []], ['2.2', '管网监测终端安装', '1800 点接入', []], ['3', '试运行与验收', '验收报告', ['2']]]) }),
      charter({ id: 'pc6', screeningId: 'sc6', code: '2026IESP001', name: '点供项目签约 18 个', theme: '发展工业点供', deptId: col(org, '综合能源事业部'), deptName: '综合能源事业部', owner: '马总',
        objective: '12 月底前签约产业园 LNG 点供项目 18 个，新增售气 600 万方', start: '2026-01', end: '2026-12',
        inScope: '管网未覆盖的产业园与工业企业', outOfScope: '乡镇居民集中供气（另立项）', deliverables: '点供合同 18 份、气化站验收报告',
        milestones: '4 月：6 个；8 月：12 个；12 月：18 个', raci: '综合能源事业部 A/R；燃气运营部 R；市场营销部 C；财务部 C',
        resources: { fte: '项目经理 3 人', budget: '气化撬装设备投资 1500 万元', material: '撬装气化站 18 套' },
        risks: [{ id: 'k7', risk: 'LNG 气源价格冬季上涨', trigger: '11 月接收站报价上涨超过 15%', response: '签订冬季保供长协并预留储备' }],
        assumptions: '槽车运力满足 18 个站点', acceptance: { result: '18 个签约、售气 600 万方', process: '季度经营分析会', close: '12 月结项' },
        wbs: wbs('f', '马总', [['1', '项目开发', '项目清单', []], ['2', '签约', '点供合同 18 份', ['1']], ['3', '气化站建设与供气', '气化站验收报告', ['2']]]) }),
    ],
  };
  // The charters must carry their RACI and dept consistently; the key-project codes follow 年份＋职能＋P＋序号.

  const node = (id: string, name: string, time: string, owner: string, status: string, deps: string[], deliverable: string) => ({ id, name, time, owner, status, dependsOn: deps, deliverable, acceptance: `${deliverable}经项目经理书面验收` });
  const S305 = {
    scale: 'month',
    rows: [
      { id: 'pr1', charterId: 'pc1', name: '2026MKTP001 高新区工业用户通气 45 户', nodes: [node('x1', '意向 20 户', '2026-03', '赵部长', 'done', [], '意向书 20 份'), node('x2', '通气 25 户', '2026-06', '赵部长', 'in_progress', ['x1'], '通气记录 25 户'), node('x3', '通气 45 户', '2026-11', '赵部长', 'planned', ['x2'], '通气记录 45 户')] },
      { id: 'pr2', charterId: 'pc2', name: '2026OPSP001 物流车队长协签约 60 家', nodes: [node('x4', '签约 25 家', '2026-03', '王经理', 'done', [], '长协 25 份'), node('x5', '签约 40 家', '2026-06', '王经理', 'in_progress', ['x4'], '长协 40 份'), node('x6', '签约 60 家', '2026-09', '王经理', 'planned', ['x5'], '长协 60 份')] },
      { id: 'pr3', charterId: 'pc3', name: '2026ENGP001 新建加气站 4 座投运', nodes: [node('x7', '选址批复', '2026-04', '孙工', 'done', [], '规划许可 4 份'), node('x8', '港区首站投运', '2026-07', '孙工', 'planned', ['x7'], '首站投运记录'), node('x9', '4 座全部投运', '2026-11', '孙工', 'planned', ['x8'], '投运记录 4 份')] },
      { id: 'pr4', charterId: 'pc4', name: '2026ENGP002 老旧管网改造 120 公里', nodes: [node('x10', '完成 40 公里', '2026-05', '孙工', 'done', [], '竣工资料 40 公里'), node('x11', '完成 85 公里', '2026-08', '孙工', 'in_progress', ['x10'], '竣工资料 85 公里'), node('x12', '完成 120 公里', '2026-11', '孙工', 'planned', ['x11'], '竣工资料 120 公里')] },
      { id: 'pr5', charterId: 'pc5', name: '2026ITP001 智慧燃气平台一期验收', nodes: [node('x13', '完成选型', '2026-05', '郑主任', 'done', [], '选型报告'), node('x14', '试运行', '2026-09', '郑主任', 'planned', ['x13'], '试运行报告'), node('x15', '验收', '2026-12', '郑主任', 'planned', ['x14'], '验收报告')] },
      { id: 'pr6', charterId: 'pc6', name: '2026IESP001 点供项目签约 18 个', nodes: [node('x16', '签约 6 个', '2026-04', '马总', 'done', [], '点供合同 6 份'), node('x17', '签约 12 个', '2026-08', '马总', 'planned', ['x16'], '点供合同 12 份'), node('x18', '签约 18 个', '2026-12', '马总', 'planned', ['x17'], '点供合同 18 份')] },
    ],
  };

  const res = (charterId: string, rows: [string, string, string, string, string, string, boolean][]) =>
    rows.map(([category, need, stock, gap, approach, owner, major]) => ({ id: `${charterId}${category[0]}`, charterId, category, need, stock, gap, approach, owner, major, none: gap === '0' }));
  const S306 = {
    rows: [
      ...res('pc1', [['people', '专职 4 人', '2 人', '2 人', '内部竞聘＋校招', '人力资源部', false], ['finance', '接驳补贴 380 万元', '预算 300 万元', '80 万元', '申请园区补贴', '财务部', false], ['material', '调压箱 20 台', '库存 8 台', '12 台', '集中采购', '工程建设部', false], ['it', '营销系统工单', '现有', '0', '', '', false]]),
      ...res('pc2', [['people', '客户经理 5 人', '3 人', '2 人', '从城区站调配', '燃气运营部', false], ['finance', '营销费用 260 万元', '预算 260 万元', '0', '', '', false], ['material', '加气卡 3000 张', '1000 张', '2000 张', '定制采购', '燃气运营部', false], ['it', '车队管理小程序', '无', '1 套', '外包开发', '信息中心', false]]),
      ...res('pc3', [['people', '工程师 6 人', '4 人', '2 人', '外聘监理', '工程建设部', false], ['finance', '投资 6400 万元', '已批 5000 万元', '1400 万元', '申请董事会追加', '财务部', true], ['material', '储罐 4 台、加气机 16 台', '0', '全部', '公开招标', '工程建设部', true], ['it', '站控系统', '现有标准', '0', '', '', false]]),
      ...res('pc4', [['people', '施工队 4 支', '3 支', '1 支', '框架协议队伍', '工程建设部', false], ['finance', '9800 万元', '6800 万元＋补助 3000 万元', '0', '', '', true], ['material', 'PE 管材 130 公里', '框架协议', '0', '', '', false], ['it', 'GIS 更新', '现有', '0', '', '', false]]),
      ...res('pc5', [['people', '信息中心 5 人＋厂商 8 人', '3 人', '2 人', '社招数据工程师', '人力资源部', false], ['finance', '2200 万元', '已批 2200 万元', '0', '', '', true], ['material', '监测终端 1800 套', '0', '1800 套', '公开招标', '信息中心', true], ['it', '云资源', '私有云', '扩容 40%', '年度扩容预算', '信息中心', false]]),
      ...res('pc6', [['people', '项目经理 3 人', '1 人', '2 人', '从工程建设部调配', '人力资源部', false], ['finance', '设备投资 1500 万元', '已批 1200 万元', '300 万元', '融资租赁', '财务部', false], ['material', '撬装气化站 18 套', '6 套', '12 套', '框架采购', '综合能源事业部', false], ['it', '槽车调度', '现有', '0', '', '', false]]),
    ],
  };

  const S307 = {
    text: {
      lastYear: '2025 年售气量 5.2 亿方、营业收入 18.6 亿元，安全形势总体平稳；但工商业接驳慢、港区缺站、老旧铸铁管泄漏报警上升，暴露出“接得慢、站不够、管子老”三块短板。',
      environment: '长三角制造业煤改气持续推进，LNG 重卡在港口集疏运中渗透率快速提升；气源价格冬季波动加大，城燃行业进入“存量精细化＋增量综合能源”的新阶段。',
      summary: '2026 年以“稳基本盘、做大车用气、培育点供”为主线，6 个关键项目支撑新增售气 6000 万方、营业收入 20.5 亿元、重大安全事故为零。',
      risks: '气源价格波动：签订冬季保供长协；用地审批延迟：启用备选地块；施工旺季人手不足：框架协议队伍兜底。',
      notDo: '不做跨省长输管道；不做单纯气源贸易；不做与主业无关的多元化投资。',
      dictionaryNote: '指标口径以《瀚川燃气经营指标字典（2026 版）》为准。',
    },
  };
  const deptBook = (dept: string, summary: string) => ({
    id: col(org, dept), deptId: col(org, dept), deptName: dept, summary,
    lastYear: S307.text.lastYear, environment: S307.text.environment, risks: S307.text.risks, notDo: S307.text.notDo, dictionaryNote: '',
  });
  const S308 = {
    depts: [
      deptBook('市场营销部', '市场营销部 2026 年牵头高新区工业用户开发，全年新接驳工业用户 45 户、新增售气 1200 万方；工商业客户满意度达到 90 分。'),
      deptBook('燃气运营部', '燃气运营部 2026 年主攻车用气，9 月底前签约物流车队 60 家；配合新站投运并在三个月内达产；LNG 槽车准点率 98%。'),
      deptBook('工程建设部', '工程建设部 2026 年完成老旧管网改造 120 公里、新建加气站 4 座，并按月排产保障 45 户工业用户通气。'),
      deptBook('信息中心', '信息中心 2026 年建成智慧燃气平台一期，接入监测点 3000 个，平台可用率 99.5%。'),
      deptBook('综合能源事业部', '综合能源事业部 2026 年签约产业园 LNG 点供项目 18 个，新增售气 600 万方，为第二曲线打基础。'),
    ],
  };

  return { 'S1-01': S101, 'S1-02': S102, 'S1-03': S103, 'S1-06': S106, 'S1-07': S107, 'S2-03': S203, 'S2-01': S201, 'S2-08': S208, 'S2-04': S204, 'S2-05': S205, 'S2-06': S206, 'S2-07': S207, 'S3-02': S302, 'S3-05': S305, 'S3-06': S306, 'S3-07': S307, 'S3-08': S308 } as Record<string, unknown>;
}
