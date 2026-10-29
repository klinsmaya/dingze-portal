#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
node --test \
  .github/scripts/tests/repository-app-base.test.mjs \
  .github/scripts/tests/factory-lib.test.mjs \
  .github/scripts/tests/patch-flow.test.mjs \
  .github/scripts/tests/comment-queue.test.mjs \
  .github/scripts/tests/comment-queue-pulls.test.mjs \
  .github/scripts/tests/comment-queue-progress.test.mjs \
  .github/scripts/tests/handoff-control.test.mjs \
  .github/scripts/tests/handoff-bootstrap.test.mjs \
  .github/scripts/tests/runner-handoff.test.mjs \
  .github/scripts/tests/task-policy.test.mjs \
  .github/scripts/tests/pipeline-state.test.mjs \
  .github/scripts/tests/task-workflow-termination.test.mjs \
  .github/scripts/tests/agent-registry.test.mjs \
  .github/scripts/tests/agent-configuration.test.mjs \
  .github/scripts/tests/composite-actions.test.mjs \
  .github/scripts/tests/browser-acceptance.test.mjs \
  .github/scripts/tests/browser-preflight.test.mjs \
  .github/scripts/tests/browser-report.test.mjs
