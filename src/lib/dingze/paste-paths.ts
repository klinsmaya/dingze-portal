import { MAX_PATH_LEVEL, type PathNode, parseAmount, pathNode } from "@dingze/shared";

/**
 * 从 Excel 粘贴: the wide layout as copied from Excel — 路径 · 衡量指标 · 指标值 per level, merged
 * cells arrive empty and continue the row above.
 */
export function parsePastedPaths(text: string): PathNode[] {
  const out: PathNode[] = [];
  const current: (PathNode | undefined)[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (!line.trim()) continue;
    // 模板的表头行（一级路径 · 衡量指标 · 指标值 …）
    if (/^一级路径\s*\t/.test(line) && line.includes("指标值")) continue;
    const cells = line.split("\t");
    for (let level = 0; level * 3 < cells.length && level < MAX_PATH_LEVEL; level++) {
      const [path = "", metric = "", value = ""] = cells.slice(level * 3, level * 3 + 3).map((c) => c.trim());
      if (!path) continue;
      const parent = level ? current[level - 1] : undefined;
      if (level && !parent) break;
      const node = pathNode({ parentId: parent?.id ?? null, level: level + 1, path, metric, value, amount: parseAmount(value) });
      out.push(node);
      current[level] = node;
      current.length = level + 1;
    }
  }
  return out;
}

