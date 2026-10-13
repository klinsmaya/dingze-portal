import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_artifact_versions',
  title: '成果版本',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'artifact', target: 'dz_artifacts', foreignKey: 'artifactId' },
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    { type: 'integer', name: 'rev', allowNull: false },
    // ai_draft | enterprise_edit | consultant_revision | locked
    { type: 'string', name: 'kind', allowNull: false },
    { type: 'jsonb', name: 'payload' },
    { type: 'integer', name: 'schemaVersion', defaultValue: 1 },
    // { [upstreamCode]: upstreamVersionId } read when this version was made
    { type: 'jsonb', name: 'upstreamRefs', defaultValue: {} },
    // 计划书定版时引用的上游版本：{ [code]: { versionId, rev, basis } }，导出始终用这一份 (验收 D01)。
    { type: 'jsonb', name: 'sources' },
    { type: 'text', name: 'note' },
    // Command log of the edits this version saved: [{ via, label, at, by, commentId, changes[] }].
    { type: 'jsonb', name: 'changes', defaultValue: [] },
    spaceField,
  ],
});
