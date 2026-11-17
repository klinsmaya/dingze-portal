import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";

import { nocobaseClient } from "@nocobase/portal-sdk/client";

/** 当前账号的两件事：停用了没有，是不是还在用别人发的初始密码（要先改）。 */
export type AccountStatus = { disabled: boolean; mustChangePassword: boolean };

export const accountApi = {
  status: () => nocobaseClient.action<AccountStatus>("dingze", "accountStatus", { method: "GET" }),
  changePassword: (values: { oldPassword: string; newPassword: string }) => nocobaseClient.action<{ ok: boolean }>("dingze", "changePassword", { body: values }),
};

export const ACCOUNT_STATUS_KEY = ["dingze", "account-status"] as const;

/** 按登录的账号分开存：同一个浏览器里换账号登录时，不会拿上一个账号的状态来用。 */
export function useAccountStatus() {
  const identity = useGetIdentity<{ id: number }>();
  const userId = identity.data?.id;
  const status = useQuery({ queryKey: [...ACCOUNT_STATUS_KEY, userId], queryFn: accountApi.status, enabled: !!userId, staleTime: 5 * 60_000, retry: false });
  return { data: status.data, isLoading: identity.isLoading || (!!userId && status.isLoading) };
}
