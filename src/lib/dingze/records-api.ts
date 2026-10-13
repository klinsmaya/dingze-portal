import { nocobaseClient } from "@nocobase/portal-sdk/client";

import type { ArtifactStatus, DiffKind } from "@dingze/shared";

import { spaceHeaders } from "./api";

// 成果管理页、交付页与通知的接口。

export type RegistryRow = {
  code: string;
  status: ArtifactStatus;
  stale: boolean;
  currentRev: number;
  lockedRev: number | null;
  updatedAt: string | null;
  versions: { total: number; ai: number; enterprise: number; consultant: number };
  lastEvent: { action: string; at: string; by: string } | null;
  aiDiff: { aiRev: number; lockedRev: number; added: number; removed: number; changed: number } | null;
};

export async function getArtifactRegistry(projectId: number, spaceName: string) {
  return nocobaseClient.action<RegistryRow[]>("dingze", "artifactRegistry", { method: "GET", query: { projectId }, headers: spaceHeaders(spaceName) });
}

export type ArtifactHistory = {
  versions: { rev: number; kind: string; note: string; at: string; by: string; changes: SavedCommand[] }[];
  events: { action: string; fromStatus: ArtifactStatus | null; toStatus: ArtifactStatus | null; rev: number | null; reason: string; at: string; by: string }[];
};

export async function getArtifactHistory(projectId: number, spaceName: string, code: string) {
  return nocobaseClient.action<ArtifactHistory>("dingze", "artifactHistory", { method: "GET", query: { projectId, code }, headers: spaceHeaders(spaceName) });
}

export type VersionDiff = {
  from: number;
  to: number;
  summary: { added: number; removed: number; changed: number };
  entries: { path: string; kind: DiffKind; before: string; after: string }[];
  truncated: boolean;
};

export type SavedCommand = {
  via: "edit" | "structure" | "chat" | "paste" | "undo" | "import";
  label: string;
  at: string;
  by: string;
  commentId: number | null;
  changes: { path: string; kind: DiffKind; before: string | null; after: string | null }[];
};

export type VersionPayload = { rev: number; kind: string; at: string; by: string; payload: unknown };

export async function getVersionPayload(projectId: number, spaceName: string, code: string, rev: number) {
  return nocobaseClient.action<VersionPayload>("dingze", "versionPayload", { method: "GET", query: { projectId, code, rev }, headers: spaceHeaders(spaceName) });
}

export async function getVersionDiff(projectId: number, spaceName: string, code: string, from: number, to: number) {
  return nocobaseClient.action<VersionDiff>("dingze", "versionDiff", { method: "GET", query: { projectId, code, from, to }, headers: spaceHeaders(spaceName) });
}

export type DeliveryArtifact = { code: string; status: ArtifactStatus; rev: number; locked: boolean; payload: unknown };
export type ExportFormat = "xlsx" | "docx" | "svg" | "png";

export type ExportRecord = { id: number; code: string; rev: number; format: ExportFormat; fileName: string; draft: boolean; at: string; by: string };

export async function getDeliveryBundle(projectId: number, spaceName: string) {
  return nocobaseClient.action<{ artifacts: DeliveryArtifact[]; exports: ExportRecord[] }>("dingze", "deliveryBundle", {
    method: "GET",
    query: { projectId },
    headers: spaceHeaders(spaceName),
  });
}

export type PlanBookSources = {
  code: string;
  locked: boolean;
  rev: number;
  payload: unknown;
  /** false: locked before sources were recorded; reconstructed from the lock time. */
  recorded: boolean;
  stale: boolean;
  staleReason: string | null;
  sources: { code: string; specId: string; name: string; rev: number; basis: "locked" | "draft" | "at_time"; basisLabel: string }[];
  payloads: Record<string, unknown>;
};

/** The plan book version to export and the exact upstream versions it was built from (验收 D01). */
export async function getPlanBookSources(projectId: number, spaceName: string, code: string) {
  return nocobaseClient.action<PlanBookSources>("dingze", "planBookSources", { method: "GET", query: { projectId, code }, headers: spaceHeaders(spaceName) });
}

export type ExportInfo = { code: string; rev: number; format: ExportFormat; fileName: string; draft: boolean };

export async function recordExport(projectId: number, spaceName: string, info: ExportInfo) {
  return nocobaseClient.action("dingze", "recordExport", { body: { projectId, ...info }, headers: spaceHeaders(spaceName) });
}

export type NotificationItem = {
  id: number;
  kind: string;
  code: string | null;
  title: string;
  content: string;
  link: string;
  projectId: number;
  projectName: string;
  createdAt: string;
  readAt: string | null;
};

/** Cross-enterprise like the board: the plugin resolves the caller's spaces itself. */
export async function getMyNotifications(limit = 30) {
  return nocobaseClient.action<{ unread: number; items: NotificationItem[] }>("dingze", "myNotifications", { method: "GET", query: { limit } });
}

export async function markNotificationsRead(values: { ids?: number[]; all?: boolean }) {
  return nocobaseClient.action<{ updated: number }>("dingze", "markNotificationsRead", { body: values });
}
