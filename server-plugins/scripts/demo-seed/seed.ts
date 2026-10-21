/* eslint-disable @typescript-eslint/no-explicit-any -- demo payloads are edited as untyped JSON */
// Seed the three demo projects through the public dingze API, as the real roles would do it:
// enterprise members save and say 本步完成 / 提交复核, the lead consultant approves, returns or
// reopens, the enterprise lead confirms. Idempotent enough to re-run: tables already in the
// wanted state with the wanted content are skipped.
import fs from 'node:fs';
import { diffPayloads, validateArtifact } from '../../plugin-dingze/src/shared/index';
// @ts-expect-error plain JS helper
import { IDS_FILE, call } from './api.mjs';
import { hanchuan2026 } from './hanchuan';
import { qiheng2027 } from './qiheng';

const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
const S1 = 'dz-017728e2ab';
const S3 = 'dz-f54028e96a';
const only = process.argv[2];

type Project = { id: number; space: string; lead: string; editor: string; consultant: string; all: Record<string, unknown> };
type Target = 'in_progress' | 'step_done' | 'in_review' | 'pending_confirm' | 'locked';

async function api(user: string, path: string, body: unknown, space: string) {
  const r = await call(user, path, body, { space });
  if (r.status >= 300) throw new Error(`${user} ${path} → ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
}
const detail = (p: Project, code: string) => api(p.lead, `dingze:artifactDetail?projectId=${p.id}&code=${code}`, undefined, p.space);
const transition = (p: Project, user: string, code: string, action: string, reason?: string) =>
  api(user, 'dingze:transition', { projectId: p.id, code, action, ...(reason ? { reason } : {}) }, p.space);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function commands(before: unknown, after: unknown, label: string, via = 'edit', commentId: number | null = null) {
  const changes = diffPayloads(before ?? {}, after).slice(0, 50);
  if (!changes.length) return [];
  return [{ at: new Date().toISOString(), via, label, commentId, changes }];
}

async function save(p: Project, user: string, code: string, payload: unknown, label: string, via = 'edit', force = false) {
  const d = await detail(p, code);
  const before = d.artifact?.currentVersion?.payload;
  if (same(before, payload) && !force) return d;
  const r = await api(user, 'dingze:saveArtifact', { projectId: p.id, code, payload, baseRev: d.artifact?.currentRev ?? 0, changes: commands(before, payload, label, via) }, p.space);
  console.log(`  ${code} saved v${r.rev} by ${user}`);
  return r;
}

/** Bring one table to `target` with `payload` as its current content. */
async function drive(p: Project, code: string, payload: unknown, target: Target, opts: { editor?: string; reopenReason?: string; label?: string } = {}) {
  const editor = opts.editor ?? p.editor;
  let d = await detail(p, code);
  if (!d.unlock?.unlocked) throw new Error(`${code} is not unlocked: ${d.unlock?.waitingFor}`);
  let status: string = d.artifact?.status ?? 'not_started';
  const current = d.artifact?.currentVersion?.payload;
  if (status === target && same(current, payload) && !d.artifact?.stale) {
    console.log(`${code}: already ${target}`);
    return;
  }
  console.log(`${code}: ${status} → ${target}`);
  const stale = !!d.artifact?.stale;
  if (status === 'locked' && (!same(current, payload) || stale)) {
    await transition(p, p.consultant, code, 'reopen', opts.reopenReason ?? '按年度经营计划会定稿内容更新');
    status = 'in_progress';
  }
  if (status === 'in_review') {
    await transition(p, p.consultant, code, 'returnToEdit', '按最新讨论稿更新后重新提交');
    status = 'in_progress';
  }
  if (status !== 'locked') {
    await save(p, editor, code, payload, stale && same(current, payload) ? '上游更新后核对，内容不变' : (opts.label ?? '按经营计划会讨论稿更新'), 'edit', stale);
    d = await detail(p, code);
    status = d.artifact?.status;
  }
  const order: Target[] = ['in_progress', 'step_done', 'in_review', 'pending_confirm', 'locked'];
  const at = (s: string) => order.indexOf(s as Target);
  if (at(status) < at('step_done') && at(target) >= at('step_done')) await transition(p, editor, code, 'stepDone');
  if (at(status) < at('in_review') && at(target) >= at('in_review')) await transition(p, editor, code, 'submitReview');
  if (at(status) < at('pending_confirm') && at(target) >= at('pending_confirm')) await transition(p, p.consultant, code, 'approve');
  if (at(status) < at('locked') && at(target) >= at('locked')) await transition(p, p.lead, code, 'confirm');
}

function preflight(all: Record<string, unknown>, codes: string[]) {
  for (const code of codes) {
    const errors = validateArtifact(code, all[code], all).filter((i) => i.level === 'error');
    if (errors.length) throw new Error(`${code} would not pass: ${errors.map((e) => e.message).join(' | ')}`);
  }
}

async function comment(p: Project, user: string, code: string, body: { anchor?: string | null; anchors?: string[]; anchorLabel?: string; content: string; mentions?: number[]; parentId?: number }) {
  const existing: { id: number; content: string; replies: { content: string }[] }[] = await api(user, `dingze:listComments?projectId=${p.id}&code=${code}`, undefined, p.space);
  if (existing.some((t) => t.content === body.content || t.replies.some((r) => r.content === body.content))) return existing.find((t) => t.content === body.content)?.id ?? null;
  const r = await api(user, 'dingze:addComment', { projectId: p.id, code, ...body }, p.space);
  console.log(`  comment on ${code} by ${user}`);
  return r.id as number;
}

const u = ids.users as Record<string, number>;

// ── 瀚川燃气 · 2026：三阶段走完，执行中预算压缩 → S3-02 解锁重开、被退回，下游标“上游已变更” ──
async function project1() {
  const all = hanchuan2026(ids.org1);
  const p: Project = { id: 1, space: S1, lead: 'dz_zhang', editor: 'dz_wang', consultant: 'dz_chen', all };
  const codes = ['S1-01', 'S1-02', 'S1-03', 'S1-06', 'S1-07', 'S2-01', 'S2-03', 'S2-08', 'S2-04', 'S2-05', 'S2-06', 'S2-07', 'S3-02', 'S3-05', 'S3-06', 'S3-07', 'S3-08'];
  preflight(all, codes);
  for (const code of codes) await drive(p, code, all[code], 'locked', { editor: code.startsWith('S1') ? 'dz_zhang' : 'dz_wang' });

  // Mid-year: the board trims investment by 15%; the lead consultant reopens S3-02.
  const charters = structuredClone(all['S3-02']) as any;
  const pc3 = charters.charters.find((c: any) => c.id === 'pc3');
  pc3.resources.budget = '建设投资 5400 万元（压缩后），港区 2 座先建、城区 2 座分两期';
  pc3.milestones = '4 月：选址批复；7 月：港区首站投运；11 月：港区 2 座投运；城区 2 座顺延至 2027 年 3 月';
  pc3.objective = '11 月底前投运港区 LNG/CNG 合建站 2 座，城区 2 座 2027 年一季度投运';
  const d = await detail(p, 'S3-02');
  if (d.artifact?.status === 'locked') {
    await transition(p, 'dz_chen', 'S3-02', 'reopen', '董事会把下半年投资压缩 15%，加气站项目的预算与里程碑需要调整');
  }
  const cur = await detail(p, 'S3-02');
  if (cur.artifact?.status === 'in_progress' && !(cur.artifact?.lastEvent?.action === 'returnToEdit')) {
    await save(p, 'dz_wang', 'S3-02', charters, '加气站投资压缩：港区先建、城区顺延');
    await transition(p, 'dz_wang', 'S3-02', 'stepDone');
    await transition(p, 'dz_wang', 'S3-02', 'submitReview');
    await transition(p, 'dz_chen', 'S3-02', 'returnToEdit', '2026ENGP001 的里程碑缺少验收标准；城区站顺延后，WBS 和资源匹配要同步拆成两期');
  }
  const c1 = await comment(p, 'dz_zhou', 'S3-02', { anchor: 'pc3', anchorLabel: '新建加气站 4 座投运', content: '压缩后 5400 万里，港区两座站已经占 3600 万，城区站如果顺延到明年，今年的预算请按季度拆开，方便财务排资金。', mentions: [u.dz_wang] });
  await comment(p, 'dz_chen', 'S3-02', { anchor: 'pc3', anchorLabel: '新建加气站 4 座投运', content: '里程碑请写清验收标准，例如“港区首站投运：取得燃气经营许可、连续 7 天日销 ≥1 万方”。', mentions: [u.dz_wang] });
  if (c1) await comment(p, 'dz_wang', 'S3-02', { parentId: c1, content: '收到，周五前按季度拆分后再提交。' });
  await comment(p, 'dz_li', 'S3-02', { anchors: ['pc1', 'pc2'], anchorLabel: '高新区工业用户通气 45 户、物流车队长协签约 60 家', content: '这两张任务书都依赖新站投运，城区站顺延后请评估对车队签约节奏的影响。' });
}

// ── 启衡能源 · 2027：定目标责进行中 ──
async function project2() {
  const all = qiheng2027(ids.org3);
  const p: Project = { id: 2, space: S3, lead: 'dz_qian', editor: 'dz_qian', consultant: 'dz_chen', all };
  preflight(all, ['S1-01', 'S1-02', 'S1-03', 'S1-06', 'S1-07', 'S2-01', 'S2-08']);
  for (const code of ['S1-01', 'S1-02', 'S1-03', 'S1-06', 'S1-07']) await drive(p, code, all[code], 'locked');
  // S2-03 was submitted once (so S2-08 / S2-04 opened), then returned by the consultant.
  const paths = structuredClone(all['S2-03']) as any;
  const submitted = structuredClone(paths);
  submitted.nodes.find((n: any) => n.id === 'n12').value = '1.2';
  submitted.nodes.find((n: any) => n.id === 'n12').amount = 1.2;
  preflight({ ...all, 'S2-03': submitted }, ['S2-03']);
  const s203 = await detail(p, 'S2-03');
  const returned = s203.artifact?.status === 'in_progress' && s203.artifact?.lastEvent?.action === 'returnToEdit';
  if (!returned) {
    await drive(p, 'S2-03', submitted, 'in_review');
    await drive(p, 'S2-01', all['S2-01'], 'locked');
  } else {
    await drive(p, 'S2-01', all['S2-01'], 'locked');
  }
  await drive(p, 'S2-08', all['S2-08'], 'in_review', { editor: 'dz_sun' });
  const again = await detail(p, 'S2-03');
  if (again.artifact?.status === 'in_review') {
    await transition(p, 'dz_chen', 'S2-03', 'returnToEdit', '浙北 1.2 亿偏乐观：嘉兴经开区今年只能签 50 MWh，请下调后补一条路径，确保推得回来');
  }
  await save(p, 'dz_sun', 'S2-03', paths, '按顾问意见下调浙北制造业客户收入');
  await save(p, 'dz_sun', 'S2-04', all['S2-04'], '初排 RACI：先列出四个关键项目的执行部门');
  const t = await comment(p, 'dz_chen', 'S2-04', { anchor: 'ra3', anchorLabel: '物流园充换电场站提质', content: '这一行有两个 R 但没有 A：最终对可用率 99% 负责的是充换电事业部吗？', mentions: [u.dz_qian, u.dz_sun] });
  if (t) await comment(p, 'dz_sun', 'S2-04', { parentId: t, content: '是，充换电事业部负总责，运维服务部做设备体检。我这周改。' });
  await comment(p, 'dz_he', 'S2-04', { anchor: null, anchorLabel: '', content: '财务部建议在每个项目里都至少是 C：EMC 项目的回款周期要提前评估。' });
  await comment(p, 'dz_qian', 'S2-03', { anchor: 'n12', anchorLabel: '浙北制造业客户', content: '1.0 亿里是否包含嘉兴经开区样板？如果包含，和 KP-02 的 50 MWh 要对一下口径。' });
}

// ── 瀚川燃气 · 2027 滚动规划：定战略责进行中 ──
async function project3() {
  const base = hanchuan2026(ids.org1);
  const p: Project = { id: ids.p3, space: S1, lead: 'dz_zhang', editor: 'dz_zhang', consultant: 'dz_chen', all: base };
  const s101 = structuredClone(base['S1-01']) as any;
  s101.strategicGoals = '2027 年：售气量 6.4 亿方、营业收入 22.6 亿元；2028 年：营业收入 25 亿元；远期做强综合能源。';
  s101.goals = { y1: '售气量 6.4 亿方，营收 22.6 亿元', y3: '营收 25 亿元', y5: '营收 32 亿元' };
  s101.stepsAndMeasures = '2027 拓增量：点供项目 30 个、综合能源示范园区 2 个、城区加气站 2 座投运；2028 上台阶：综合能源收入占比 15%。';
  const s102 = base['S1-02'];
  const s103 = structuredClone(base['S1-03']) as any;
  s103.strategies[1].tactics.push({ id: 't10', text: '城区加气站 2 座一季度投运', path: '' });
  const s106 = base['S1-06'];
  preflight({ ...base, 'S1-01': s101, 'S1-03': s103 }, ['S1-01', 'S1-02', 'S1-03']);
  const s1 = await detail(p, 'S1-01');
  const returned = s1.artifact?.lastEvent?.action === 'returnToEdit';
  if (!returned) await drive(p, 'S1-01', s101, 'in_review');
  await drive(p, 'S1-02', s102, 'in_review');
  await drive(p, 'S1-03', s103, 'pending_confirm');
  await save(p, 'dz_wang', 'S1-06', s106, '先把 2026 年的六个指标带过来');
  const again = await detail(p, 'S1-01');
  if (again.artifact?.status === 'in_review') {
    await transition(p, 'dz_chen', 'S1-01', 'returnToEdit', '战略目标要量化到 2030 年，并和集团“十五五”规划的综合能源占比口径对齐');
  }
  await comment(p, 'dz_chen', 'S1-01', { anchor: 'strategicGoals', anchorLabel: '战略目标', content: '“远期做强综合能源”不可衡量：请写成 2030 年营收和综合能源收入占比两个数。', mentions: [u.dz_zhang] });
  await comment(p, 'dz_zhou', 'S1-01', { anchor: 'goals.y3', anchorLabel: '三年目标', content: '营收 25 亿的前提是城区两座站一季度投运，建议在步骤举措里写明。' });
}

if (!only || only === '1') await project1();
if (!only || only === '2') await project2();
if (!only || only === '3') await project3();
console.log('seed done');
