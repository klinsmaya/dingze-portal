// 项目启动 demo data (idempotent): department heads, every enterprise member in a department,
// three materials and a reviewed + confirmed profile per project — so “项目启动” reads 3 / 3 on the
// finished projects. Uses the formal dingze actions only; nothing secret is printed.
import fs from 'node:fs';
import { IDS_FILE, call, ok } from './api.mjs';

const OPS = 'dz_yun';
const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
const log = (...a) => console.log(...a);

const users = Object.fromEntries((await ok(OPS, 'dingze:listUsers')).map((u) => [u.username, u.id]));

/** Heads by department name, then each listed member's department in the given projects. */
async function organise(enterpriseId, heads, placements) {
  const detail = await ok(OPS, `dingze:enterpriseDetail?enterpriseId=${enterpriseId}`);
  const unit = Object.fromEntries(detail.orgUnits.map((u) => [u.name, u]));
  for (const [name, username] of Object.entries(heads)) {
    const u = unit[name];
    if (!u || u.headId === users[username]) continue;
    await ok(OPS, 'dingze:saveOrgUnit', { enterpriseId, id: u.id, name: u.name, kind: u.kind, parentId: u.parentId, headId: users[username] });
    log('head', name, '←', username);
  }
  for (const project of detail.projects) {
    const members = project.members.map((m) => ({ userId: m.userId, projectRole: m.projectRole, orgUnitId: m.orgUnitId }));
    let changed = false;
    for (const m of members) {
      const username = Object.keys(users).find((k) => users[k] === m.userId);
      const dept = placements[username];
      if (dept && unit[dept] && m.orgUnitId !== unit[dept].id) {
        m.orgUnitId = unit[dept].id;
        changed = true;
      }
    }
    if (changed) {
      await ok(OPS, 'dingze:setProjectMembers', { projectId: project.id, members });
      log('members placed in project', project.id);
    }
  }
}

await organise(1, { 战略发展部: 'dz_zhang', 燃气运营部: 'dz_wang', 调度中心: 'dz_liu', 财务部: 'dz_zhou' }, { dz_zhang: '战略发展部' });
await organise(3, { 战略投资部: 'dz_qian', 储能事业部: 'dz_sun', 财务部: 'dz_he' }, { dz_qian: '战略投资部', dz_sun: '储能事业部', dz_he: '财务部' });

const HANCHUAN = [
  ['瀚川燃气企业简介', '瀚川燃气有限公司成立于 2003 年，是区域性城市燃气运营商，主营管道天然气、车用 LNG / CNG 和工商业综合能源服务。2025 年售气量 5.2 亿方、营业收入 18.6 亿元，居民用户 62 万户、工商业用户 3,400 户，运营门站 6 座、加气站 14 座，员工 1,180 人。'],
  ['组织架构与部门职责', '总经理下设：战略发展部（战略规划、年度经营计划、投资管理）；市场营销部（工商业与居民用户开发、客户服务、价格管理）；燃气运营部（输配运行、调度中心、管网巡检）；工程建设部（管网与场站工程、项目管理）；安全质量部（安全生产、质量与应急）；综合能源事业部（分布式能源、LNG 点供、充换电）；财务部；人力资源部；信息中心（智慧燃气平台、数据管理）。'],
  ['2025 年经营分析会纪要（摘要）', '全年售气量 5.2 亿方，同比 +6%；工商业新接驳偏慢（全年 31 户，目标 45 户），主要卡在报装周期长；港区缺加气站，物流车队客户流失约 8%；老旧铸铁管 120 公里，漏报警上升。2026 年要求：新增售气 1,200 万方、工商业新接驳 45 户、城区与港区新建加气站 4 座、启动老旧管网三年改造。'],
];
const QIHENG = [
  ['启衡能源企业简介', '启衡能源科技有限公司成立于 2019 年，聚焦工商业储能（EPC 与合同能源管理）、充换电站运营和储能运维服务，主要市场在苏南、浙北。2026 年预计营业收入 3.1 亿元，累计储能签约 260 MWh，运营充换电站 38 座，员工 210 人。'],
  ['组织架构与部门职责', '总经理下设：战略投资部（战略、投融资、年度计划）；储能事业部（工商业储能 EPC 与 EMC 开发、交付）；充换电事业部（场站拓展与运营）；运维服务部（自有与第三方储能代运维）；财务部；人力资源部。'],
  ['2026 年经营复盘（摘要）', '储能 EPC 收入 2.1 亿元，苏南高耗能园区贡献六成；浙北制造业客户签约周期长、回款慢；充换电单站利用率 31%，物流园场站好于公交场站；运维服务刚起步，第三方代运维 3 个项目。2027 年董事会目标：营业收入 4.6 亿元、新增储能签约 180 MWh。'],
];

