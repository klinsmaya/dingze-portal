import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { GapCategory, GapStatus } from "@dingze/shared";

import { type ProjectSummary, spaceHeaders } from "./api";

export type GuidanceGap = {
  id: number;
  projectId: number | null;
  project: { name: string; enterprise: string } | null;
  code: string;
  stage: string;
  category: GapCategory;
  description: string;
  expected: string;
  excerpt: string;
  pluginVersion: string;
  status: GapStatus;
  reviewNote: string;
  shippedVersion: string;
  author: string;
  reviewer: string;
  reviewedAt: string | null;
  at: string;
};

export type NewGuidanceGap = { category: GapCategory; description: string; expected?: string; excerpt?: string };

const gapsKey = ["dingze", "ops", "guidance-gaps"] as const;

export function useAddGuidanceGap(project: ProjectSummary, code: string) {
  return useMutation({
    mutationFn: (values: NewGuidanceGap) =>
      nocobaseClient.action<{ id: number }>("dingze", "addGuidanceGap", { body: { projectId: project.id, code, ...values }, headers: spaceHeaders(project.spaceName) }),
  });
}

export function useGuidanceGaps() {
  return useQuery({ queryKey: gapsKey, queryFn: () => nocobaseClient.action<GuidanceGap[]>("dingze", "listGuidanceGaps", { method: "GET" }) });
}

export function useReviewGuidanceGap() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { id: number; status: GapStatus; reviewNote?: string; shippedVersion?: string }) =>
      nocobaseClient.action("dingze", "reviewGuidanceGap", { body: values }),
    onSuccess: () => client.invalidateQueries({ queryKey: gapsKey }),
  });
}
