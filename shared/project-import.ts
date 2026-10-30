import { isArtifactCode } from './catalog';
import {
  type ArtifactStatus,
  type ProjectRole,
  STATUS_LABELS,
} from './lifecycle';

// 企业自建项目与“从已有项目带入”（2026-10-16 甲方确认）：
// - 运营按企业打开“允许企业管理员自建项目”后，企业管理员可以建项目（企业内训 · 自助），只能分派企业侧角色；
// - 新项目里由企业项目负责人手动选择来源项目和表，带入后一律是草稿，照常本步完成、复核、定版。

/** 企业管理员自建项目时可以分派的项目角色（咨询师由运营分派）。 */
export const ENTERPRISE_PROJECT_ROLES: ProjectRole[] = [
  'ent_lead',
  'dept_head',
  'member',
  'readonly',
];

/** 只有还没进入复核的表可以带入：未开始的直接带入，填写中的带入后作为新版本，原内容在历史里。 */
export const IMPORTABLE_STATUSES: ArtifactStatus[] = [
  'not_started',
  'in_progress',
];

export interface ImportSourceRow {
  code: string;
  status: ArtifactStatus;
  currentRev: number;
  /** 最近一次定版的版本号；没定版过为 null。 */
  lockedRev: number | null;
}

/** 带哪一版：定版过的带定版内容，没定版过的带最新草稿。 */
export function importBasis(source: ImportSourceRow): {
  rev: number;
  locked: boolean;
  label: string;
} {
  if (source.lockedRev)
    return {
      rev: source.lockedRev,
      locked: true,
      label: `已定版 v${source.lockedRev}`,
    };
  return {
    rev: source.currentRev,
    locked: false,
    label: `草稿 v${source.currentRev}`,
  };
}

/** 能不能带入这一张；能带入返回 null，否则返回原因。 */
export function importBlocker(
  code: string,
  source: ImportSourceRow | undefined,
  target: ArtifactStatus | undefined,
): string | null {
  if (!isArtifactCode(code)) return '未知的成果编号';
  if (!source || !source.currentRev) return '来源项目这张表还没有内容';
  if (target && !IMPORTABLE_STATUSES.includes(target))
    return `本项目这张表${STATUS_LABELS[target]}，不能带入；需要的话先撤回或解锁重开`;
  return null;
}

/** 谁可以触发带入：本项目的企业项目负责人；运营和咨询管理员可代为操作。 */
export function canImportInto(
  projectRole: ProjectRole | null,
  isOps: boolean,
): boolean {
  return isOps || projectRole === 'ent_lead';
}
