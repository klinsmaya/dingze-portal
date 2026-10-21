import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

// 邀请码 (闭环第三批)：码绑定企业，可再绑定项目、项目角色和部门；有人数上限和有效期。
// 凭码注册的人要经企业管理员或运营审核才开通账号。
export default defineCollection({
  name: 'dz_invites',
  title: '邀请码',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'string', name: 'code', allowNull: false, unique: true },
    { type: 'belongsTo', name: 'enterprise', target: 'dz_enterprises', foreignKey: 'enterpriseId' },
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId', constraints: false },
    { type: 'string', name: 'projectRole' },
    { type: 'belongsTo', name: 'orgUnit', target: 'dz_org_units', foreignKey: 'orgUnitId', constraints: false },
    { type: 'integer', name: 'maxUses', defaultValue: 20 },
    { type: 'date', name: 'expiresAt' },
    // active 可用 / disabled 已停用
    { type: 'string', name: 'status', defaultValue: 'active' },
    { type: 'string', name: 'note' },
    spaceField,
  ],
});
