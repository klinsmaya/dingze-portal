import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProjectSummary } from "./api";
import {
  type ExportInfo,
  getArtifactHistory,
  getArtifactRegistry,
  getDeliveryBundle,
  getMyNotifications,
  getVersionDiff,
  getVersionPayload,
  markNotificationsRead,
  recordExport,
} from "./records-api";

export const recordKeys = {
  registry: (projectId: number) => ["dingze", "registry", projectId] as const,
  history: (projectId: number, code: string) => ["dingze", "history", projectId, code] as const,
  diff: (projectId: number, code: string, from: number, to: number) => ["dingze", "diff", projectId, code, from, to] as const,
  delivery: (projectId: number) => ["dingze", "delivery", projectId] as const,
  notifications: ["dingze", "notifications"] as const,
};

export function useArtifactRegistry(project: ProjectSummary) {
  return useQuery({ queryKey: recordKeys.registry(project.id), queryFn: () => getArtifactRegistry(project.id, project.spaceName) });
}

export function useArtifactHistory(project: ProjectSummary, code: string | null) {
  return useQuery({
    queryKey: recordKeys.history(project.id, code ?? ""),
    queryFn: () => getArtifactHistory(project.id, project.spaceName, code!),
    enabled: !!code,
  });
}

export function useVersionDiff(project: ProjectSummary, code: string | null, from: number | null, to: number | null) {
  return useQuery({
    queryKey: recordKeys.diff(project.id, code ?? "", from ?? 0, to ?? 0),
    queryFn: () => getVersionDiff(project.id, project.spaceName, code!, from!, to!),
    enabled: !!code && !!from && !!to && from !== to,
    staleTime: Infinity,
  });
}

export function useVersionPayload(project: ProjectSummary, code: string, rev: number | null) {
  return useQuery({
    queryKey: ["dingze", "version", project.id, code, rev ?? 0],
    queryFn: () => getVersionPayload(project.id, project.spaceName, code, rev!),
    enabled: !!rev,
    staleTime: Infinity,
  });
}

export function useDeliveryBundle(project: ProjectSummary) {
  return useQuery({ queryKey: recordKeys.delivery(project.id), queryFn: () => getDeliveryBundle(project.id, project.spaceName) });
}

/** Log an export (best effort: a failed log never blocks the download the user already has). */
export function useRecordExport(project: ProjectSummary | undefined) {
  const client = useQueryClient();
  return (info: ExportInfo) => {
    if (!project) return;
    recordExport(project.id, project.spaceName, info)
      .then(() => client.invalidateQueries({ queryKey: recordKeys.delivery(project.id) }))
      .catch(() => undefined);
  };
}

export function useMyNotifications() {
  return useQuery({ queryKey: recordKeys.notifications, queryFn: () => getMyNotifications(30), refetchInterval: 60_000, refetchOnWindowFocus: true });
}

export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => client.invalidateQueries({ queryKey: recordKeys.notifications }),
  });
}
