import { call } from './api.mjs';
const [pid, space, user] = process.argv.slice(2);
const r = await call(user, `dingze:projectOverview?projectId=${pid}`, undefined, { space });
console.log((r.data.artifacts || []).filter((a) => a.status !== 'not_started' || a.unlock?.unlocked).map((a) => `${a.code}:${a.status}${a.stale ? '(stale)' : ''}${a.lastEvent?.action === 'returnToEdit' ? '(退回)' : ''}${a.unlock?.unlocked ? '' : '(锁)'}`).join(' '));
