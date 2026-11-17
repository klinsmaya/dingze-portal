import { nocobaseClient } from "@nocobase/portal-sdk/client";

import type { AccountKind, ArtifactStatus, MemberTier, ProjectRole, StartupState } from "@dingze/shared";

// 运营管理 endpoints. Each names its enterprise or project explicitly and the plugin
// checks the caller's space membership and system role, so no x-spaces header is needed.

export const SYSTEM_ROLE_LABELS = {
  dz_consult_admin: "咨询管理员",
  dz_consultant: "咨询师",
  dz_ent_admin: "企业管理员",
  dz_ent_member: "企业成员",
  dz_ops: "运营管理员",
} as const;
export type SystemRole = keyof typeof SYSTEM_ROLE_LABELS;

export type DzUser = {
  id: number;
  username: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  roles: SystemRole[];
  /** 账号已停用：不能登录，数据和项目成员身份都留着。 */
  disabled?: boolean;
};

/** 企业里的一个人：企业成员（本企业账号）或咨询师（分派来的咨询方账号）。运营管理员不在这里。 */
export type EnterpriseMember = DzUser & {
  kind: AccountKind;
  /** 所属部门，记在人身上，对本企业所有项目生效。 */
  orgUnitId: number | null;
  disabled: boolean;
  /** 还在用初始密码，第一次登录要先改。 */
  mustChangePassword: boolean;
  createdAt: string | null;
};

export type EnterpriseStatus = "active" | "suspended";

export type Enterprise = {
  id: number;
  name: string;
  shortName: string;
  size: "large" | "sme";
  status: EnterpriseStatus;
  spaceName: string;
  createdAt: string;
  /** 企业管理员默认可以自建项目（企业内训 · 自助）；运营按企业关掉后为 true。用 selfProjectAllowed() 判断。 */
  selfProjectOff?: boolean;
  /** 客户在首页自助注册的试用企业。 */
  trial?: boolean;
  /** 能用的企业管理员有几位；0 位的企业要标出来。只在企业列表里有。 */
  adminCount?: number;
  /** 待审核的注册申请有几条。只在企业列表里有。 */
  pendingRegistrations?: number;
};

export type OpsProject = {
  id: number;
  name: string;
  year: number;
  scene: "camp" | "inhouse";
  service?: "guided" | "self";
  primaryExpression: "house" | "sixfold";
  keyProjectLevel: 1 | 2;
  scheduleScale: "month" | "quarter";
  status: "active" | "archived";
};

export type ProjectMember = {
  userId: number;
  projectRole: ProjectRole;
  orgUnitId: number | null;
  user: { id: number; username: string; nickname: string } | null;
};

export type OrgUnit = {
  id: number;
  name: string;
  kind: "company" | "department" | "team";
  /** 企业自己的层级叫法（事业部、中心…）；用内置叫法时为空。 */
  kindName?: string | null;
  sort: number;
  parentId: number | null;
  headId: number | null;
  /** 负责人没有账号时的姓名。 */
  headName?: string | null;
  /** 部门职责，供 RACI 等表参考。 */
  duty?: string | null;
};

export type EnterpriseDetail = {
  enterprise: Enterprise;
  projects: (OpsProject & { members: ProjectMember[] })[];
  orgUnits: OrgUnit[];
  /** 企业成员和咨询师，按 kind 分两组。 */
  members: EnterpriseMember[];
  /** 还没被分派到本企业项目的咨询管理员：分派咨询师时也可以选他们。 */
  consultAdmins: EnterpriseMember[];
};

/** 项目里的“成员”：有谁、当前登录的人是哪一级、能分派什么、还能加谁。 */
export type ProjectMembers = {
  projectId: number;
  enterpriseId: number;
  projectName: string;
  service: "guided" | "self";
  tier: MemberTier | null;
  assignable: ProjectRole[];
  members: { userId: number; projectRole: ProjectRole; orgUnitId: number | null; nickname: string; username: string }[];
  candidates: { id: number; nickname: string; username: string; kind: AccountKind; orgUnitId: number | null }[];
  orgUnits: { id: number; name: string; parentId: number | null }[];
};

export type AccountRow = { nickname: string; username: string; phone?: string; email?: string; dept?: string };
export type AccountResult = { ok: boolean; nickname: string; username: string; initialPassword?: string | null; existed?: boolean; error?: string };

