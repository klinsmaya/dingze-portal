import type { ProjectSummary } from "./api";

import { SAMPLE, samplePath } from "./sample";

export type CreateOffer =
  | { kind: "ops"; enterprises: { id: number; name: string }[] }
  | { kind: "own"; enterprises: { id: number; name: string }[] };

export type ProjectListEntry =
  | {
      kind: "project";
      project: ProjectSummary;
      href: `/projects/${number}/overview`;
    }
  | {
      kind: "sample";
      href: "/sample";
      enterprise: string;
      name: string;
      year: number;
    };

type CreateEnterprise = {
  id: number;
  name: string;
  allowSelfProject?: boolean;
  status: "active" | "suspended";
};

function named(enterprises: readonly { id: number; name: string }[]) {
  return enterprises.map((enterprise) => ({ id: enterprise.id, name: enterprise.name }));
}

/**
 * Who may see 新建项目 on the list. Ops win when both flags are set.
 * Own offers drop suspended enterprises and enterprises with allowSelfProject off.
 * An empty enterprise list returns null.
 */
export function createOffer(
  who: { ops: boolean; entAdmin: boolean },
  enterprises: readonly CreateEnterprise[],
): CreateOffer | null {
  if (enterprises.length === 0) return null;
  if (who.ops) return { kind: "ops", enterprises: named(enterprises) };
  if (!who.entAdmin) return null;
  const own = enterprises.filter((enterprise) => enterprise.status !== "suspended" && enterprise.allowSelfProject === true);
  if (own.length === 0) return null;
  return { kind: "own", enterprises: named(own) };
}

const sampleEntry: ProjectListEntry = {
  kind: "sample",
  href: samplePath(),
  enterprise: SAMPLE.enterprise,
  name: SAMPLE.project,
  year: SAMPLE.year,
};

function shown(project: ProjectSummary, showHidden: boolean) {
  if (!project.hidden) return true;
  return showHidden && project.canGovern;
}

/** The only project list. Server order is kept, and the sample fixture is always last. */
export function projectListEntries(projects: readonly ProjectSummary[], showHidden: boolean): ProjectListEntry[] {
  const entries: ProjectListEntry[] = projects.filter((project) => shown(project, showHidden)).map((project) => ({
    kind: "project",
    project,
    href: `/projects/${project.id}/overview`,
  }));
  entries.push(sampleEntry);
  return entries;
}

export function canRevealHidden(projects: readonly ProjectSummary[]): boolean {
  return projects.some((project) => project.hidden === true && project.canGovern);
}
