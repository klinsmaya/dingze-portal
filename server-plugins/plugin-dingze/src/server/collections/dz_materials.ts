import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_materials',
  title: '企业资料',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'title', allowNull: false },
    // file: text extracted in the browser from an upload; note: typed or pasted text
    { type: 'string', name: 'kind', defaultValue: 'file' },
    { type: 'string', name: 'fileName' },
    { type: 'integer', name: 'size' },
    { type: 'text', name: 'text' },
    { type: 'integer', name: 'chars' },
    // The original upload (dz_material_files), when one was kept.
    { type: 'bigInt', name: 'fileId' },
    { type: 'string', name: 'mimetype' },
    spaceField,
  ],
});
