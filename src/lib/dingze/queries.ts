import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { LifecycleAction } from "@dingze/shared";

import {
  type ProjectSummary,
  getArtifactDetail,
  getConsultantBoard,
  getMySpaces,
  getProjectOverview,
  listMyProjects,
  recordDissent,
  saveArtifact,
  dismissOrgNotice,
  transitionArtifact,
} from "./api";

export const dingzeKeys = {
  spaces: ["dingze", "spaces"] as const,
  board: ["dingze", "board"] as const,
  projects: ["dingze", "projects"] as const,
  overview: (projectId: number) => ["dingze", "overview", projectId] as const,
  artifact: (projectId: number, code: string) => ["dingze", "artifact", projectId, code] as const,
};

export function useMySpaces() {
  return useQuery({ queryKey: dingzeKeys.spaces, queryFn: getMySpaces, staleTime: 60_000 });
}

export function useMyProjects() {
  const spaces = useMySpaces();
  const projects = useQuery({
    queryKey: dingzeKeys.projects,
    queryFn: () => listMyProjects(spaces.data!),
    enabled: !!spaces.data,
    staleTime: 30_000,
  });
  return {
    ...projects,
    isLoading: spaces.isLoading || projects.isLoading,
    error: spaces.error ?? projects.error,
  };
}

/** Resolve a project (and therefore its space) from the user's project list. */
export function useProject(projectId: number) {
  const projects = useMyProjects();
  const project: ProjectSummary | undefined = projects.data?.find((p) => p.id === projectId);
  return { ...projects, project, notFound: !!projects.data && !project };
}

export function useProjectOverview(project: ProjectSummary | undefined) {
  return useQuery({
    queryKey: dingzeKeys.overview(project?.id ?? 0),
    queryFn: () => getProjectOverview(project!.id, project!.spaceName),
    enabled: !!project,
  });
}

export function useArtifactDetail(project: ProjectSummary | undefined, code: string | undefined) {
  return useQuery({
    queryKey: dingzeKeys.artifact(project?.id ?? 0, code ?? ""),
    queryFn: () => getArtifactDetail(project!.id, project!.spaceName, code!),
    enabled: !!project && !!code,
  });
}

function useInvalidateProject(project: ProjectSummary | undefined) {
  const client = useQueryClient();
  return (code?: string) => {
    if (!project) return Promise.resolve();
    return Promise.all([
      client.invalidateQueries({ queryKey: dingzeKeys.overview(project.id) }),
      client.invalidateQueries({ queryKey: dingzeKeys.board }),
      code
        ? client.invalidateQueries({ queryKey: dingzeKeys.artifact(project.id, code) })
        : Promise.resolve(),
    ]);
  };
}

export function useSaveArtifact(project: ProjectSummary | undefined, code: string) {
  const invalidate = useInvalidateProject(project);
  return useMutation({
    mutationFn: (values: { payload: unknown; baseRev: number; note?: string; fromProposalId?: number; aiSuggested?: boolean; changes?: unknown[] }) =>
      saveArtifact(project!.spaceName, { projectId: project!.id, code, ...values }),
    onSuccess: () => invalidate(code),
  });
}

export function useTransitionArtifact(project: ProjectSummary | undefined, code: string) {
  const invalidate = useInvalidateProject(project);
  return useMutation({
    mutationFn: (values: { action: Exclude<LifecycleAction, "save">; reason?: string }) =>
      transitionArtifact(project!.spaceName, { projectId: project!.id, code, ...values }),
    onSuccess: () => invalidate(code),
  });
}

export function useDismissOrgNotice(project: ProjectSummary | undefined, code: string) {
  const invalidate = useInvalidateProject(project);
  return useMutation({
    mutationFn: (note?: string) => dismissOrgNotice(project!.spaceName, { projectId: project!.id, code, note }),
    onSuccess: () => invalidate(code),
  });
}

export function useRecordDissent(project: ProjectSummary | undefined, code: string) {
  const invalidate = useInvalidateProject(project);
  return useMutation({
    mutationFn: (content: string) => recordDissent(project!.spaceName, { projectId: project!.id, code, content }),
    onSuccess: () => invalidate(code),
  });
}

export function useConsultantBoard() {
  return useQuery({ queryKey: dingzeKeys.board, queryFn: getConsultantBoard, refetchInterval: 60_000 });
}

/**
 * Latest content of upstream artifacts, by code (their current version: downstream tables
 * are drafted while upstream may still be in review). Unstarted artifacts are omitted.
 */
export function useUpstreamPayloads(project: ProjectSummary | undefined, codes: string[]) {
  const results = useQueries({
    queries: codes.map((code) => ({
      queryKey: dingzeKeys.artifact(project?.id ?? 0, code),
      queryFn: () => getArtifactDetail(project!.id, project!.spaceName, code),
      enabled: !!project,
    })),
  });
  const stamp = results.map((r) => r.dataUpdatedAt).join(",");
  const payloads = useMemo(() => {
    const out: Record<string, unknown> = {};
    codes.forEach((code, i) => {
      const artifact = results[i]?.data?.artifact;
      const payload = artifact?.currentVersion?.payload ?? artifact?.lockedVersion?.payload;
      if (payload) out[code] = payload;
    });
    return out;
    // Recompute only when one of the upstream queries returns new data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, codes.join(",")]);
  return { payloads, isLoading: results.some((r) => r.isLoading) };
}
