import { nocobaseClient } from "@nocobase/portal-sdk/client";

import type { ProjectRole } from "@dingze/shared";

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
};
