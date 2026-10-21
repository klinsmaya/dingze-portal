import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ExpertAction, ExpertStatus, ExpertTopic } from "@dingze/shared";

import { type ProjectSummary, spaceHeaders } from "./api";

export type ExpertRequestSummary = {
  id: number;
  projectId: number;
  projectName: string;
  enterprise: string;
  topic: ExpertTopic;
  title: string;
  status: ExpertStatus;
  applicant: string;
  expert: string;
  scheduledAt: string | null;
  refs: string[];
  at: string;
};

export type ExpertRequestDetail = ExpertRequestSummary & {
  question: string;
  channel: string;
  minutes: string;
  opinion: string;
  answeredAt: string | null;
  closeNote: string;
  closedAt: string | null;
  expertId: number | null;
  citations: { code: string; versionId: number; rev: number; name: string; payload: unknown }[];
  upstream: Record<string, unknown>;
  can: Record<ExpertAction, boolean>;
  candidates: { id: number; name: string }[];
};

export type NewExpertRequest = { topic: ExpertTopic; title: string; question: string; refs: string[] };

const keys = {
  all: ["dingze", "expert"] as const,
  list: (projectId?: number) => ["dingze", "expert", "list", projectId ?? 0] as const,
  detail: (id: number) => ["dingze", "expert", "detail", id] as const,
};

export function useExpertRequests(projectId?: number) {
  return useQuery({
    queryKey: keys.list(projectId),
    queryFn: () => nocobaseClient.action<ExpertRequestSummary[]>("dingze", "listExpertRequests", { method: "GET", query: projectId ? { projectId } : {} }),
  });
}

export function useExpertRequest(id: number) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => nocobaseClient.action<ExpertRequestDetail>("dingze", "expertRequestDetail", { method: "GET", query: { id } }),
    enabled: id > 0,
  });
}

export function useCreateExpertRequest(project: ProjectSummary) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: NewExpertRequest) =>
      nocobaseClient.action<{ id: number }>("dingze", "createExpertRequest", { body: { projectId: project.id, ...values }, headers: spaceHeaders(project.spaceName) }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useExpertAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { id: number; action: ExpertAction; expertId?: number; scheduledAt?: string; channel?: string; minutes?: string; opinion?: string; closeNote?: string }) =>
      nocobaseClient.action<{ id: number }>("dingze", "actOnExpertRequest", { body: values }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.all }),
  });
}
