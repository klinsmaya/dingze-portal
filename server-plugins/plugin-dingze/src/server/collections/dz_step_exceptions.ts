import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_step_exceptions',
  title: '跳步例外',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    { type: 'text', name: 'reason', allowNull: false },
    spaceField,
  ],
});
