import { validateArtifact } from '../../plugin-dingze/src/shared/index';
import { hanchuan2026 } from './hanchuan';
import { qiheng2027 } from './qiheng';
import fs from 'node:fs';
// @ts-expect-error plain JS helper
import { IDS_FILE } from './api.mjs';
const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
const sets: Record<string, Record<string, unknown>> = { hanchuan2026: hanchuan2026(ids.org1), qiheng2027: qiheng2027(ids.org3) };
for (const [name, set] of Object.entries(sets)) {
  for (const [code, payload] of Object.entries(set)) {
    const issues = validateArtifact(code, payload, set);
    const errors = issues.filter((i) => i.level === 'error');
    console.log(name, code, errors.length ? 'ERR' : 'ok', errors.map((e) => e.message).join(' | '), issues.filter((i) => i.level !== 'error').map((w) => 'W:' + w.message).join(' | '));
  }
}
