import { defineCollection } from '@nocobase/database';

// Platform-wide (no space field): the guidance rules are shared by every enterprise, and
// the gaps feed the next rule-pack release. Only ops and consulting admins list them.
export default defineCollection({
  name: 'dz_guidance_gaps',
  title: '引导缺口',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'bigInt', name: 'projectId' },
    { type: 'string', name: 'code' },
    { type: 'string', name: 'stage' },
    { type: 'string', name: 'category', defaultValue: 'missing' },
    { type: 'text', name: 'description' },
    { type: 'text', name: 'expected' },
    { type: 'text', name: 'excerpt' },
    { type: 'string', name: 'pluginVersion' },
    { type: 'string', name: 'status', defaultValue: 'open' },
    { type: 'text', name: 'reviewNote' },
    { type: 'string', name: 'shippedVersion' },
    { type: 'bigInt', name: 'reviewedById' },
    { type: 'belongsTo', name: 'reviewedBy', target: 'users', foreignKey: 'reviewedById' },
    { type: 'date', name: 'reviewedAt' },
  ],
});
