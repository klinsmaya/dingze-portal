import { appendFileSync } from 'node:fs';

// Inputs are boolean presence checks, never credentials or their values.
const engine = process.env.FACTORY_ENGINE || 'pi';
const fields = {
  pi: ['CODE_AGENT_API_ENDPOINT', 'CODE_AGENT_API_KEY', 'CODE_AGENT_MODEL'],
  codex: ['CODEX_API_KEY', 'CODEX_MODEL'],
  codebuddy: ['CODEBUDDY_CREDENTIAL', 'CODEBUDDY_MODEL'],
  'claude-code': ['CLAUDE_CODE_CREDENTIAL', 'CLAUDE_CODE_MODEL'],
  opencode: ['OPENCODE_API_KEY', 'OPENCODE_MODEL'],
}[engine];
if (!fields) throw new Error('Unsupported factory engine');
const missing = fields.filter(
  (field) => process.env[`HAS_${field}`] !== 'true',
);
const lines = [
  '## Factory model configuration',
  '',
  `Engine: ${engine}`,
  '',
  ...fields.map(
    (field) =>
      `- ${field}: ${missing.includes(field) ? 'not configured' : 'configured'}`,
  ),
  '',
  'This checks presence only. It does not call the model or prove service authorization.',
  'Actions permissions must also allow this workflow and PR creation.',
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
if (missing.length)
  console.log(
    '::warning::Factory model configuration is incomplete; enter values securely in repository Actions settings.',
  );
