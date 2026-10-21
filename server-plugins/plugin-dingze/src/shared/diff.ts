// Field-level differences between two versions of an artifact payload. Array items with an
// `id` are matched by id (the same addressing the AI change paths use), so reordering rows
// is not reported as a change; other arrays compare as whole values.

export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keyed = (v: unknown): v is { id: string }[] =>
  Array.isArray(v) && v.length > 0 && v.every((item) => isObject(item) && typeof item.id === 'string');
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

export function diffPayloads(before: unknown, after: unknown, path = ''): DiffEntry[] {
  const join = (key: string) => (path ? `${path}.${key}` : key);
  if (isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((key) => diffPayloads(before[key], after[key], join(key)));
  }
  if ((keyed(before) || empty(before)) && (keyed(after) || empty(after)) && (keyed(before) || keyed(after))) {
    const a = (before ?? []) as { id: string }[];
    const b = (after ?? []) as { id: string }[];
    const out: DiffEntry[] = [];
    for (const item of a) {
      const next = b.find((x) => x.id === item.id);
      if (!next) out.push({ path: join(item.id), kind: 'removed', before: item });
      else out.push(...diffPayloads(item, next, join(item.id)));
    }
    for (const item of b) if (!a.some((x) => x.id === item.id)) out.push({ path: join(item.id), kind: 'added', after: item });
    return out;
  }
  if (same(before, after) || (empty(before) && empty(after))) return [];
  if (empty(before)) return [{ path, kind: 'added', after }];
  if (empty(after)) return [{ path, kind: 'removed', before }];
  return [{ path, kind: 'changed', before, after }];
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
}

export function summarizeDiff(entries: DiffEntry[]): DiffSummary {
  return {
    added: entries.filter((e) => e.kind === 'added').length,
    removed: entries.filter((e) => e.kind === 'removed').length,
    changed: entries.filter((e) => e.kind === 'changed').length,
  };
}
