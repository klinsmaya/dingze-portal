import { defineCollection } from '@nocobase/database';

import { spaceField } from './space-field';

export default defineCollection({
  name: 'dz_artifacts',
  title: '成果',
  createdBy: true,
  updatedBy: true,
  indexes: [{ unique: true, fields: ['projectId', 'code'] }],
  fields: [
    { type: 'belongsTo', name: 'project', target: 'dz_projects', foreignKey: 'projectId' },
    { type: 'string', name: 'code', allowNull: false },
    { type: 'string', name: 'status', defaultValue: 'not_started' },
    { type: 'boolean', name: 'stale', defaultValue: false },
    { type: 'text', name: 'staleReason' },
    // 定版后组织又变了：逐行记录（最新在前），重开、定版或主咨询师确认“不需要重开”时清空。
    { type: 'text', name: 'orgNotice' },
    // 核对基线：上游已变更时，下游最后一次与上游一致（或点了“已核对”）时读的上游版本 { code: versionId }。
    // 为空时以当前版本的 upstreamRefs 为准。用来显示“上游改了什么”。
    { type: 'json', name: 'upstreamBase' },
    { type: 'boolean', name: 'exception', defaultValue: false },
    { type: 'integer', name: 'currentRev', defaultValue: 0 },
    { type: 'belongsTo', name: 'currentVersion', target: 'dz_artifact_versions', foreignKey: 'currentVersionId', constraints: false },
    { type: 'belongsTo', name: 'stepDoneVersion', target: 'dz_artifact_versions', foreignKey: 'stepDoneVersionId', constraints: false },
    { type: 'belongsTo', name: 'lockedVersion', target: 'dz_artifact_versions', foreignKey: 'lockedVersionId', constraints: false },
    { type: 'hasMany', name: 'versions', target: 'dz_artifact_versions', foreignKey: 'artifactId' },
    spaceField,
  ],
});