/** Materials once by title; the profile once, reviewed by the consultant and confirmed by the lead. */
async function materialsAndProfile(projectId, space, lead, consultant, docs, profile) {
  const have = await ok(lead, `dingze:listMaterials?projectId=${projectId}`, undefined, { space });
  const titles = new Map((have ?? []).map((m) => [m.title, m.id]));
  for (const [title, text] of docs) {
    if (titles.has(title)) continue;
    const r = await ok(lead, 'dingze:addMaterial', { projectId, title, kind: 'note', text }, { space });
    titles.set(title, r.id);
    log('material', projectId, title);
  }
  const current = await ok(lead, `dingze:getProfile?projectId=${projectId}`, undefined, { space });
  if ((current?.items ?? []).length) return;
  const items = profile.map(([category, topic, content, sourceTitle], i) => ({
    id: `pf-demo-${projectId}-${i}`,
    category,
    topic,
    content,
    source: String(titles.get(sourceTitle) ?? ''),
    status: 'reviewed',
  }));
  const saved = await ok(consultant, 'dingze:saveProfile', { projectId, items, baseRev: current?.rev ?? 0 }, { space });
  const confirmed = saved.items.map((it) => (it.category === 'fact' ? { ...it, status: 'confirmed' } : it));
  await ok(lead, 'dingze:saveProfile', { projectId, items: confirmed, baseRev: saved.rev }, { space });
  log('profile', projectId, items.length);
}

const S1 = 'dz-017728e2ab';
const S3 = 'dz-f54028e96a';
const hanchuanProfile = [
  ['fact', '规模', '2025 年售气量 5.2 亿方、营业收入 18.6 亿元，居民 62 万户、工商业 3,400 户', '瀚川燃气企业简介'],
  ['fact', '短板', '工商业新接驳慢（31 / 45 户）、港区缺站、老旧铸铁管 120 公里', '2025 年经营分析会纪要（摘要）'],
  ['assumption', '增长', '长三角制造业“煤改气”和 LNG 重卡还能带来每年 5% 以上的增量', '2025 年经营分析会纪要（摘要）'],
  ['unknown', '气源', '冬季气源价格波动对综合能源业务毛利的影响幅度', ''],
];
for (const pid of [1, ids.p3].filter(Boolean)) await materialsAndProfile(pid, S1, 'dz_zhang', 'dz_chen', HANCHUAN, hanchuanProfile);
await materialsAndProfile(2, S3, 'dz_qian', 'dz_chen', QIHENG, [
  ['fact', '规模', '2026 年预计营收 3.1 亿元，累计储能签约 260 MWh，运营充换电站 38 座', '启衡能源企业简介'],
  ['fact', '结构', '储能 EPC 收入 2.1 亿元，苏南高耗能园区占六成；浙北签约周期长、回款慢', '2026 年经营复盘（摘要）'],
  ['assumption', '运维', '第三方储能代运维 2027 年能做到 0.25 亿元', '2026 年经营复盘（摘要）'],
  ['todo', '资料', '请补充各充换电场站的利用率明细表', ''],
]);
log('done');
