import { useAclState } from "@nocobase/portal-sdk/acl";
import { useGetIdentity } from "@refinedev/core";

type Identity = { roles?: { name: string }[] };

/**
 * The account's system roles (dz_ops, dz_consultant, dz_ent_admin …). The identity does not always
 * carry them, so what the permission check reports is merged in (测试反馈 9：运营账号被显示成“普通员工”).
 */
export function useSystemRoles(): { roles: string[]; isLoading: boolean } {
  const acl = useAclState();
  const identity = useGetIdentity<Identity>();
  const fromAcl = acl.status === "ready" ? acl.permissions.roles : [];
  const fromIdentity = (identity.data?.roles ?? []).map((r) => r.name);
  return {
    roles: [...new Set([...fromAcl, ...fromIdentity])],
    isLoading: acl.status === "idle" || acl.status === "loading" || identity.isLoading,
  };
}
