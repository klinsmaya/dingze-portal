import type Database from '@nocobase/database';

import { accountKind, defaultLeadId, normalizeProjectRole } from '../../shared';

// 0.41.0 统一加人和项目成员之后，把老数据对齐一次。每一步都可以重复跑：对齐过的不再动。
//
// 1. 项目角色只留三种：部门负责人并入项目成员，主咨询师、协作咨询师并入咨询师；只读成员不再是角色，
//    移出项目成员（本企业账号没加进项目本来就能只读查看）。邀请码上记的角色同样对齐：
//    “部门负责人”的改项目成员，“只读成员”的改为只加入企业。
// 2. 运营管理员、咨询管理员进入所有企业的空间。
// 3. 账号归到企业、部门归到人：企业侧账号记下属于哪家企业；部门取这个人在本企业各项目里最常用的那个，
//    并把他在本企业各项目里的部门统一成它。
// 4. 没有企业项目负责人的项目，补上企业管理员（有多位取最早开通的）。

const STAFF_ROLES = ['dz_ops', 'dz_consult_admin'];

const roleNames = (user: any): string[] => ((user.get('roles') ?? []) as any[]).map((r) => r.get('name') as string);

export async function alignMembers(db: Database, log: (message: string) => void) {
  await alignRoles(db, log);
  const enterprises: any[] = await db.getRepository('dz_enterprises').find({ sort: ['id'] });
  if (!enterprises.length) return;
  await staffIntoSpaces(db, enterprises, log);
  await accountsAndDepartments(db, enterprises, log);
  await fillLeads(db, enterprises, log);
}

async function alignRoles(db: Database, log: (message: string) => void) {
  const members = db.getRepository('dz_project_members');
  const old: any[] = await members.find({ filter: { projectRole: { $notIn: ['ent_lead', 'member', 'consultant'] } } });
  let changed = 0;
  let removed = 0;
  for (const row of old) {
    const role = normalizeProjectRole(row.get('projectRole'));
    if (role) {
      await row.update({ projectRole: role });
      changed++;
    } else {
      await row.destroy();
      removed++;
    }
  }
  if (changed || removed) log(`dingze: project roles aligned to three (${changed} changed, ${removed} read-only members removed from projects)`);

  const invites: any[] = await db.getRepository('dz_invites').find({ filter: { projectRole: { $notIn: ['ent_lead', 'member'] }, projectId: { $notEmpty: true } } });
  for (const invite of invites) {
    const role = normalizeProjectRole(invite.get('projectRole'));
    // 旧的“只读成员”码：只加入企业，不再绑项目。
    await invite.update(role === 'member' ? { projectRole: 'member' } : { projectRole: null, projectId: null });
  }
  if (invites.length) log(`dingze: ${invites.length} invite(s) aligned to the new roles`);
}

async function spaceUsers(db: Database, spaceName: string): Promise<any[]> {
  return db.getRepository('spaces.users', spaceName).find({ appends: ['roles'], sort: ['id'] });
}

async function staffIntoSpaces(db: Database, enterprises: any[], log: (message: string) => void) {
  const staff: any[] = await db.getRepository('users').find({ filter: { 'roles.name': { $in: STAFF_ROLES } }, fields: ['id'] });
  const staffIds = [...new Set(staff.map((u) => u.get('id') as number))];
  if (!staffIds.length) return;
  let added = 0;
  for (const enterprise of enterprises) {
    const spaceName = enterprise.get('spaceName') as string;
    if (!spaceName) continue;
    const inSpace = new Set((await spaceUsers(db, spaceName)).map((u) => u.get('id') as number));
    const missing = staffIds.filter((id) => !inSpace.has(id));
    if (!missing.length) continue;
    await db.getRepository('spaces.users', spaceName).add({ tk: missing });
    added += missing.length;
  }
  if (added) log(`dingze: ops and consulting admins joined every enterprise space (${added} membership(s) added)`);
}

