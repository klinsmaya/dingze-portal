import { readFileSync } from 'node:fs';
import { TaskInputError, validateTargetBranch } from './factory-lib.mjs';

// A v2 repository may host the factory without being a valid application base.
// Keep control code on its default branch and application code on a v3 branch.
export function applicationBase(config, requested, defaultBranch) {
  const configured = config?.application_branch;
  if (!configured) return { target: requested, creationBase: defaultBranch };
  validateTargetBranch(configured);
  const target = requested || configured;
  validateTargetBranch(target);
  if (target === defaultBranch || configured === defaultBranch) {
    throw new TaskInputError(
      'main 保留原 v2 应用；请选择 NocoBase 3 应用分支 apps/dingze。',
    );
  }
  return { target, creationBase: configured };
}

export function repositoryApplicationBase(requested, defaultBranch) {
  let config;
  try {
    config = JSON.parse(
      readFileSync(
        new URL('../factory-integration.json', import.meta.url),
        'utf8',
      ),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return applicationBase(config, requested, defaultBranch);
}
