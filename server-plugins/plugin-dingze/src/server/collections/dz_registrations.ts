import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

// 凭邀请码提交的注册申请。审核通过前不建账号，只存密码的哈希；通过后才建账号并加入企业空间和项目。
export default defineCollection({
  name: 'dz_registrations',
  title: '注册申请',
  createdBy: true,
  updatedBy: true,
  fields: [
    { type: 'belongsTo', name: 'invite', target: 'dz_invites', foreignKey: 'inviteId' },
    { type: 'belongsTo', name: 'enterprise', target: 'dz_enterprises', foreignKey: 'enterpriseId' },
    { type: 'string', name: 'nickname', allowNull: false },
    { type: 'string', name: 'username', allowNull: false },
    { type: 'string', name: 'phone' },
    { type: 'string', name: 'email' },
    { type: 'string', name: 'passwordHash', hidden: true },
    // 申请人自己写的部门 / 岗位，供审核参考
    { type: 'string', name: 'remark' },
    // pending 待审核 / approved 已通过 / rejected 未通过
    { type: 'string', name: 'status', defaultValue: 'pending' },
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId', constraints: false },
    { type: 'belongsTo', name: 'reviewedBy', target: 'users', foreignKey: 'reviewedById', constraints: false },
    { type: 'date', name: 'reviewedAt' },
    { type: 'string', name: 'reason' },
    spaceField,
  ],
});