async function accountsAndDepartments(db: Database, enterprises: any[], log: (message: string) => void) {
  const accounts = db.getRepository('dz_accounts');
  const members = db.getRepository('dz_project_members');
  let placed = 0;
  let departments = 0;
  for (const enterprise of enterprises) {
    const enterpriseId = enterprise.get('id') as number;
    const spaceName = enterprise.get('spaceName') as string;
    if (!spaceName) continue;
    const people = (await spaceUsers(db, spaceName)).filter((u) => accountKind(roleNames(u)) === 'enterprise');
    if (!people.length) continue;
    const projectIds = (await db.getRepository('dz_projects').find({ filter: { enterpriseId }, fields: ['id'] })).map((p: any) => p.get('id') as number);
    const unitIds = new Set((await db.getRepository('dz_org_units').find({ filter: { enterpriseId }, fields: ['id'] })).map((u: any) => u.get('id') as number));
    for (const user of people) {
      const userId = user.get('id') as number;
      const account: any = await accounts.findOne({ filter: { userId } });
      if (account?.get('enterpriseId') && account.get('enterpriseId') !== enterpriseId) {
        log(`dingze: account ${userId} is in the space of enterprise ${enterpriseId} but belongs to enterprise ${account.get('enterpriseId')}; left as is, please check`);
        continue;
      }
      // 对齐过的账号（已经记了企业）不再动：之后部门由人来改。
      if (account?.get('enterpriseId')) continue;
      const rows: any[] = projectIds.length ? await members.find({ filter: { userId, projectId: { $in: projectIds } } }) : [];
      const counts = new Map<number, number>();
      for (const row of rows) {
        const unit = row.get('orgUnitId') as number | null;
        if (unit && unitIds.has(unit)) counts.set(unit, (counts.get(unit) ?? 0) + 1);
      }
      const orgUnitId = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
      await db.sequelize.transaction(async (transaction: any) => {
        if (account) await account.update({ enterpriseId, orgUnitId: account.get('orgUnitId') ?? orgUnitId }, { transaction });
        else await accounts.create({ values: { userId, enterpriseId, orgUnitId }, transaction });
        const unit = (account?.get('orgUnitId') as number | null) ?? orgUnitId;
        for (const row of rows) if ((row.get('orgUnitId') ?? null) !== unit) await row.update({ orgUnitId: unit }, { transaction });
      });
      placed++;
      if (orgUnitId) departments++;
    }
  }
  if (placed) log(`dingze: ${placed} enterprise account(s) recorded with their enterprise, ${departments} with a department`);
}

async function fillLeads(db: Database, enterprises: any[], log: (message: string) => void) {
  const members = db.getRepository('dz_project_members');
  let filled = 0;
  for (const enterprise of enterprises) {
    const enterpriseId = enterprise.get('id') as number;
    const spaceName = enterprise.get('spaceName') as string;
    const projects: any[] = await db.getRepository('dz_projects').find({ filter: { enterpriseId } });
    const missing: any[] = [];
    for (const project of projects) {
      if (!(await members.count({ filter: { projectId: project.get('id'), projectRole: 'ent_lead' } }))) missing.push(project);
    }
    if (!missing.length || !spaceName) continue;
    const admins = (await spaceUsers(db, spaceName)).filter((u) => roleNames(u).includes('dz_ent_admin'));
    const disabled = new Set(
      (admins.length ? await db.getRepository('dz_accounts').find({ filter: { userId: { $in: admins.map((u) => u.get('id')) }, disabledAt: { $notEmpty: true } } }) : []).map(
        (a: any) => a.get('userId') as number,
      ),
    );
    const leadId = defaultLeadId(admins.filter((u) => !disabled.has(u.get('id'))).map((u) => ({ id: u.get('id') as number, createdAt: u.get('createdAt') })));
    if (!leadId) {
      log(`dingze: enterprise ${enterpriseId} has ${missing.length} project(s) without an enterprise lead and no enterprise admin to fill in`);
      continue;
    }
    const account: any = await db.getRepository('dz_accounts').findOne({ filter: { userId: leadId } });
    for (const project of missing) {
      const projectId = project.get('id') as number;
      const existing: any = await members.findOne({ filter: { projectId, userId: leadId } });
      if (existing) await existing.update({ projectRole: 'ent_lead' });
      else await members.create({ values: { projectId, userId: leadId, projectRole: 'ent_lead', orgUnitId: account?.get('orgUnitId') ?? null, spaceName: project.get('spaceName') } });
      filled++;
    }
  }
  if (filled) log(`dingze: ${filled} project(s) without an enterprise lead now have the enterprise admin as lead`);
}
