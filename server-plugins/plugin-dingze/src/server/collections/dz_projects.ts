import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_projects',
  title: '咨询项目',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'enterprise', target: 'dz_enterprises', foreignKey: 'enterpriseId' },
    { type: 'string', name: 'name', allowNull: false },
    { type: 'integer', name: 'year' },
    { type: 'string', name: 'scene', defaultValue: 'camp' },
    // 服务方式：guided 陪跑（有人工咨询师）/ self 自助（只有数字咨询师）。
    { type: 'string', name: 'service', defaultValue: 'guided' },
    // 所属训练营批次（只在运营侧使用）。
    { type: 'belongsTo', name: 'camp', target: 'dz_camps', foreignKey: 'campId', constraints: false },
    { type: 'string', name: 'primaryExpression', defaultValue: 'sixfold' },
    { type: 'integer', name: 'keyProjectLevel', defaultValue: 2 },
    { type: 'string', name: 'scheduleScale', defaultValue: 'month' },
    { type: 'string', name: 'status', defaultValue: 'active' },
    { type: 'hasMany', name: 'members', target: 'dz_project_members', foreignKey: 'projectId' },
    { type: 'hasMany', name: 'artifacts', target: 'dz_artifacts', foreignKey: 'projectId' },
    spaceField,
  ],
});
