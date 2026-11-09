const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * 本表里引用了某个上游条目的行：哪一行的某个字段（或自己的 id）等于这个 id，返回行锚点（如 "kpis.k2"）。
 * 上游改了什么 → 定位本表受影响的行用；只看字符串字段，不猜语义。
 */
export function referencesOf(payload: unknown, id: string): string[] {
  if (!id) return [];
  const out = new Set<string>();
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const key = isObject(item) && typeof item.id === "string" ? item.id : String(i);
        walk(item, path ? `${path}.${key}` : key);
      });
      return;
    }
    if (!isObject(value)) return;
    const row = path && typeof value.id === "string" ? path : "";
    for (const [k, v] of Object.entries(value)) {
      if (k === "id") {
        if (v === id && row) out.add(row);
        continue;
      }
      const hit = v === id || (Array.isArray(v) && v.includes(id));
      if (hit) out.add(row || (path ? `${path}.${k}` : k));
      else walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(payload, "");
  return [...out];
}

/** 一条上游差异路径里可能是条目 id 的段（去掉集合名和字段名）。 */
export function idsInPath(path: string): string[] {
  const parts = path.split(".").filter(Boolean);
  return parts.length >= 2 ? parts.slice(1) : [];
}
