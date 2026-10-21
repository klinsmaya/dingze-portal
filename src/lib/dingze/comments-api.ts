import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type ProjectSummary, spaceHeaders } from "./api";
import { dingzeKeys } from "./queries";

export type CommentItem = {
  id: number;
  parentId: number | null;
  anchor: string | null;
  /** 圈选: several rows / cells commented on together (the first is `anchor`). */
  anchors?: string[];
  anchorLabel: string;
  content: string;
  mentions: number[];
  rev: number | null;
  resolved: boolean;
  resolvedAt: string | null;
  authorId: number;
  author: string;
  at: string;
};

export type CommentThread = CommentItem & { replies: CommentItem[] };

export type NewComment = { anchor?: string | null; anchors?: string[]; anchorLabel?: string; content: string; parentId?: number; mentions?: number[] };

const commentKey = (projectId: number, code: string) => ["dingze", "comments", projectId, code] as const;

export function useComments(project: ProjectSummary, code: string) {
  return useQuery({
    queryKey: commentKey(project.id, code),
    queryFn: () =>
      nocobaseClient.action<CommentThread[]>("dingze", "listComments", { method: "GET", query: { projectId: project.id, code }, headers: spaceHeaders(project.spaceName) }),
    refetchInterval: 60_000,
  });
}

function useInvalidate(project: ProjectSummary, code: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: commentKey(project.id, code) }),
      client.invalidateQueries({ queryKey: dingzeKeys.overview(project.id) }),
    ]);
}

export function useAddComment(project: ProjectSummary, code: string) {
  const invalidate = useInvalidate(project, code);
  return useMutation({
    mutationFn: (values: NewComment) =>
      nocobaseClient.action<{ id: number }>("dingze", "addComment", { body: { projectId: project.id, code, ...values }, headers: spaceHeaders(project.spaceName) }),
    onSuccess: invalidate,
  });
}

export function useResolveComment(project: ProjectSummary, code: string) {
  const invalidate = useInvalidate(project, code);
  return useMutation({
    mutationFn: (values: { id: number; resolved: boolean }) =>
      nocobaseClient.action("dingze", "resolveComment", { body: { projectId: project.id, ...values }, headers: spaceHeaders(project.spaceName) }),
    onSuccess: invalidate,
  });
}
