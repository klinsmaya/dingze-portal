import type { Context, Next } from '@nocobase/actions';
import { Plugin } from '@nocobase/server';

import type { LifecycleAction } from '../shared';
import { HttpError, SYSTEM_ROLES, loadProjectContext } from './services/access';
import {
  artifactDetail,
  grantStepException,
  projectOverview,
  recordDissent,
  requireArtifactDef,
  saveArtifact,
  toHttpError,
  transitionArtifact,
} from './services/artifacts';
import { consultantBoard } from './services/board';
import { opsBoard } from './services/usage';
import { mergeGoalTargets } from './upgrade/merge-goal-targets';
import { addGuidanceGap, listGuidanceGaps, reviewGuidanceGap } from './services/guidance';
import { actOnExpertRequest, createExpertRequest, expertRequestDetail, listExpertRequests } from './services/expert';
import { addMaterial, deleteMaterial, downloadMaterial, getMaterial, getProfile, listMaterials, saveProfile, searchMaterials } from './services/materials';
import { addComment, listComments, resolveComment } from './services/comments';
import { markNotificationsRead, myNotifications } from './services/notify';
import { artifactHistory, artifactRegistry, deliveryBundle, recordExport, versionDiff, versionPayload } from './services/registry';
import { createProject, listEnterprises, myProjects, provisionEnterprise, setProjectMembers } from './services/enterprises';
import {
  addEnterpriseMembers,
  createUser,
  deleteOrgUnit,
  enterpriseDetail,
  listUsers,
  removeEnterpriseMember,
  removeProjectMember,
  resetPassword,
  saveOrgUnit,
  updateEnterprise,
  updateProject,
} from './services/ops';

const TRANSITIONS: LifecycleAction[] = [
  'stepDone',
  'submitReview',
  'approve',
  'returnToEdit',
  'confirm',
  'reopen',
  'forceLock',
  'forceReturn',
];

const ROLE_DEFINITIONS = [
  { name: SYSTEM_ROLES.consultAdmin, title: '定责 · 咨询管理员' },
  { name: SYSTEM_ROLES.consultant, title: '定责 · 咨询师' },
  { name: SYSTEM_ROLES.entAdmin, title: '定责 · 企业管理员' },
  { name: SYSTEM_ROLES.entMember, title: '定责 · 企业成员' },
  { name: SYSTEM_ROLES.ops, title: '定责 · 运营管理员' },
];

type Handler = (ctx: Context) => Promise<unknown>;

/** Wrap a handler so domain errors become JSON responses with a stable `code`. */
function action(handler: Handler) {
  return async (ctx: Context, next: Next) => {
    try {
      ctx.body = await handler(ctx);
    } catch (raw) {
      const error = toHttpError(raw);
      if (error instanceof HttpError) {
        ctx.status = error.status;
        ctx.body = { errors: [{ message: error.message, code: error.code, details: error.details }] };
        return;
      }
      throw error;
    }
    await next();
  };
}

function values(ctx: Context): Record<string, any> {
  return (ctx.action.params.values ?? {}) as Record<string, any>;
}

export class PluginDingzeServer extends Plugin {
  /** The rule-pack version a guidance gap was observed in. */
  pluginVersion(): string {
    const fromRecord = (this.options as { version?: string } | undefined)?.version;
    if (fromRecord) return fromRecord;
    try {
      return require('../../package.json').version ?? '';
    } catch {
      return '';
    }
  }

