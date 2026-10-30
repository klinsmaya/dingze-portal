// 自查复核 (自助项目)：the enterprise lead goes through the book's 完成检查 for the table, its common
// pitfalls and any validation suggestions still open; each item is either confirmed or answered with
// why it stays. The same list is rebuilt on the server, so the answers cannot skip an item.

import { BOOK_NOTES } from './book-notes';

export type SelfReviewItem = {
  key: string;
  kind: 'gate' | 'pitfall' | 'warning';
  text: string;
};
export type SelfReviewAnswer = { key: string; ok: boolean; note?: string };

const key = (kind: string, text: string) => {
  let h = 0;
  for (const ch of `${kind}:${text}`) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return `${kind}-${h.toString(36)}`;
};

export function selfReviewChecklist(
  code: string,
  warnings: string[],
): SelfReviewItem[] {
  const note = BOOK_NOTES[code];
  // 完成检查 of the step, and of each sub-step / zone for S2-01 and S2-03; worksheets without a guide
  // fall back to the sentences of their gate.
  const checks = note?.guide
    ? [
        ...note.guide.check,
        ...Object.values(note.parts ?? {}).flatMap((p) => p.guide.check),
      ]
    : (note?.gate ?? '').split(/[；;。]/);
  const gates = [...new Set(checks.map((t) => t.trim()).filter(Boolean))];
  return [
    ...gates.map((text) => ({
      key: key('gate', text),
      kind: 'gate' as const,
      text,
    })),
    ...(note?.pitfalls ?? []).map((text) => ({
      key: key('pitfall', text),
      kind: 'pitfall' as const,
      text: `没有踩到这个坑：${text}`,
    })),
    ...warnings.map((text) => ({
      key: key('warning', text),
      kind: 'warning' as const,
      text: `校验建议：${text}`,
    })),
  ];
}

/** Items neither confirmed nor answered with a reason; empty when the self-review may pass. */
export function missingSelfReview(
  items: SelfReviewItem[],
  answers: SelfReviewAnswer[],
): SelfReviewItem[] {
  const byKey = new Map(answers.map((a) => [a.key, a]));
  return items.filter((item) => {
    const a = byKey.get(item.key);
    return !a || (!a.ok && !(a.note ?? '').trim());
  });
}
