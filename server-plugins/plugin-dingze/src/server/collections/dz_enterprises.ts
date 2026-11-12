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
    // 企业管理员默认可以自建项目（企业内训 · 自助）；运营按企业关掉时这里为 true（0.37.0）。
    { type: 'boolean', name: 'selfProjectOff', defaultValue: false },
    // 0.37.0 起不再使用（原来是“运营打开后才能自建”，默认关）；保留这一列，旧数据不动，可回滚。
    { type: 'boolean', name: 'allowSelfProject', defaultValue: false },
    // 客户在首页自助注册的试用企业（2026-11）。
    { type: 'boolean', name: 'trial', defaultValue: false },
    { type: 'hasMany', name: 'projects', target: 'dz_projects', foreignKey: 'enterpriseId' },
    { type: 'hasMany', name: 'orgUnits', target: 'dz_org_units', foreignKey: 'enterpriseId' },
    spaceField,
  ],
});
