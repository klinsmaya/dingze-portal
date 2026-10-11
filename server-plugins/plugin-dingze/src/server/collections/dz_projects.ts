import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_projects',
  title: '咨询项目',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'enterprise', target: 'dz_enterprises', foreignKey: 'enterpriseId' },
    { type: 'string', name: 'name', allowNull: false },
    { type: 'integer', name: 'year' },
    { type: 'string', name: 'scene', defaultValue: 'camp' },
    { type: 'string', name: 'primaryExpression', defaultValue: 'sixfold' },
    { type: 'integer', name: 'keyProjectLevel', defaultValue: 2 },
    { type: 'string', name: 'scheduleScale', defaultValue: 'month' },
    { type: 'string', name: 'status', defaultValue: 'active' },
    { type: 'hasMany', name: 'members', target: 'dz_project_members', foreignKey: 'projectId' },
    { type: 'hasMany', name: 'artifacts', target: 'dz_artifacts', foreignKey: 'projectId' },
    spaceField,
  ],
});