export type CreatedAccount = { user: DzUser; initialPassword: string };

const get = <T>(action: string, query: Record<string, string | number | undefined> = {}) =>
  nocobaseClient.action<T>("dingze", action, { method: "GET", query });
const post = <T>(action: string, body: unknown) =>
  nocobaseClient.action<T>("dingze", action, { body });

export type OpsBoardProject = {
  id: number;
  name: string;
  year: number;
  enterpriseId: number;
  campId?: number | null;
  stages: { key: string; name: string; locked: number; total: number }[];
  backlog: { stepDone: number; inReview: number; pendingConfirm: number; stale: number; comments: number };
  lastActivityAt: string | null;
  usage: {
    turns: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    turns30: number;
    tokens30: number;
    users: number;
    lastAt: string | null;
  } | null;
};

export type OpsBoard = {
  enterprises: Pick<Enterprise, "id" | "name" | "shortName" | "status">[];
  projects: OpsBoardProject[];
};

export type CampStatus = "planning" | "running" | "closed";

export type Camp = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  status: CampStatus;
  /** 今日目标表：现场看板按这几张表看进度。 */
  focusCodes: string[];
  note: string | null;
  projectCount?: number;
};

export type CampProject = {
  id: number;
  name: string;
  year: number;
  scene: "camp" | "inhouse";
  service: "guided" | "self";
  enterprise: { id: number; name: string; shortName: string };
  members: { userId: number; nickname: string; projectRole: ProjectRole }[];
  enterpriseMembers: number;
  startup: { key: "org" | "materials" | "team"; title: string; state: StartupState; detail: string; problems: string[] }[];
  stages: OpsBoardProject["stages"];
  focus: { code: string; status: ArtifactStatus }[];
  stuck: { stepDone: number; inReview: number; pendingConfirm: number; stale: number; comments: number };
  exports: number;
  lockedTotal: number;
  lastActivityAt: string | null;
  usage: OpsBoardProject["usage"];
};

export type CampDetail = { camp: Camp; projects: CampProject[] };

export type CampEnrollResult = { ok: boolean; enterprise: string; projectId?: number; username?: string; initialPassword?: string | null; error?: string };

