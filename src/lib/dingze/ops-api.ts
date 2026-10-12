import { nocobaseClient } from "@nocobase/portal-sdk/client";

import type { ArtifactStatus, ProjectRole, StartupState } from "@dingze/shared";

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
  members: DzUser[];
};

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
export type CampAccountResult = { ok: boolean; nickname: string; username: string; role?: ProjectRole; initialPassword?: string | null; existed?: boolean; error?: string };

export const opsApi = {
  opsBoard: () => get<OpsBoard>("opsBoard"),
  listEnterprises: () => get<(Enterprise & { projects?: OpsProject[] })[]>("listEnterprises"),
  enterpriseDetail: (enterpriseId: number) => get<EnterpriseDetail>("enterpriseDetail", { enterpriseId }),
  provisionEnterprise: (values: {
    name: string;
    shortName: string;
    size: "large" | "sme";
    consultantIds: number[];
    admin?: { username: string; nickname: string; email?: string; phone?: string };
  }) =>
    post<{ enterprise: Enterprise; spaceName: string; admin: CreatedAccount | null }>("provisionEnterprise", values),
  updateEnterprise: (values: { enterpriseId: number } & Partial<Pick<Enterprise, "name" | "shortName" | "size" | "status">>) =>
    post<Enterprise>("updateEnterprise", values),
  addEnterpriseMembers: (values: { enterpriseId: number; userIds: number[] }) => post("addEnterpriseMembers", values),
  removeEnterpriseMember: (values: { enterpriseId: number; userId: number }) => post("removeEnterpriseMember", values),
  saveOrgUnit: (values: {
    enterpriseId: number;
    id?: number;
    name: string;
    kind?: OrgUnit["kind"];
    parentId?: number | null;
    headId?: number | null;
    headName?: string | null;
    duty?: string | null;
    sort?: number;
  }) => post<OrgUnit>("saveOrgUnit", values),
  importOrgUnits: (values: { enterpriseId: number; rows: { name: string; parent?: string; kind?: string; head?: string; duty?: string }[] }) =>
    post<{ created: number; updated: number; changes: number }>("importOrgUnits", values),
  setMemberDepartment: (values: { enterpriseId: number; userId: number; orgUnitId: number | null }) => post<{ updated: number }>("setMemberDepartment", values),
  deleteOrgUnit: (values: { enterpriseId: number; id: number }) => post("deleteOrgUnit", values),
  listUsers: (query: { q?: string; role?: SystemRole } = {}) => get<DzUser[]>("listUsers", query),
  createUser: (values: {
    username: string;
    nickname: string;
    email?: string;
    phone?: string;
    systemRole: SystemRole;
    enterpriseId?: number;
  }) => post<CreatedAccount>("createUser", values),
  resetPassword: (values: { userId: number; enterpriseId?: number }) =>
    post<{ initialPassword: string }>("resetPassword", values),
  createProject: (values: Partial<OpsProject> & { enterpriseId: number; name: string; members?: { userId: number; projectRole: ProjectRole; orgUnitId?: number }[] }) =>
    post<OpsProject>("createProject", values),
  updateProject: (values: Partial<OpsProject> & { projectId: number }) => post<OpsProject>("updateProject", values),
  setProjectMembers: (values: { projectId: number; members: { userId: number; projectRole: ProjectRole; orgUnitId?: number | null }[] }) =>
    post("setProjectMembers", values),
  removeProjectMember: (values: { projectId: number; userId: number }) => post("removeProjectMember", values),
  listCamps: () => get<Camp[]>("listCamps"),
  campDetail: (campId: number) => get<CampDetail>("campDetail", { campId }),
  saveCamp: (values: Partial<Camp> & { name: string }) => post<Camp>("saveCamp", values),
  campEnroll: (values: {
    campId: number;
    year?: number;
    projectName?: string;
    leadConsultantId?: number;
    coConsultantIds?: number[];
    rows: { name: string; shortName: string; size: "large" | "sme"; adminNickname: string; adminUsername: string; adminPhone?: string }[];
  }) => post<{ results: CampEnrollResult[] }>("campEnroll", values),
  campAttach: (values: { campId: number | null; projectIds: number[] }) => post<{ updated: number }>("campAttach", values),
  campAccounts: (values: { projectId: number; rows: { nickname: string; username: string; phone?: string; email?: string; role: ProjectRole; dept?: string }[] }) =>
    post<{ results: CampAccountResult[] }>("campAccounts", values),
  campRemind: (values: { campId: number; projectIds?: number[] }) => post<{ sent: number }>("campRemind", values),
  campClose: (values: { campId: number; projects: { projectId: number; service: "guided" | "self" }[] }) => post<{ updated: number }>("campClose", values),
};
