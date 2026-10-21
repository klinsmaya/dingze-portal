import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_proposals',
  title: '修改建议',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    { type: 'string', name: 'summary' },
    { type: 'jsonb', name: 'ops' },
    // pending | accepted | rejected
    { type: 'string', name: 'status', defaultValue: 'pending' },
    { type: 'string', name: 'source', defaultValue: 'ai' },
    { type: 'jsonb', name: 'meta' },
    { type: 'belongsTo', name: 'decidedBy', target: 'users', foreignKey: 'decidedById' },
    { type: 'date', name: 'decidedAt' },
    spaceField,
  ],
});
