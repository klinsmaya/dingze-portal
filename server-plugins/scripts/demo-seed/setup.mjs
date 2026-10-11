// Demo org setup (idempotent): names, departments, extra accounts, project 3, memberships.
// Generated passwords go to $DINGZE_SECRETS_DIR/<user>.pw only; nothing secret is printed.
import fs from 'node:fs';
import { IDS_FILE, call, ok, remember } from './api.mjs';

const OPS = 'dz_yun';
const log = (...a) => console.log(...a);

await ok(OPS, 'dingze:updateEnterprise', { enterpriseId: 1, name: '瀚川燃气有限公司', shortName: '瀚川燃气', size: 'large' });
await ok(OPS, 'dingze:updateEnterprise', { enterpriseId: 3, name: '启衡能源科技有限公司', shortName: '启衡能源', size: 'sme' });
await ok(OPS, 'dingze:updateProject', { projectId: 1, name: '2026 年度战略落地', primaryExpression: 'sixfold' });
await ok(OPS, 'dingze:updateProject', { projectId: 2, name: '2027 年度战略落地', primaryExpression: 'sixfold' });

async function units(enterpriseId, wanted) {
  const detail = await ok(OPS, `dingze:enterpriseDetail?enterpriseId=${enterpriseId}`);
  const have = new Map(detail.orgUnits.map((u) => [u.name, u.id]));
  for (const [name, kind, parent, sort] of wanted) {
    if (have.has(name)) continue;
    const r = await ok(OPS, 'dingze:saveOrgUnit', { enterpriseId, name, kind, parentId: parent ? have.get(parent) : null, sort });
    have.set(name, r.id ?? r?.unit?.id);
  }
  const after = await ok(OPS, `dingze:enterpriseDetail?enterpriseId=${enterpriseId}`);
  return Object.fromEntries(after.orgUnits.map((u) => [u.name, u.id]));
}
const org1 = await units(1, [
  ['战略发展部', 'department', null, 1], ['市场营销部', 'department', null, 2], ['燃气运营部', 'department', null, 3], ['调度中心', 'team', '燃气运营部', 4],
  ['工程建设部', 'department', null, 5], ['安全质量部', 'department', null, 6], ['综合能源事业部', 'department', null, 7], ['财务部', 'department', null, 8],
  ['人力资源部', 'department', null, 9], ['信息中心', 'department', null, 10],
]);
const org3 = await units(3, [
  ['战略投资部', 'department', null, 1], ['储能事业部', 'department', null, 2], ['充换电事业部', 'department', null, 3], ['运维服务部', 'department', null, 4],
  ['财务部', 'department', null, 5], ['人力资源部', 'department', null, 6],
]);
log('org1', JSON.stringify(org1));
log('org3', JSON.stringify(org3));

const users = Object.fromEntries((await ok(OPS, 'dingze:listUsers')).map((u) => [u.username, u.id]));
async function user(username, nickname, systemRole, enterpriseId, caller = OPS) {
  if (users[username]) return users[username];
  const r = await ok(caller, 'dingze:createUser', { username, nickname, systemRole, ...(enterpriseId ? { enterpriseId } : {}) });
  remember(username, r.initialPassword);
  users[username] = r.user.id;
  log('created', username);
  return r.user.id;
}
await user('dz_zhou', '周总监', 'dz_ent_member', 1);
await user('dz_sun', '孙经理', 'dz_ent_member', 3);
await user('dz_he', '何总监', 'dz_ent_member', 3);
await user('dz_guan', '关主任', 'dz_consult_admin', null, 'admin');
for (const e of [1, 3]) await ok(OPS, 'dingze:addEnterpriseMembers', { enterpriseId: e, userIds: [users.dz_guan, users.dz_li, users.dz_chen].filter(Boolean) });

const p1Members = [
  { userId: users.dz_zhang, projectRole: 'ent_lead' },
  { userId: users.dz_wang, projectRole: 'dept_head', orgUnitId: org1['燃气运营部'] },
  { userId: users.dz_liu, projectRole: 'member', orgUnitId: org1['调度中心'] },
  { userId: users.dz_zhou, projectRole: 'readonly', orgUnitId: org1['财务部'] },
  { userId: users.dz_chen, projectRole: 'lead_consultant' },
  { userId: users.dz_li, projectRole: 'co_consultant' },
];
await ok(OPS, 'dingze:setProjectMembers', { projectId: 1, members: p1Members });
// The platform admin was added to project 1 during early wiring; a real project wouldn't list it.
const detail1 = await ok(OPS, 'dingze:enterpriseDetail?enterpriseId=1');
if (detail1.projects.find((p) => p.id === 1)?.members.some((m) => m.userId === 1)) {
  const r = await call(OPS, 'dingze:removeProjectMember', { projectId: 1, userId: 1 });
  log('remove admin from p1', r.status);
}
await ok(OPS, 'dingze:setProjectMembers', {
  projectId: 2,
  members: [
    { userId: users.dz_qian, projectRole: 'ent_lead' },
    { userId: users.dz_sun, projectRole: 'dept_head', orgUnitId: org3['储能事业部'] },
    { userId: users.dz_he, projectRole: 'readonly', orgUnitId: org3['财务部'] },
    { userId: users.dz_chen, projectRole: 'lead_consultant' },
    { userId: users.dz_li, projectRole: 'co_consultant' },
  ],
});
let p3 = detail1.projects.find((p) => p.year === 2027);
if (!p3) {
  p3 = await ok(OPS, 'dingze:createProject', { enterpriseId: 1, name: '2027 年度战略落地（滚动规划）', year: 2027, scene: 'camp', keyProjectLevel: 2, scheduleScale: 'month', members: p1Members });
  log('created project', p3.id ?? JSON.stringify(p3).slice(0, 80));
}
fs.writeFileSync(IDS_FILE, JSON.stringify({ org1, org3, users, p3: p3.id }, null, 1));
log('done');
