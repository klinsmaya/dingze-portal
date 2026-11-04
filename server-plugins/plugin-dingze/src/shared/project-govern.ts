export type GovernFacts = {
  isOps: boolean;
  isEntAdmin: boolean;
  isMember: boolean;
  allowSelfProject: boolean;
  enterpriseActive: boolean;
  scene: 'camp' | 'inhouse';
  service: 'guided' | 'self';
};

/** Normalize database strings once. Callers after this trust GovernFacts. */
export function governFacts(raw: {
  isOps: boolean;
  isEntAdmin: boolean;
  isMember: boolean;
  allowSelfProject: boolean;
  enterpriseStatus: unknown;
  scene: unknown;
  service: unknown;
}): GovernFacts {
  return {
    isOps: raw.isOps,
    isEntAdmin: raw.isEntAdmin,
    isMember: raw.isMember,
    allowSelfProject: raw.allowSelfProject,
    enterpriseActive: raw.enterpriseStatus !== 'suspended',
    scene: raw.scene === 'inhouse' ? 'inhouse' : 'camp',
    service: raw.service === 'self' ? 'self' : 'guided',
  };
}

/**
 * Ops, including consulting admins and root, may govern any project they can load.
 * An enterprise admin may govern only a project they belong to, and only an active
 * enterprise's inhouse self project when allowSelfProject is on. Everyone else may not.
 */
export function canGovernProject(facts: GovernFacts): boolean {
  if (facts.isOps) return true;
  if (!facts.isMember || !facts.isEntAdmin || !facts.allowSelfProject || !facts.enterpriseActive) return false;
  return facts.scene === 'inhouse' && facts.service === 'self';
}

/** Child rows destroyed with a project. Versions precede artifacts because versions belong to artifacts. */
export const PROJECT_DELETE_ORDER = [
  'dz_artifact_versions',
  'dz_comments',
  'dz_dissents',
  'dz_proposals',
  'dz_step_exceptions',
  'dz_exports',
  'dz_expert_requests',
  'dz_materials',
  'dz_material_files',
  'dz_notifications',
  'dz_profiles',
  'dz_artifacts',
  'dz_project_members',
  'dz_ai_sessions',
  'dz_guidance_gaps',
] as const;

/** Rows that keep their history and only lose the project pointer. */
export const PROJECT_DETACH_COLLECTIONS = ['dz_invites', 'dz_audit_events'] as const;
