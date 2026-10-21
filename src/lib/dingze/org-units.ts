import type { OrgUnit } from "./ops-api";

export type OrgNode = OrgUnit & { depth: number };

/**
 * Depth-first order with depth, so the tree renders as an indented list. Units whose
 * parent is missing are shown at the top level instead of disappearing.
 */
export function flattenOrgUnits(units: OrgUnit[]): OrgNode[] {
  const ids = new Set(units.map((u) => u.id));
  const byParent = new Map<number | null, OrgUnit[]>();
  for (const unit of units) {
    const key = unit.parentId && ids.has(unit.parentId) ? unit.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), unit]);
  }
  const out: OrgNode[] = [];
  const seen = new Set<number>();
  const walk = (parentId: number | null, depth: number) => {
    for (const unit of [...(byParent.get(parentId) ?? [])].sort((a, b) => a.sort - b.sort || a.id - b.id)) {
      if (seen.has(unit.id)) continue;
      seen.add(unit.id);
      out.push({ ...unit, depth });
      walk(unit.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** “燃气运营部 › 调度中心” */
export function orgUnitPath(units: OrgUnit[], id: number | null | undefined): string {
  const byId = new Map(units.map((u) => [u.id, u]));
  const names: string[] = [];
  let current = id ? byId.get(id) : undefined;
  while (current && names.length < 10) {
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(" › ");
}

export type OrgRow = { name: string; parent: string; kind: OrgUnit["kind"]; head: string; duty: string };

const KIND_WORDS: Record<string, OrgUnit["kind"]> = { 公司: "company", 部门: "department", 团队: "team", 中心: "department", 小组: "team", 班组: "team" };

/**
 * 从 Excel 粘贴组织表：每行“名称 | 上级 | 类型 | 负责人 | 职责”（后几列可省），可带表头。
 * Parents come before their children in the result, so they can be created in order.
 */
export function parseOrgTable(text: string): { rows: OrgRow[]; problems: string[] } {
  const problems: string[] = [];
  const raw = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.split("\t").map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean));
  if (raw.length && /^(名称|部门|部门名称|组织)$/.test(raw[0][0])) raw.shift();
  const rows: OrgRow[] = [];
  for (const [name = "", parent = "", kind = "", head = "", duty = ""] of raw) {
    if (!name) continue;
    if (rows.some((r) => r.name === name)) {
      problems.push(`「${name}」重复，只取第一行`);
      continue;
    }
    rows.push({ name: name.slice(0, 50), parent, kind: KIND_WORDS[kind] ?? "department", head: head.slice(0, 30), duty: duty.slice(0, 500) });
  }
  const names = new Set(rows.map((r) => r.name));
  const ordered: OrgRow[] = [];
  const placed = new Set<string>();
  const place = (row: OrgRow, trail: string[]) => {
    if (placed.has(row.name)) return;
    if (trail.includes(row.name)) {
      problems.push(`「${row.name}」的上级绕成了圈，按顶层处理`);
      row.parent = "";
    } else {
      const parent = row.parent && names.has(row.parent) ? rows.find((r) => r.name === row.parent)! : null;
      if (parent) place(parent, [...trail, row.name]);
    }
    if (placed.has(row.name)) return;
    placed.add(row.name);
    ordered.push(row);
  };
  for (const row of rows) place(row, []);
  return { rows: ordered, problems };
}
