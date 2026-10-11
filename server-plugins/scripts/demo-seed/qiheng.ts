// 启衡能源科技有限公司 · 2027 年度战略落地 — a fictional commercial & industrial energy-storage and
// EV-charging company, mid-way through 定目标责 (S2).

type Org = Record<string, number>;
const col = (org: Org, name: string) => `org-${org[name]}`;

export function qiheng2027(org: Org) {
  const S101 = {
    primary: 'sixfold',
    mission: '让每一度绿电都用得更划算',
    vision: '2030 年成为华东工商业储能与充换电运营服务的首选伙伴',
    values: '客户价值 · 安全可靠 · 长期主义 · 开放协作',
    strategicGoals:
      '2027 年：营业收入 4.6 亿元，储能新增装机 180 MWh，充电量 1.2 亿千瓦时，安全事故 0 起；2029 年：营业收入 8 亿元，运维服务收入占比 25%；2030 年：营业收入 10 亿元，管理储能资产 1.5 GWh。',
    strategyChoice:
      '聚焦长三角工商业用户侧储能（EPC＋合同能源管理），以物流园与公交场站充换电运营做现金流，以智慧运维平台沉淀长期收入。不做：大型电网侧储能电站投资、户用光伏、电池制造。',
    indicatorSystem:
      '财务：营业收入、毛利率、经营性现金流；客户：新增签约容量、客户续约率；内部流程：项目交付周期、设备可用率；学习与成长：持证运维工程师、平台接入资产规模。',
    stepsAndMeasures:
      '2027 打样板：工商业储能新增 180 MWh、合作物流园 12 个、运维平台接入 300 MWh；2028 扩区域：进入苏南与浙北，签约容量翻番；2029 做服务：运维服务收入占比 25%。',
    goals: { y1: '营收 4.6 亿元，储能新增 180 MWh', y3: '营收 8 亿元，运维收入占比 25%', y5: '营收 10 亿元，管理储能 1.5 GWh' },
    battlefields: [
      { id: 'b1', name: '工商业用户侧储能', mustWin: '新增签约 180 MWh', advantage: '峰谷套利测算模型与 EPC 交付周期 75 天' },
      { id: 'b2', name: '物流园与公交场站充换电', mustWin: '充电量 1.2 亿千瓦时', advantage: '与 3 家头部物流园的独家合作' },
      { id: 'b3', name: '智慧运维服务', mustWin: '平台接入 300 MWh', advantage: '自研 EMS 与远程诊断' },
    ],
    foundation: { talent: '持证运维工程师从 22 人增至 60 人', organization: '按区域设立苏南、浙北两个交付中心', mechanism: '项目跟投与全生命周期利润分享' },
  };
  const S102 = {
    objectives: [
      { id: 'o1', perspective: 'financial', title: '营业收入 4.6 亿元', note: '同比 +44%' },
      { id: 'o2', perspective: 'financial', title: '毛利率 22%', note: '' },
      { id: 'o3', perspective: 'customer', title: '工商业客户算得清、愿意签', note: '新增签约 180 MWh' },
      { id: 'o4', perspective: 'customer', title: '物流园司机愿意来充', note: '单桩日均 9 小时' },
      { id: 'o5', perspective: 'process', title: '储能项目 75 天交付', note: '' },
      { id: 'o6', perspective: 'process', title: '充换电场站高可用', note: '可用率 99%' },
      { id: 'o7', perspective: 'learning', title: '运维工程师梯队', note: '60 人持证' },
      { id: 'o8', perspective: 'learning', title: 'EMS 智慧运维平台', note: '接入 300 MWh' },
    ],
    links: [
      { id: 'r1', from: 'o3', to: 'o1', kind: 'cause' },
      { id: 'r2', from: 'o4', to: 'o1', kind: 'cause' },
      { id: 'r3', from: 'o5', to: 'o3', kind: 'cause' },
      { id: 'r4', from: 'o6', to: 'o4', kind: 'cause' },
      { id: 'r5', from: 'o7', to: 'o6', kind: 'cause' },
      { id: 'r6', from: 'o8', to: 'o5', kind: 'cause' },
      { id: 'r7', from: 'o8', to: 'o6', kind: 'cause' },
      { id: 'r8', from: 'o1', to: 'o2', kind: 'synergy' },
    ],
  };
  const S103 = {
    levelNote: '充换电在事业部层面是单元战略',
    strategies: [
      { id: 's1', statement: '深耕长三角工商业用户侧储能', tactics: [{ id: 't1', text: '高耗能园区“峰谷套利＋需量管理”方案', path: '' }, { id: 't2', text: '合同能源管理（EMC）降低客户门槛', path: '' }] },
      { id: 's2', statement: '以充换电运营做稳定现金流', tactics: [{ id: 't3', text: '物流园独家合作', path: '' }, { id: 't4', text: '公交场站夜间充电', path: '' }] },
      { id: 's3', statement: '用智慧运维沉淀长期收入', tactics: [{ id: 't5', text: '自研 EMS 远程诊断', path: '' }, { id: 't6', text: '第三方储能代运维', path: '' }] },
    ],
  };
  const S106 = {
    kpis: [
      { id: 'p1', theme: '经营结果', name: '营业收入', definition: '合并报表营业收入', unit: '亿元', source: '财务报表', period: '季', owner: '财务部' },
      { id: 'p2', theme: '工商业储能', name: '储能新增签约容量', definition: '当年新签合同储能容量', unit: 'MWh', source: '合同台账', period: '月', owner: '储能事业部' },
      { id: 'p3', theme: '充换电', name: '充电量', definition: '自营场站全年充电量', unit: '万千瓦时', source: '运营平台', period: '月', owner: '充换电事业部' },
      { id: 'p4', theme: '智慧运维', name: '平台接入容量', definition: 'EMS 平台在线管理的储能容量', unit: 'MWh', source: 'EMS 平台', period: '月', owner: '运维服务部' },
    ],
  };
  const S107 = {
    years: [2027, 2028, 2029, 2030],
    rows: [
      { id: 'y1', kpiId: 'p1', theme: '经营结果', name: '营业收入', unit: '亿元', values: { '2027': '4.6', '2028': '6.2', '2029': '8', '2030': '10' }, baseline: '3.2', benchmark: '5', challenge: '5' },
      { id: 'y2', kpiId: 'p2', theme: '工商业储能', name: '储能新增签约容量', unit: 'MWh', values: { '2027': '180', '2028': '260', '2029': '330', '2030': '400' }, baseline: '96', benchmark: '220', challenge: '210' },
      { id: 'y3', kpiId: 'p3', theme: '充换电', name: '充电量', unit: '万千瓦时', values: { '2027': '12000', '2028': '16000', '2029': '20000', '2030': '24000' }, baseline: '7800', benchmark: '15000', challenge: '13500' },
      { id: 'y4', kpiId: 'p4', theme: '智慧运维', name: '平台接入容量', unit: 'MWh', values: { '2027': '300', '2028': '600', '2029': '1000', '2030': '1500' }, baseline: '140', benchmark: '500', challenge: '350' },
    ],
  };
  const N = (id: string, parentId: string | null, level: number, path: string, metric: string, value: string, unit: string, extra: Record<string, unknown> = {}) => ({
    id, parentId, level, path, metric, value, unit, amount: Number.isFinite(Number(value)) ? Number(value) : null, goalId: null as string | null, ...extra,
  });
  const goals = [
    { id: 'g1', perspective: 'financial', task: '营业收入达到 4.6 亿元', purpose: '规模翻番的第一年', metric: '营业收入', value: '4.6', unit: '亿元', sourceRowId: 'y1' },
    { id: 'g2', perspective: 'customer', task: '储能新增签约 180 MWh', purpose: '用户侧储能做成长三角样板', metric: '新增签约容量', value: '180', unit: 'MWh', sourceRowId: 'y2' },
  ];
  // Returned by the consultant: “储能 EPC 收入”的下级合计 2.6 ≠ 2.8（推不回来），to fix in S2 路径.
  const nodes = [
    N('n1', null, 1, '储能 EPC 收入', '营业收入', '2.8', '亿元', { goalId: 'g1', perspective: 'financial', groupTag: '提高客户价值 › 开发新客户' }),
    N('n11', 'n1', 2, '苏南高耗能园区', '营业收入', '1.6', '亿元'),
    N('n12', 'n1', 2, '浙北制造业客户', '营业收入', '1.0', '亿元'),
    N('n2', null, 1, '充换电运营收入', '营业收入', '1.2', '亿元', { goalId: 'g1', perspective: 'financial', groupTag: '增加收入机会 › 业务' }),
    N('n21', 'n2', 2, '物流园场站', '营业收入', '0.8', '亿元'),
    N('n22', 'n2', 2, '公交场站', '营业收入', '0.4', '亿元'),
    N('n3', null, 1, '运维服务收入', '营业收入', '0.6', '亿元', { goalId: 'g1', perspective: 'financial', groupTag: '增加收入机会 › 经营模式' }),
    N('n31', 'n3', 2, '自有项目运维', '营业收入', '0.35', '亿元'),
    N('n32', 'n3', 2, '第三方储能代运维', '营业收入', '0.25', '亿元'),
    N('c1', null, 1, '高耗能园区 EMC 签约', '新增签约容量', '120', 'MWh', { goalId: 'g2', perspective: 'customer' }),
    N('c11', 'c1', 2, '苏州工业园', '新增签约容量', '70', 'MWh'),
    N('c12', 'c1', 2, '嘉兴经开区', '新增签约容量', '50', 'MWh'),
    N('c2', null, 1, '存量客户扩容', '新增签约容量', '60', 'MWh', { goalId: 'g2', perspective: 'customer', groupTag: '提高客户价值 › 提高单客户价值' }),
    N('c21', 'c2', 2, '苏南存量客户', '新增签约容量', '35', 'MWh'),
    N('c22', 'c2', 2, '浙北存量客户', '新增签约容量', '25', 'MWh'),
  ];
  const S203 = {
    nodes,
    targets: {
      year: 2027,
      strategyReview: '承接战略：三年营收 8 亿元、运维收入占比 25%；今年打样板。',
      lastPeriodIssues: '2026 年营收 3.2 亿元，储能项目交付平均 112 天，两个物流园场站可用率低于 95%。',
      goals,
    },
  };
  const S201 = {
    valueGap: { target: '营业收入 4.6 亿元', baseline: '存量业务自然增长到 3.5 亿元', gap: '1.1 亿元' },
    themes: [
      { id: 'd1', perspective: 'financial', category: 'grow-new-customer', title: '储能 EPC 新客户', metric: '营业收入', value: '2.8 亿元', supports: [], goalId: 'g1' },
      { id: 'd2', perspective: 'financial', category: 'grow-new-product', title: '充换电运营', metric: '营业收入', value: '1.2 亿元', supports: [], goalId: 'g1' },
      { id: 'd3', perspective: 'financial', category: 'grow-channel', title: '运维服务', metric: '营业收入', value: '0.6 亿元', supports: [], goalId: 'g1' },
      { id: 'd4', perspective: 'customer', category: 'price', title: '峰谷套利算得清', metric: '投资回收期', value: '≤5 年', supports: ['d1'], goalId: null },
      { id: 'd5', perspective: 'customer', category: 'availability', title: '司机就近有桩', metric: '单桩日均时长', value: '9 小时', supports: ['d2'], goalId: null },
      { id: 'd6', perspective: 'process', category: 'operations', title: '储能项目 75 天交付', metric: '交付周期', value: '75 天', supports: ['d4'], goalId: null },
      { id: 'd7', perspective: 'process', category: 'operations', title: '场站高可用', metric: '可用率', value: '99%', supports: ['d5'], goalId: null },
      { id: 'd8', perspective: 'learning', category: 'information', title: 'EMS 平台远程诊断', metric: '接入容量', value: '300 MWh', supports: ['d6', 'd7'], goalId: null },
      { id: 'd9', perspective: 'learning', category: 'human', title: '运维工程师 60 人持证', metric: '持证人数', value: '60 人', supports: ['d7'], goalId: null },
    ],
  };
  const S208 = {
    projects: [
      { id: 'kp1', code: 'KP-01', name: '苏州工业园 EMC 储能项目群', theme: '储能 EPC 新客户', objective: '签约 70 MWh，年内并网 40 MWh', start: '2027-01', end: '2027-12', milestones: '3 月签约 30 MWh；7 月 70 MWh；12 月并网 40 MWh', owner: '孙经理', sourcePathIds: ['c11'] },
      { id: 'kp2', code: 'KP-02', name: '嘉兴经开区储能样板', theme: '储能 EPC 新客户', objective: '签约 50 MWh', start: '2027-02', end: '2027-11', milestones: '5 月首单；11 月累计 50 MWh', owner: '孙经理', sourcePathIds: ['c12'] },
      { id: 'kp3', code: 'KP-03', name: '物流园充换电场站提质', theme: '充换电运营', objective: '12 个场站可用率 99%，充电量 8000 万千瓦时', start: '2027-01', end: '2027-12', milestones: '4 月完成设备体检；9 月可用率 99%', owner: '吴经理', sourcePathIds: ['n21'] },
      { id: 'kp4', code: 'KP-04', name: 'EMS 运维平台 2.0', theme: '运维服务', objective: '接入 300 MWh，远程诊断覆盖 90% 告警', start: '2027-03', end: '2027-12', milestones: '6 月上线；12 月接入 300 MWh', owner: '冯经理', sourcePathIds: ['n3'] },
    ],
  };
  const L = (cells: Record<string, string[]>) => Object.fromEntries(Object.entries(cells).map(([name, v]) => [col(org, name), v]));
  const S204 = {
    columns: ['战略投资部', '储能事业部', '充换电事业部', '运维服务部', '财务部'].map((name) => ({ id: col(org, name), name })),
    rows: [
      { id: 'ra1', name: '苏州工业园 EMC 储能项目群', sourceKind: 'project', sourceId: 'kp1', cells: L({ 储能事业部: ['A'], 运维服务部: ['R'], 财务部: ['C'], 战略投资部: ['C'] }) },
      { id: 'ra2', name: '嘉兴经开区储能样板', sourceKind: 'project', sourceId: 'kp2', cells: L({ 储能事业部: ['A', 'R'], 财务部: ['C'] }) },
      // Still being worked out in the demo: no A yet on the charging row.
      { id: 'ra3', name: '物流园充换电场站提质', sourceKind: 'project', sourceId: 'kp3', cells: L({ 充换电事业部: ['R'], 运维服务部: ['R'] }) },
      { id: 'ra4', name: 'EMS 运维平台 2.0', sourceKind: 'project', sourceId: 'kp4', cells: L({ 运维服务部: ['A'], 储能事业部: ['C'] }) },
    ],
  };
  return { 'S1-01': S101, 'S1-02': S102, 'S1-03': S103, 'S1-06': S106, 'S1-07': S107, 'S2-03': S203, 'S2-01': S201, 'S2-08': S208, 'S2-04': S204 } as Record<string, unknown>;
}
