// 资料与企业画像 (spec 二(四)): materials are text extracted from what the enterprise uploads;
// the profile sorts what we know into 事实 / 假设 / 未知 / 待补, reviewed by the consultant and
// confirmed by the enterprise. The digital consultants search materials and cite them.

import { newRowId } from './measures';
import type { ProjectRole } from './lifecycle';

export type ProfileCategory = 'fact' | 'assumption' | 'unknown' | 'todo';

export const PROFILE_CATEGORIES: { key: ProfileCategory; label: string; hint: string }[] = [
  { key: 'fact', label: '事实', hint: '有资料或数据支撑的经营事实' },
  { key: 'assumption', label: '假设', hint: '尚未验证、但规划要依赖的判断' },
  { key: 'unknown', label: '未知', hint: '目前不清楚、需要调研的问题' },
  { key: 'todo', label: '待补', hint: '需要企业补充的资料或数据' },
];

export type ProfileStatus = 'draft' | 'reviewed' | 'confirmed';

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = { draft: '草稿', reviewed: '咨询师已复核', confirmed: '企业已确认' };

export interface ProfileItem {
  id: string;
  category: ProfileCategory;
  topic: string;
  content: string;
  /** Material id this item rests on, as a string; '' when none. */
  source: string;
  status: ProfileStatus;
}

export interface EnterpriseProfile {
  items: ProfileItem[];
}

export function emptyProfile(): EnterpriseProfile {
  return { items: [] };
}

export function profileItem(patch: Partial<ProfileItem> = {}): ProfileItem {
  return { id: newRowId('pf'), category: 'fact', topic: '', content: '', source: '', status: 'draft', ...patch };
}

export const MATERIAL_TEXT_LIMIT = 150_000;

/**
 * 资料分两种：进资料库的（企业简介、复盘等，数字咨询师检索得到）和填表时挂在某张表下的附件
 * （员工上传、抽取后填表，默认不进资料库；企业管理员可“加入资料库”）。
 */
export type MaterialKind = 'file' | 'note' | 'attachment';

/** 谁能上传、删除项目资料库的资料和改画像：企业项目负责人、咨询师、咨询管理员。普通员工只能传表下附件。 */
export const LIBRARY_MANAGERS: ProjectRole[] = ['ent_lead', 'lead_consultant', 'co_consultant'];
export function canManageLibrary(role: ProjectRole | null | undefined, isConsultAdmin: boolean): boolean {
  return isConsultAdmin || (!!role && LIBRARY_MANAGERS.includes(role));
}

/** 填表附件给数字咨询师看的那段话：先说目的，再附正文（太长就截）。 */
export const ATTACHMENT_PROMPT_CHARS = 12_000;
export function attachmentPrompt(input: { fileName: string; table: string; text: string; pages?: number }): string {
  const text = input.text.trim();
  const head = `我上传了附件《${input.fileName}》，请从里面抽取能填进《${input.table}》的内容，用修改卡逐项给我确认；附件里没有的格子不要猜，标【待补】。`;
  if (!text) return `${head}附件是图片${input.pages && input.pages > 1 ? `（共 ${input.pages} 页）` : ''}，请先把图里的文字和表格读出来，再给修改卡。`;
  const cut = text.length > ATTACHMENT_PROMPT_CHARS;
  return `${head}
附件内容（共 ${text.length} 字${cut ? `，这里只放前 ${ATTACHMENT_PROMPT_CHARS} 字` : ''}）：
---
${cut ? text.slice(0, ATTACHMENT_PROMPT_CHARS) : text}`;
}

/** Who may move an item to a status: consultants review, the enterprise lead confirms. */
export function canSetProfileStatus(status: ProfileStatus, role: ProjectRole | null, isConsultAdmin: boolean): boolean {
  if (status === 'draft') return true;
  if (status === 'reviewed') return isConsultAdmin || role === 'lead_consultant' || role === 'co_consultant';
  return role === 'ent_lead';
}

/**
 * Normalise a save: unknown categories become 待补, edited text drops a review or confirmation
 * the editor could not have given, and status moves the editor may not make are refused.
 */