  async load() {
    this.app.resourceManager.define({
      name: 'dingze',
      actions: {
        myProjects: action((ctx) => myProjects(ctx)),
        consultantBoard: action((ctx) => consultantBoard(ctx)),
        opsBoard: action((ctx) => opsBoard(ctx)),
        addGuidanceGap: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return addGuidanceGap(ctx, pc, requireArtifactDef(v.code), v, this.pluginVersion());
        }),
        listGuidanceGaps: action((ctx) => listGuidanceGaps(ctx)),
        reviewGuidanceGap: action((ctx) => reviewGuidanceGap(ctx, values(ctx))),
        listExpertRequests: action((ctx) => listExpertRequests(ctx, { projectId: ctx.action.params.projectId })),
        expertRequestDetail: action((ctx) => expertRequestDetail(ctx, ctx.action.params.id)),
        createExpertRequest: action(async (ctx) => {
          const v = values(ctx);
          return createExpertRequest(ctx, await loadProjectContext(ctx, v.projectId), v);
        }),
        actOnExpertRequest: action((ctx) => actOnExpertRequest(ctx, values(ctx))),
        projectOverview: action(async (ctx) => {
          const pc = await loadProjectContext(ctx, ctx.action.params.projectId);
          return projectOverview(ctx, pc);
        }),
        artifactDetail: action(async (ctx) => {
          const pc = await loadProjectContext(ctx, ctx.action.params.projectId);
          return artifactDetail(ctx, pc, requireArtifactDef(ctx.action.params.code));
        }),
        saveArtifact: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return saveArtifact(ctx, pc, requireArtifactDef(v.code), {
            payload: v.payload,
            baseRev: Number(v.baseRev ?? 0),
            note: v.note,
            fromProposalId: v.fromProposalId ? Number(v.fromProposalId) : undefined,
            aiSuggested: v.aiSuggested === true,
            changes: v.changes,
          });
        }),
        transition: action(async (ctx) => {
          const v = values(ctx);
          if (!TRANSITIONS.includes(v.action)) throw new HttpError(400, '未知的操作');
          const pc = await loadProjectContext(ctx, v.projectId);
          return transitionArtifact(ctx, pc, requireArtifactDef(v.code), v.action, v.reason);
        }),
        artifactRegistry: action(async (ctx) => artifactRegistry(ctx, await loadProjectContext(ctx, ctx.action.params.projectId))),
        artifactHistory: action(async (ctx) => {
          const pc = await loadProjectContext(ctx, ctx.action.params.projectId);
          return artifactHistory(ctx, pc, requireArtifactDef(ctx.action.params.code));
        }),
        versionPayload: action(async (ctx) => {
          const p = ctx.action.params;
          return versionPayload(ctx, await loadProjectContext(ctx, p.projectId), requireArtifactDef(p.code), p.rev);
        }),
        versionDiff: action(async (ctx) => {
          const p = ctx.action.params;
          const pc = await loadProjectContext(ctx, p.projectId);
          return versionDiff(ctx, pc, requireArtifactDef(p.code), p.from, p.to);
        }),
        deliveryBundle: action(async (ctx) => deliveryBundle(ctx, await loadProjectContext(ctx, ctx.action.params.projectId))),
        recordExport: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return recordExport(ctx, pc, requireArtifactDef(v.code), v);
        }),
        listComments: action(async (ctx) => {
          const pc = await loadProjectContext(ctx, ctx.action.params.projectId);
          return listComments(ctx, pc, requireArtifactDef(ctx.action.params.code));
        }),
        addComment: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return addComment(ctx, pc, requireArtifactDef(v.code), v);
        }),
        resolveComment: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return resolveComment(ctx, pc, v);
        }),
        listMaterials: action(async (ctx) => listMaterials(ctx, await loadProjectContext(ctx, ctx.action.params.projectId))),
        getMaterial: action(async (ctx) => {
          const p = ctx.action.params;
          return getMaterial(ctx, await loadProjectContext(ctx, p.projectId), p.id, p.offset);
        }),
        downloadMaterial: action(async (ctx) => {
          const p = ctx.action.params;
          return downloadMaterial(ctx, await loadProjectContext(ctx, p.projectId), p.id);
        }),
        addMaterial: action(async (ctx) => {
          const v = values(ctx);
          return addMaterial(ctx, await loadProjectContext(ctx, v.projectId), v);
        }),
        deleteMaterial: action(async (ctx) => {
          const v = values(ctx);
          return deleteMaterial(ctx, await loadProjectContext(ctx, v.projectId), v.id);
        }),
        searchMaterials: action(async (ctx) => {
          const p = ctx.action.params;
          return searchMaterials(ctx, await loadProjectContext(ctx, p.projectId), p.query);
        }),
        getProfile: action(async (ctx) => getProfile(ctx, await loadProjectContext(ctx, ctx.action.params.projectId))),
        saveProfile: action(async (ctx) => {
          const v = values(ctx);
          return saveProfile(ctx, await loadProjectContext(ctx, v.projectId), v);
        }),
        myNotifications: action((ctx) => myNotifications(ctx, ctx.action.params as any)),
        markNotificationsRead: action((ctx) => markNotificationsRead(ctx, values(ctx))),
        recordDissent: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return recordDissent(ctx, pc, requireArtifactDef(v.code), v.content);
        }),
        grantException: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return grantStepException(ctx, pc, requireArtifactDef(v.code), v.reason);
        }),
        provisionEnterprise: action((ctx) => provisionEnterprise(ctx, values(ctx) as any)),
        listEnterprises: action((ctx) => listEnterprises(ctx)),
        createProject: action((ctx) => createProject(ctx, values(ctx) as any)),
        setProjectMembers: action((ctx) => setProjectMembers(ctx, values(ctx).projectId, values(ctx).members)),
        updateProject: action((ctx) => updateProject(ctx, values(ctx) as any)),
        removeProjectMember: action((ctx) => removeProjectMember(ctx, values(ctx) as any)),
        enterpriseDetail: action((ctx) => enterpriseDetail(ctx, ctx.action.params.enterpriseId)),
        updateEnterprise: action((ctx) => updateEnterprise(ctx, values(ctx) as any)),
        addEnterpriseMembers: action((ctx) => addEnterpriseMembers(ctx, values(ctx) as any)),
        removeEnterpriseMember: action((ctx) => removeEnterpriseMember(ctx, values(ctx) as any)),
        saveOrgUnit: action((ctx) => saveOrgUnit(ctx, values(ctx) as any)),
        deleteOrgUnit: action((ctx) => deleteOrgUnit(ctx, values(ctx) as any)),
        listUsers: action((ctx) => listUsers(ctx, ctx.action.params as any)),
        createUser: action((ctx) => createUser(ctx, values(ctx) as any)),
        resetPassword: action((ctx) => resetPassword(ctx, values(ctx) as any)),
      },
    });
    // Every handler checks space membership, project role and artifact status itself.
    this.app.acl.allow('dingze', '*', 'loggedIn');
    // Originals are uploaded with the standard multipart create; nothing else on the
    // collection is open, reads go through dingze:downloadMaterial.
    this.app.acl.allow('dz_material_files', 'create', 'loggedIn');

    // One-off data alignment after an upgrade; each step is a no-op once done.
    this.app.on('afterStart', async () => {
      try {
        await mergeGoalTargets(this.db, (message) => this.app.log.info(message));
      } catch (error: any) {
        this.app.log.error(`dingze: merging S2-03-T failed: ${error?.message ?? error}`);
      }
    });
  }

  async install() {
    const repo = this.db.getRepository('roles');
    for (const role of ROLE_DEFINITIONS) {
      const existing = await repo.findOne({ filterByTk: role.name });
      if (!existing) {
        await repo.create({ values: { ...role, hidden: false, allowConfigure: false, strategy: { actions: [] } } });
      }
    }
  }
}

export default PluginDingzeServer;
