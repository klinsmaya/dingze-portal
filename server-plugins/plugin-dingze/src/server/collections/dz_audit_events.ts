import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_audit_events',
  title: '审计事件',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code' },
    { type: 'string', name: 'action', allowNull: false },
    { type: 'text', name: 'reason' },
    { type: 'string', name: 'fromStatus' },
    { type: 'string', name: 'toStatus' },
    { type: 'integer', name: 'rev' },
    { type: 'jsonb', name: 'meta' },
    spaceField,
  ],
});
