import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_expert_requests',
  title: '专家咨询申请',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'topic', defaultValue: 'other' },
    { type: 'string', name: 'title' },
    { type: 'text', name: 'question' },
    // [{ code, versionId, rev }]: locked versions the applicant authorised the expert to read
    { type: 'jsonb', name: 'refs', defaultValue: [] },
    { type: 'string', name: 'status', defaultValue: 'submitted' },
    { type: 'bigInt', name: 'expertId' },
    { type: 'belongsTo', name: 'expert', target: 'users', foreignKey: 'expertId' },
    { type: 'date', name: 'scheduledAt' },
    { type: 'string', name: 'channel' },
    { type: 'text', name: 'minutes' },
    { type: 'text', name: 'opinion' },
    { type: 'date', name: 'answeredAt' },
    { type: 'text', name: 'closeNote' },
    { type: 'date', name: 'closedAt' },
    spaceField,
  ],
});
