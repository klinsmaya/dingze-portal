export type GovernFacts = {
  isOps: boolean;
  isEntAdmin: boolean;
  isMember: boolean;
  allowSelfProject: boolean;
  enterpriseActive: boolean;
  scene: 'camp' | 'inhouse';
  service: 'guided' | 'self';
};

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

export function canGovernProject(facts: GovernFacts): boolean {
  if (facts.isOps) return true;
  if (!facts.isMember || !facts.isEntAdmin || !facts.allowSelfProject || !facts.enterpriseActive) return false;
  return facts.scene === 'inhouse' && facts.service === 'self';
}

export const PROJECT_DELETE_ORDER = [
  'dz_dissents',
  'dz_artifact_versions',
  'dz_comments',
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

export const PROJECT_DETACH_COLLECTIONS = ['dz_invites', 'dz_audit_events'] as const;