export function reconcileProfile(
  previous: EnterpriseProfile,
  next: EnterpriseProfile,
  role: ProjectRole | null,
  isConsultAdmin: boolean,
): { profile: EnterpriseProfile; error: string | null } {
  const before = new Map((previous.items ?? []).map((i) => [i.id, i]));
  const items: ProfileItem[] = [];
  for (const raw of next.items ?? []) {
    const item: ProfileItem = {
      ...profileItem(),
      ...raw,
      category: PROFILE_CATEGORIES.some((c) => c.key === raw.category) ? raw.category : 'todo',
      status: (['draft', 'reviewed', 'confirmed'] as const).includes(raw.status) ? raw.status : 'draft',
      topic: String(raw.topic ?? '').slice(0, 200),
      content: String(raw.content ?? '').slice(0, 4000),
      source: String(raw.source ?? ''),
    };
    const old = before.get(item.id);
    const oldStatus = old?.status ?? 'draft';
    const edited = !!old && (old.topic !== item.topic || old.content !== item.content || old.category !== item.category);
    if (item.status !== oldStatus && !canSetProfileStatus(item.status, role, isConsultAdmin)) {
      return { profile: previous, error: item.status === 'confirmed' ? '只有企业项目负责人可以确认画像' : '只有咨询师可以复核画像' };
    }
    if (edited && item.status === oldStatus && item.status !== 'draft' && !canSetProfileStatus(item.status, role, isConsultAdmin)) item.status = 'draft';
    items.push(item);
  }
  return { profile: { items }, error: null };
}

export interface MaterialText {
  id: number | string;
  title: string;
  text: string;
}

export interface MaterialSnippet {
  materialId: string;
  title: string;
  snippet: string;
  hits: number;
}

const SNIPPET_RADIUS = 120;

/** Keyword search across materials: the best windows around the terms, most terms first. */
export function searchSnippets(materials: MaterialText[], query: string, limit = 8): MaterialSnippet[] {
  const terms = [...new Set(query.split(/[\s,，;；、。]+/).map((t) => t.trim()).filter((t) => t.length > 0))];
  if (terms.length === 0) return [];
  const out: MaterialSnippet[] = [];
  for (const m of materials) {
    const text = m.text ?? '';
    const lower = text.toLowerCase();
    const positions: number[] = [];
    for (const term of terms) {
      let from = 0;
      const t = term.toLowerCase();
      for (let i = 0; i < 20; i++) {
        const at = lower.indexOf(t, from);
        if (at < 0) break;
        positions.push(at);
        from = at + t.length;
      }
    }
    positions.sort((a, b) => a - b);
    let last = -Infinity;
    for (const at of positions) {
      if (at - last < SNIPPET_RADIUS * 2) continue;
      last = at;
      const start = Math.max(0, at - SNIPPET_RADIUS);
      const window = text.slice(start, at + SNIPPET_RADIUS);
      const hits = terms.filter((t) => window.toLowerCase().includes(t.toLowerCase())).length;
      out.push({ materialId: String(m.id), title: m.title, snippet: `${start > 0 ? '…' : ''}${window.replace(/\s+/g, ' ').trim()}${at + SNIPPET_RADIUS < text.length ? '…' : ''}`, hits });
    }
  }
  return out.sort((a, b) => b.hits - a.hits).slice(0, limit);
}

/** The profile as a short brief for the digital consultant's page context. */
export function profileBrief(profile: EnterpriseProfile | null | undefined, max = 3000): string {
  const items = [...(profile?.items ?? [])].sort((a, b) => (a.status === 'draft' ? 1 : 0) - (b.status === 'draft' ? 1 : 0));
  const lines: string[] = [];
  for (const c of PROFILE_CATEGORIES) {
    const own = items.filter((i) => i.category === c.key && (i.topic || i.content));
    if (!own.length) continue;
    lines.push(`【${c.label}】`);
    for (const i of own) lines.push(`- ${i.topic ? `${i.topic}：` : ''}${i.content}${i.status === 'draft' ? '（草稿）' : ''}`);
  }
  const text = lines.join('\n');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
