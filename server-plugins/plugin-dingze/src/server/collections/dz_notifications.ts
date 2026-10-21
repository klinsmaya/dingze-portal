import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_notifications',
  title: '站内通知',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId' },
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code' },
    // step_done | review | confirm | returned | locked | reopened | stale | assigned
    { type: 'string', name: 'kind', allowNull: false },
    { type: 'string', name: 'title', allowNull: false },
    { type: 'text', name: 'content' },
    // Portal path, e.g. /projects/1/workspace/S1-02
    { type: 'string', name: 'link' },
    { type: 'date', name: 'readAt' },
    spaceField,
  ],
});
