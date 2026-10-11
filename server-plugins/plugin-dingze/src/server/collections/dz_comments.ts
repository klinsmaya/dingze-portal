import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_comments',
  title: '批注',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    // 圈选: a comment pinned to a group of rows / nodes; `anchor` keeps the first of them.
    { type: 'jsonb', name: 'anchors', defaultValue: [] },
    // Row or field id inside the artifact payload; null = the whole table.
    { type: 'string', name: 'anchor' },
    { type: 'string', name: 'anchorLabel' },
    { type: 'text', name: 'content', allowNull: false },
    // Replies point at the thread's first comment.
    { type: 'bigInt', name: 'parentId' },
    { type: 'jsonb', name: 'mentions', defaultValue: [] },
    { type: 'integer', name: 'rev' },
    { type: 'boolean', name: 'resolved', defaultValue: false },
    { type: 'bigInt', name: 'resolvedById' },
    { type: 'date', name: 'resolvedAt' },
    spaceField,
  ],
});
