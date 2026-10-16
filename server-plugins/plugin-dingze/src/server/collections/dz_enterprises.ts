import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_enterprises',
  title: '企业',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'string', name: 'name', allowNull: false },
    { type: 'string', name: 'shortName', allowNull: false },
    { type: 'string', name: 'size', defaultValue: 'sme' },
    { type: 'string', name: 'status', defaultValue: 'active' },
    // 运营打开后，企业管理员可以自建项目（企业内训 · 自助）。
    { type: 'boolean', name: 'allowSelfProject', defaultValue: false },
    { type: 'hasMany', name: 'projects', target: 'dz_projects', foreignKey: 'enterpriseId' },
    { type: 'hasMany', name: 'orgUnits', target: 'dz_org_units', foreignKey: 'enterpriseId' },
    spaceField,
  ],
});
