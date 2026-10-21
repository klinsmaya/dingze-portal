import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_dissents',
  title: '异议（反对但承诺执行）',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    { type: 'belongsTo', name: 'version', target: 'dz_artifact_versions', foreignKey: 'versionId' },
    { type: 'text', name: 'content', allowNull: false },
    spaceField,
  ],
});
