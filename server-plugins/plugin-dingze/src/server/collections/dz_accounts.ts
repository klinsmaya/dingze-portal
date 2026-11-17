import { defineCollection } from '@nocobase/database';

// 定责平台对一个账号多记的几件事（0.41.0）。一个账号一行，按 userId 找；没有行就是都没有。
// - enterpriseId / orgUnitId：企业侧账号属于哪家企业、哪个部门。部门归到人，不再跟着项目走；
//   dz_project_members.orgUnitId 是它的副本，改部门时一起改，各张表照旧读项目成员上的那一份。
// - disabledAt：账号停用（不能登录、不能用任何功能）；恢复时清空。
// - mustChangePassword：账号还在用别人给的初始密码，第一次登录要先改。
// 这张表是平台级的，不分空间。
export default defineCollection({
  name: 'dz_accounts',
  title: '账号',
  createdBy: true,
  updatedBy: true,
  indexes: [{ unique: true, fields: ['userId'] }],
  fields: [
    { type: 'belongsTo', name: 'user', target: 'users', foreignKey: 'userId' },
    { type: 'belongsTo', name: 'enterprise', target: 'dz_enterprises', foreignKey: 'enterpriseId', constraints: false },
    { type: 'belongsTo', name: 'orgUnit', target: 'dz_org_units', foreignKey: 'orgUnitId', constraints: false },
    { type: 'date', name: 'disabledAt' },
    { type: 'belongsTo', name: 'disabledBy', target: 'users', foreignKey: 'disabledById', constraints: false },
    { type: 'boolean', name: 'mustChangePassword', defaultValue: false },
  ],
});
