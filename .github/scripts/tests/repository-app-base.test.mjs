import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationBase } from '../repository-app-base.mjs';

test('a v2 control branch is never used as an implicit v3 base', () => {
  assert.deepEqual(
    applicationBase({ application_branch: 'apps/dingze' }, '', 'main'),
    {
      target: 'apps/dingze',
      creationBase: 'apps/dingze',
    },
  );
  assert.deepEqual(
    applicationBase({ application_branch: 'apps/dingze' }, 'apps/next', 'main'),
    {
      target: 'apps/next',
      creationBase: 'apps/dingze',
    },
  );
});
test('explicit v2 targets and invalid branch names fail closed', () => {
  assert.throws(() =>
    applicationBase({ application_branch: 'apps/dingze' }, 'main', 'main'),
  );
  assert.throws(() =>
    applicationBase({ application_branch: 'main' }, '', 'main'),
  );
  assert.throws(() =>
    applicationBase({ application_branch: '../bad' }, '', 'main'),
  );
});
test('upstream behavior is retained without repository-specific configuration', () => {
  assert.deepEqual(applicationBase(undefined, '', 'develop'), {
    target: '',
    creationBase: 'develop',
  });
});
