import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_profiles',
  title: '企业画像',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'jsonb', name: 'items', defaultValue: [] },
    { type: 'integer', name: 'rev', defaultValue: 0 },
    spaceField,
  ],
});
