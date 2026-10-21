import type { ProjectRole } from './lifecycle';
import type { ProfileItem } from './materials';

type StartupUnit = { name: string; kind: string; headId?: number | null; headName?: string | null };
type StartupMember = { userId: number; nickname: string; projectRole: ProjectRole; orgUnitId: number | null };

// 项目启动 (闭环第一批): three things every project needs before the first table — the same for
// 训练营 and 企业内训. Nothing here blocks work; it tells who still has to do what, and where.

export type StartupState = 'done' | 'partial' | 'todo';
/** `problems` keep an item from being ready; `notes` are worth knowing but do not. */
export type StartupItem = { key: 'org' | 'materials' | 'team'; title: string; state: StartupState; detail: string; problems: string[]; notes: string[] };

const CONSULTANTS: ProjectRole[] = ['lead_consultant', 'co_consultant'];

export function startupChecklist(input: {
  orgUnits: StartupUnit[];
  team: StartupMember[];
  materialCount: number;
  profileItems: Pick<ProfileItem, 'status'>[];
}): StartupItem[] {
  const { orgUnits, team, materialCount, profileItems } = input;
  const enterprise = team.filter((m) => !CONSULTANTS.includes(m.projectRole));
  const depts = orgUnits.filter((u) => u.kind === 'department');

  const org: string[] = [];
  if (!depts.length) org.push('还没有部门：请企业管理员在「本企业 › 组织部门」里建好');
  // A head is optional: not every department head has an account here.
  const headless = depts.filter((d) => !d.headId && !d.headName);
  const orgNotes = headless.length ? [`${headless.map((d) => d.name).join('、')} 还没写负责人（责任分工里的 A 要由人填写）`] : [];
  // Heading a unit (often the 总经理 heading the company) counts as being placed.
  const floating = enterprise.filter((m) => !m.orgUnitId && !orgUnits.some((u) => u.headId === m.userId));
  if (floating.length) org.push(`${floating.map((m) => m.nickname).join('、')} 还没归到部门`);

  const material: string[] = [];
  if (!materialCount) material.push('还没有资料：先上传企业简介、组织架构、战略规划或年度经营计划');
  const confirmed = profileItems.filter((i) => i.status === 'confirmed').length;
  if (!profileItems.length) material.push('企业画像还是空的：可以让数字咨询师从资料里起草');
  else if (!confirmed) material.push('画像还没有一条经企业项目负责人确认');

  const people: string[] = [];
  if (!team.some((m) => m.projectRole === 'ent_lead')) people.push('还没有企业项目负责人：只有他能确认定版');
  if (depts.length && !team.some((m) => m.projectRole === 'dept_head')) people.push('还没有部门负责人参与：部门承接和部门计划书需要他们');

  const state = (problems: string[], started: boolean): StartupState => (!problems.length ? 'done' : started ? 'partial' : 'todo');
  return [
    {
      key: 'org',
      title: '组织与职责',
      state: state(org, depts.length > 0),
      detail: depts.length ? `${depts.length} 个部门 · ${enterprise.length - floating.length} / ${enterprise.length} 人已归部门` : '未建部门',
      problems: org,
      notes: orgNotes,
    },
    {
      key: 'materials',
      title: '资料与画像',
      state: state(material, materialCount > 0 || profileItems.length > 0),
      detail: `${materialCount} 份资料 · 画像 ${profileItems.length} 条（已确认 ${confirmed}）`,
      problems: material,
      notes: [],
    },
    {
      key: 'team',
      title: '团队与角色',
      state: state(people, team.length > 0),
      detail: `${enterprise.length} 位企业成员 · ${team.length - enterprise.length} 位咨询师`,
      problems: people,
      notes: [],
    },
  ];
}
