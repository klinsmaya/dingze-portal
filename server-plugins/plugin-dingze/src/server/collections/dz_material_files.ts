import { defineCollection } from '@nocobase/database';

// Original files behind 企业资料, stored on the instance's local storage. Clients may only
// create them (multipart upload); every read goes through dingze:downloadMaterial, which checks
// the project, so the storage URL is never handed out.
export default defineCollection({
  name: 'dz_material_files',
  title: '企业资料原件',
  template: 'file',
  storage: 'local',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'string', name: 'title' },
    { type: 'string', name: 'filename' },
    { type: 'string', name: 'extname' },
    { type: 'integer', name: 'size' },
    { type: 'string', name: 'mimetype' },
    { type: 'belongsTo', name: 'storage', target: 'storages', foreignKey: 'storageId', deletable: false },
    { type: 'text', name: 'path' },
    { type: 'jsonb', name: 'meta', defaultValue: {} },
    { type: 'text', name: 'url' },
    // Set when a material claims the file; unclaimed uploads belong to nobody's project yet.
    { type: 'bigInt', name: 'projectId' },
  ],
} as any);
