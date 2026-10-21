import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_org_units',
  title: '组织部门',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'enterprise', target: 'dz_enterprises', foreignKey: 'enterpriseId' },
    { type: 'string', name: 'name', allowNull: false },
    { type: 'string', name: 'kind', defaultValue: 'department' },
    { type: 'belongsTo', name: 'parent', target: 'dz_org_units', foreignKey: 'parentId' },
    { type: 'belongsTo', name: 'head', target: 'users', foreignKey: 'headId' },
    // 负责人没有账号时只记姓名；职责供 RACI 等表参考 (闭环第二批)。
    { type: 'string', name: 'headName' },
    { type: 'text', name: 'duty' },
    { type: 'integer', name: 'sort', defaultValue: 0 },
    spaceField,
  ],
});
