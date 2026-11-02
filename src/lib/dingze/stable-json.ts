// jsonb in the database does not keep key order, so a saved payload comes back with the same data in a
// different key order. Comparing with plain JSON.stringify then reports “未保存” forever after a save.

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = sortKeys((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/** JSON text that does not depend on key order (undefined fields are dropped, as JSON.stringify does). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? "undefined";
}

/** Same data, whatever the key order. */
export function samePayload(a: unknown, b: unknown): boolean {
  return a === b || stableStringify(a) === stableStringify(b);
}
