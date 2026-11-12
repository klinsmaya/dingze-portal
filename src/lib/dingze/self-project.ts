import { selfProjectAllowed } from "@dingze/shared";

import type { Enterprise } from "./ops-api";
import { useEnterprises } from "./ops-queries";
import { useSystemRoles } from "./system-roles";

/**
 * 当前账号能替哪家企业自建项目：企业管理员（不含运营，运营在运营管理里建），企业没停用，
 * 运营也没有把这家企业的自建项目关掉。没有就返回 undefined。
 */
export function useSelfProjectEnterprise(): Enterprise | undefined {
  const { roles } = useSystemRoles();
  const isEntAdmin = roles.includes("dz_ent_admin") && !roles.includes("dz_ops");
  const enterprises = useEnterprises(isEntAdmin);
  if (!isEntAdmin) return undefined;
  return (enterprises.data ?? []).find((e) => e.status !== "suspended" && selfProjectAllowed(e));
}
