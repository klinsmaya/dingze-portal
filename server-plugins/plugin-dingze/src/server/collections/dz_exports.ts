import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_exports',
  title: '导出记录',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    { type: 'integer', name: 'rev' },
    // xlsx | docx
    { type: 'string', name: 'format', allowNull: false },
    { type: 'string', name: 'fileName' },
    // Exported from a version that was not yet locked (watermarked draft).
    { type: 'boolean', name: 'draft', defaultValue: false },
    spaceField,
  ],
});
