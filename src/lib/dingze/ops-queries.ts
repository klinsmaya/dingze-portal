import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type SystemRole, opsApi } from "./ops-api";

export const opsKeys = {
  all: ["dingze", "ops"] as const,
  enterprises: ["dingze", "ops", "enterprises"] as const,
  board: ["dingze", "ops", "board"] as const,
  camps: ["dingze", "ops", "camps"] as const,
  camp: (id: number) => ["dingze", "ops", "camp", id] as const,
  enterprise: (id: number) => ["dingze", "ops", "enterprise", id] as const,
  users: (role?: SystemRole, q?: string) => ["dingze", "ops", "users", role ?? "", q ?? ""] as const,
};

export function useEnterprises() {
  return useQuery({ queryKey: opsKeys.enterprises, queryFn: opsApi.listEnterprises });
}

export function useOpsBoard() {
  return useQuery({ queryKey: opsKeys.board, queryFn: opsApi.opsBoard });
}

export function useCamps() {
  return useQuery({ queryKey: opsKeys.camps, queryFn: opsApi.listCamps });
}

export function useCampDetail(campId: number | undefined) {
  return useQuery({ queryKey: opsKeys.camp(campId ?? 0), queryFn: () => opsApi.campDetail(campId!), enabled: !!campId });
}

export function useEnterpriseDetail(enterpriseId: number | undefined) {
  return useQuery({
    queryKey: opsKeys.enterprise(enterpriseId ?? 0),
    queryFn: () => opsApi.enterpriseDetail(enterpriseId!),
    enabled: !!enterpriseId,
  });
}

export function useDzUsers(role?: SystemRole, q?: string, enabled = true) {
  return useQuery({ queryKey: opsKeys.users(role, q), queryFn: () => opsApi.listUsers({ role, q }), enabled });
}

/**
 * Wrap an ops action as a mutation. Ops changes touch enterprises, members and projects
 * together, so every success refreshes the ops cache and the user's own project list.
 */
export function useOpsMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: opsKeys.all }),
        client.invalidateQueries({ queryKey: ["dingze", "projects"] }),
        // 组织也在项目「资料」页维护：项目概览里的组织与职责跟着刷新。
        client.invalidateQueries({ queryKey: ["dingze", "overview"] }),
      ]),
  });
}
