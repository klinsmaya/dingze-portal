import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { getPortalBase } from "@nocobase/portal-sdk/runtime";

import type { ProjectRole } from "@dingze/shared";

// 邀请码注册（审核制）。checkInvite / registerWithInvite / registrationStatus 不需要登录，服务端限流；
// 其余给企业管理员和运营。

export type InviteScope = { enterprise: string; project: string | null; role: string | null; dept: string | null };

export type Invite = {
  id: number;
  code: string;
  projectId: number | null;
  projectName: string | null;
  projectRole: ProjectRole | null;
  orgUnitId: number | null;
  orgUnitName: string | null;
  maxUses: number;
  used: number;
  expiresAt: string | null;
  status: "active" | "disabled";
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type RegistrationStatus = "pending" | "approved" | "rejected";

export type Registration = {
  id: number;
  inviteId: number;
  nickname: string;
  username: string;
  phone: string | null;
  email: string | null;
  remark: string | null;
  status: RegistrationStatus;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type InviteInput = {
  enterpriseId: number;
  id?: number;
  projectId?: number | null;
  projectRole?: ProjectRole | null;
  orgUnitId?: number | null;
  maxUses?: number;
  expiresAt?: string | null;
  status?: "active" | "disabled";
  note?: string;
};

const get = <T>(action: string, query: Record<string, string | number | undefined> = {}) =>
  nocobaseClient.action<T>("dingze", action, { method: "GET", query });
const post = <T>(action: string, body: unknown) => nocobaseClient.action<T>("dingze", action, { body });

export const inviteApi = {
  checkInvite: (code: string) => get<InviteScope>("checkInvite", { code }),
  register: (values: { code: string; nickname: string; username: string; password: string; phone?: string; email?: string; remark?: string }) =>
    post<{ status: "pending"; enterprise: string }>("registerWithInvite", values),
  registrationStatus: (account: string) => get<{ status: "pending" | "rejected" | "none" }>("registrationStatus", { account }),
  listInvites: (enterpriseId: number) => get<{ invites: Invite[]; registrations: Registration[] }>("listInvites", { enterpriseId }),
  saveInvite: (values: InviteInput) => post<Invite>("saveInvite", values),
  reviewRegistration: (values: { enterpriseId: number; id: number; approve: boolean; reason?: string }) =>
    post<{ status: RegistrationStatus }>("reviewRegistration", values),
};

/** The register link carrying a code, under the Portal's own base path. */
export function inviteLink(code: string): string {
  const base = getPortalBase().replace(/\/+$/, "");
  return `${window.location.origin}${base}/register?code=${encodeURIComponent(code)}`;
}

/** Same rules as the server: 8–64 chars with letters and digits. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "至少 8 位";
  if (password.length > 64) return "不能超过 64 位";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "要同时包含字母和数字";
  return null;
}
