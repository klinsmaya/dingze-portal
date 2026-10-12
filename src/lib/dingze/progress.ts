import {
  ARTIFACTS,
  STAGES,
  type ArtifactDef,
  type ArtifactProgress,
  type NextAction,
  type ProjectRole,
  type StageKey,
  getArtifactDef,
  stageGateCodes,
} from "@dingze/shared";

import type { ArtifactOverview } from "./api";

/** Artifacts shown as steps (method worksheets live under their parent step). */
export const STEP_ARTIFACTS = ARTIFACTS.filter((a) => a.priority !== "method");

export type StageProgress = {
  stage: StageKey;
  name: string;
  goal: string;
  open: boolean;
  gateTotal: number;
  locked: number;
  inProgress: number;
  complete: boolean;
};

const byCode = (artifacts: ArtifactOverview[]) => new Map(artifacts.map((a) => [a.code, a]));

export function stageProgress(artifacts: ArtifactOverview[]): StageProgress[] {
  const map = byCode(artifacts);
  return STAGES.map((stage) => {
    const gate = stageGateCodes(stage.key);
    const locked = gate.filter((code) => map.get(code)?.status === "locked").length;
    const first = STEP_ARTIFACTS.find((a) => a.stage === stage.key);
    const inProgress = STEP_ARTIFACTS.filter(
      (a) => a.stage === stage.key && ["in_progress", "step_done", "in_review", "pending_confirm"].includes(map.get(a.code)?.status ?? "")
    ).length;
    return {
      stage: stage.key,
      name: stage.name,
      goal: stage.goal,
      open: !!first && !!map.get(first.code)?.unlock.unlocked,
      gateTotal: gate.length,
      locked,
      inProgress,
      complete: locked === gate.length,
    };
  });
}

/** The first unlocked step that still needs enterprise work, in book order. */
export function nextStep(artifacts: ArtifactOverview[]): ArtifactDef | null {
  const map = byCode(artifacts);
  const candidate = STEP_ARTIFACTS.find((def) => {
    if (def.priority === "P1") return false;
    const a = map.get(def.code);
    return !!a && a.unlock.unlocked && ["not_started", "in_progress"].includes(a.status);
  });
  return candidate ?? null;
}

export type TodoKind = "confirm" | "review" | "stale" | "returned";

export type Todo = {
  kind: TodoKind;
  code: string;
  title: string;
  description: string;
};

const ENTERPRISE: ProjectRole[] = ["ent_lead", "dept_head", "member"];

export function todosFor(artifacts: ArtifactOverview[], role: ProjectRole | null): Todo[] {
  const todos: Todo[] = [];
  for (const a of artifacts) {
    const def = getArtifactDef(a.code);
    const title = `${def.specId} ${def.name}`;
    if (a.status === "pending_confirm" && role === "ent_lead") {
      todos.push({ kind: "confirm", code: a.code, title, description: "咨询师已复核通过，等你确认定版" });
    }
    if (a.status === "in_review" && (role === "lead_consultant" || role === "co_consultant")) {
      todos.push({ kind: "review", code: a.code, title, description: "企业已提交，等你复核" });
    }
    if (a.stale && role && (ENTERPRISE.includes(role) || role === "lead_consultant")) {
      todos.push({ kind: "stale", code: a.code, title, description: a.staleReason ?? "引用的上游有新版本，请核对" });
    }
  }
  const order: TodoKind[] = ["confirm", "review", "stale", "returned"];
  return todos.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
}

/** Where a next action leads: the table, the export page, or the project home. */
export function nextActionPath(projectId: number, next: NextAction): string {
  if (next.code) return workspacePath(projectId, next.code);
  return next.kind === "deliver" ? `/projects/${projectId}/results?tab=delivery` : `/projects/${projectId}/overview`;
}

/** The table states next-action and status helpers need, from the project overview. */
export function progressOf(artifacts: ArtifactOverview[]): ArtifactProgress[] {
  return artifacts.map((a) => ({ code: a.code, status: a.status, stale: a.stale, unlocked: a.unlock.unlocked, lastEvent: a.lastEvent ?? null }));
}

export function workspacePath(projectId: number, code: string) {
  return `/projects/${projectId}/workspace/${encodeURIComponent(code)}`;
}