export const opsApi = {
  opsBoard: () => get<OpsBoard>("opsBoard"),
  listEnterprises: () => get<(Enterprise & { projects?: OpsProject[] })[]>("listEnterprises"),
  enterpriseDetail: (enterpriseId: number) => get<EnterpriseDetail>("enterpriseDetail", { enterpriseId }),
  provisionEnterprise: (values: {
    name: string;
    shortName: string;
    size: "large" | "sme";
    consultantIds: number[];
    /** 必填：企业至少要有一位管理员。 */
    admin: { username: string; nickname: string; email?: string; phone?: string };
  }) =>
    post<{ enterprise: Enterprise; spaceName: string; admin: CreatedAccount | null }>("provisionEnterprise", values),
  updateEnterprise: (values: { enterpriseId: number } & Partial<Pick<Enterprise, "name" | "shortName" | "size" | "status">> & { allowSelfProject?: boolean }) =>
    post<Enterprise>("updateEnterprise", values),
  addEnterpriseMembers: (values: { enterpriseId: number; userIds: number[] }) => post("addEnterpriseMembers", values),
  removeEnterpriseMember: (values: { enterpriseId: number; userId: number }) => post("removeEnterpriseMember", values),
  /** 设为 / 取消企业管理员（运营）。 */
  setEnterpriseAdmin: (values: { enterpriseId: number; userId: number; admin: boolean }) => post("setEnterpriseAdmin", values),
  /** 停用 / 恢复账号。带 enterpriseId：运营和本企业管理员；不带：运营管咨询方账号。 */
  setAccountDisabled: (values: { enterpriseId?: number; userId: number; disabled: boolean }) => post<{ ok: boolean; disabled: boolean }>("setAccountDisabled", values),
  saveOrgUnit: (values: {
    enterpriseId: number;
    /** 在项目「资料」页维护时带上（企业项目负责人、咨询师）。 */
    projectId?: number;
    id?: number;
    name: string;
    kind?: OrgUnit["kind"];
    kindName?: string | null;
    parentId?: number | null;
    headId?: number | null;
    headName?: string | null;
    duty?: string | null;
    sort?: number;
  }) => post<OrgUnit>("saveOrgUnit", values),
  importOrgUnits: (values: { enterpriseId: number; projectId?: number; rows: { name: string; parent?: string; kind?: string; kindName?: string | null; head?: string; duty?: string }[] }) =>
    post<{ created: number; updated: number; changes: number }>("importOrgUnits", values),
  setMemberDepartment: (values: { enterpriseId: number; userId: number; orgUnitId: number | null }) => post<{ updated: number }>("setMemberDepartment", values),
  deleteOrgUnit: (values: { enterpriseId: number; projectId?: number; id: number }) => post("deleteOrgUnit", values),
  listUsers: (query: { q?: string; role?: SystemRole } = {}) => get<DzUser[]>("listUsers", query),
  createUser: (values: {
    username: string;
    nickname: string;
    email?: string;
    phone?: string;
    systemRole: SystemRole;
    enterpriseId?: number;
    /** 开通后直接加进这些项目（项目成员）。 */
    projectIds?: number[];
    orgUnitId?: number | null;
  }) => post<CreatedAccount>("createUser", values),
  /** 批量开通企业成员，并加进选中的项目；登录名已是本企业账号的只加进项目。 */
  createUsers: (values: { enterpriseId: number; projectIds?: number[]; rows: AccountRow[] }) => post<{ results: AccountResult[] }>("createUsers", values),
  resetPassword: (values: { userId: number; enterpriseId?: number }) =>
    post<{ initialPassword: string }>("resetPassword", values),
  createProject: (values: Partial<OpsProject> & { enterpriseId: number; name: string; members?: { userId: number; projectRole: ProjectRole }[] }) =>
    post<OpsProject>("createProject", values),
  updateProject: (values: Partial<OpsProject> & { projectId: number }) => post<OpsProject>("updateProject", values),
  /** 企业管理员自建项目：企业内训 · 自助，只分派企业侧角色。 */
  createOwnProject: (values: { enterpriseId: number; name: string; year: number; members: { userId: number; projectRole: ProjectRole }[] }) =>
    post<OpsProject>("createOwnProject", values),
  projectMembers: (projectId: number) => get<ProjectMembers>("projectMembers", { projectId }),
  setProjectMembers: (values: { projectId: number; members: { userId: number; projectRole: ProjectRole }[] }) => post("setProjectMembers", values),
  removeProjectMember: (values: { projectId: number; userId: number }) => post("removeProjectMember", values),
  /** 归档 / 恢复：运营，和本企业的企业管理员。 */
  setProjectArchived: (values: { projectId: number; archived: boolean }) => post<OpsProject & { invitesDisabled?: number }>("setProjectArchived", values),
  /** 删除项目，不可恢复；confirmName 要和项目名称一致。 */
  deleteProject: (values: { projectId: number; confirmName: string }) =>
    post<{ ok: boolean; removed: Record<string, number>; files: number; filesFailed: number }>("deleteProject", values),
  listCamps: () => get<Camp[]>("listCamps"),
  campDetail: (campId: number) => get<CampDetail>("campDetail", { campId }),
  saveCamp: (values: Partial<Camp> & { name: string }) => post<Camp>("saveCamp", values),
  campEnroll: (values: {
    campId: number;
    year?: number;
    projectName?: string;
    consultantIds?: number[];
    rows: { name: string; shortName: string; size: "large" | "sme"; adminNickname: string; adminUsername: string; adminPhone?: string }[];
  }) => post<{ results: CampEnrollResult[] }>("campEnroll", values),
  campAttach: (values: { campId: number | null; projectIds: number[] }) => post<{ updated: number }>("campAttach", values),
  campRemind: (values: { campId: number; projectIds?: number[] }) => post<{ sent: number }>("campRemind", values),
  campInvites: (values: { campId: number; projectIds?: number[] }) =>
    post<{ results: { projectId: number; enterprise: string; code: string; maxUses: number; expiresAt: string | null; created: boolean }[] }>("campInvites", values),
  campClose: (values: { campId: number; projects: { projectId: number; service: "guided" | "self" }[] }) => post<{ updated: number }>("campClose", values),
};
