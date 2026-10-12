import { nocobaseClient } from "@nocobase/portal-sdk/client";

import type {
  ArtifactStatus,
  LifecycleAction,
  ProjectRole,
  UnlockInfo,
  NextAction,
} from "@dingze/shared";

// Every 定责 request carries the enterprise space it targets (multi-space plugin).
// Writes must name exactly one space; reads across enterprises list them in x-spaces-view.

export type MySpaces = {
  spaces: { name: string; title: string }[];
  defaultSpaceName?: string | null;
  viewableSpaceNames?: string[];
};

export function spaceHeaders(spaceName: string, viewSpaceNames?: string[]) {
  return {
    "x-spaces": spaceName,
    ...(viewSpaceNames?.length
      ? { "x-spaces-view": viewSpaceNames.join(",") }
      : {}),
  };
}

export async function getMySpaces(): Promise<MySpaces> {
  return nocobaseClient.request<MySpaces>("spaces:my");
}

export type ProjectSummary = {
  id: number;
  name: string;
  year: number;
  scene: "camp" | "inhouse";
  primaryExpression: "house" | "sixfold";
  keyProjectLevel: 1 | 2;
  scheduleScale: "month" | "quarter";
  status: string;
  spaceName: string;
  enterprise?: { id: number; name: string; shortName: string };
  projectRole: ProjectRole | null;
  /** P0 tables locked per stage, for the project cards. */
  progress?: Record<string, { locked: number; total: number }>;
  /** The concrete next step for the caller (继续填：…, 去定版：…). */
  next?: NextAction;
};

export async function listMyProjects(spaces: MySpaces): Promise<ProjectSummary[]> {
  const names = spaces.spaces.map((s) => s.name);
  if (names.length === 0) return [];
  return nocobaseClient.action<ProjectSummary[]>("dingze", "myProjects", {
    method: "GET",
    headers: spaceHeaders(names[0], names),
  });
}

export type ArtifactOverview = {
  /** Unresolved comment threads. */
  openComments?: number;
  code: string;
  status: ArtifactStatus;
  stale: boolean;
  staleReason: string | null;
  /** 定版后组织又变了（最新在前，一行一条）。 */
  orgNotice?: string | null;
  exception: boolean;
  currentRev: number;
  updatedAt: string | null;
  unlock: UnlockInfo;
  /** Latest lifecycle event (who returned it and why, …). */
  lastEvent?: { action: string; reason: string | null; at: string | null; by: string | null } | null;
};

export type ProjectOrgUnit = {
  id: number;
  name: string;
  kind: "company" | "department" | "team";
  parentId: number | null;
  headId: number | null;
  headName?: string | null;
  duty?: string | null;
  sort: number;
};

export type ProjectTeamMember = {
  userId: number;
  nickname: string;
  projectRole: ProjectRole;
  orgUnitId: number | null;
};

export type ProjectOverview = {
  project: Omit<ProjectSummary, "projectRole" | "enterprise">;
  orgUnits: ProjectOrgUnit[];
  team: ProjectTeamMember[];
  projectRole: ProjectRole | null;
  isConsultAdmin: boolean;
  artifacts: ArtifactOverview[];
};

export async function getProjectOverview(projectId: number, spaceName: string) {
  return nocobaseClient.action<ProjectOverview>("dingze", "projectOverview", {
    method: "GET",
    query: { projectId },
    headers: spaceHeaders(spaceName),
  });
}

export type ArtifactVersion = {
  id: number;
  rev: number;
  kind: "ai_draft" | "enterprise_edit" | "consultant_revision";
  payload: unknown;
  note?: string | null;
  createdAt: string;
  createdById?: number;
};

export type ArtifactDetail = {
  code: string;
  unlock: UnlockInfo;
  projectRole: ProjectRole | null;
  artifact: null | {
    id: number;
    status: ArtifactStatus;
    stale: boolean;
    staleReason: string | null;
    exception: boolean;
    currentRev: number;
    currentVersion?: ArtifactVersion | null;
    stepDoneVersion?: ArtifactVersion | null;
    lockedVersion?: ArtifactVersion | null;
  };
  dissents: { id: number; content: string; createdAt: string; createdBy?: { nickname?: string } }[];
};

export async function getArtifactDetail(projectId: number, spaceName: string, code: string) {
  return nocobaseClient.action<ArtifactDetail>("dingze", "artifactDetail", {
    method: "GET",
    query: { projectId, code },
    headers: spaceHeaders(spaceName),
  });
}

export async function saveArtifact(
  spaceName: string,
  values: { projectId: number; code: string; payload: unknown; baseRev: number; note?: string; fromProposalId?: number; aiSuggested?: boolean; changes?: unknown[] }
) {
  return nocobaseClient.action<{ status: ArtifactStatus; rev: number; versionId: number }>(
    "dingze",
    "saveArtifact",
    { body: values, headers: spaceHeaders(spaceName) }
  );
}

export async function transitionArtifact(
  spaceName: string,
  values: { projectId: number; code: string; action: Exclude<LifecycleAction, "save">; reason?: string }
) {
  return nocobaseClient.action<{ status: ArtifactStatus; stale: string[] }>(
    "dingze",
    "transition",
    { body: values, headers: spaceHeaders(spaceName) }
  );
}

/** 组织已变更 → 主咨询师判断已定版的表不需要重开。 */
export async function dismissOrgNotice(spaceName: string, values: { projectId: number; code: string; note?: string }) {
  return nocobaseClient.action("dingze", "dismissOrgNotice", { body: values, headers: spaceHeaders(spaceName) });
}

export async function recordDissent(
  spaceName: string,
  values: { projectId: number; code: string; content: string }
) {
  return nocobaseClient.action("dingze", "recordDissent", {
    body: values,
    headers: spaceHeaders(spaceName),
  });
}

export type BoardArtifact = {
  code: string;
  status: ArtifactStatus;
  stale: boolean;
  staleReason: string | null;
  currentRev: number;
  updatedAt: string | null;
};

export type BoardProject = {
  id: number;
  name: string;
  year: number;
  spaceName: string;
  primaryExpression: "house" | "sixfold";
  projectRole: ProjectRole | null;
  enterprise: { id: number; name: string; shortName: string; status: "active" | "suspended" } | null;
  artifacts: BoardArtifact[];
};

/** Cross-enterprise: the plugin resolves the caller's spaces itself. */
export async function getConsultantBoard() {
  return nocobaseClient.action<{ projects: BoardProject[] }>("dingze", "consultantBoard", { method: "GET" });
}
