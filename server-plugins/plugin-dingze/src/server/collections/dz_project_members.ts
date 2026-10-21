import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_project_members',
  title: '项目成员',
  createdBy: true,
  updatedBy: true,
  indexes: [{ unique: true, fields: ['projectId', 'userId'] }],
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId' },
    { type: 'string', name: 'projectRole', allowNull: false },
    { type: 'belongsTo', name: 'orgUnit', target: 'dz_org_units', foreignKey: 'orgUnitId' },
    spaceField,
  ],
});
