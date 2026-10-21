import { PERSPECTIVES, type StrategyMap } from "@dingze/shared";

export const LANE_HEIGHT = 120;
export const LANE_LABEL_WIDTH = 96;
const NODE_HEIGHT = 64;
const GAP = 16;
const MAX_NODE_WIDTH = 200;

export type LaidOutNode = { id: string; x: number; y: number; w: number; h: number; title: string };
export type LaidOutLane = { key: string; label: string; y: number };

/**
 * One horizontal lane per perspective (财务 on top); the objectives of a lane share its
 * width evenly, so nodes stay inside their lane and never overlap.
 */
export function layoutStrategyMap(map: StrategyMap, width: number) {
  const lanes: LaidOutLane[] = PERSPECTIVES.map((p, i) => ({ key: p.key, label: p.label, y: i * LANE_HEIGHT }));
  const nodes: LaidOutNode[] = [];
  const usable = Math.max(width - LANE_LABEL_WIDTH - GAP, 120);
  for (const [laneIndex, perspective] of PERSPECTIVES.entries()) {
    const items = map.objectives.filter((o) => o.perspective === perspective.key);
    if (items.length === 0) continue;
    const w = Math.min(MAX_NODE_WIDTH, (usable - GAP * (items.length - 1)) / items.length);
    const total = w * items.length + GAP * (items.length - 1);
    const left = LANE_LABEL_WIDTH + GAP / 2 + (usable - total) / 2;
    items.forEach((o, i) => {
      nodes.push({
        id: o.id,
        x: left + i * (w + GAP),
        y: laneIndex * LANE_HEIGHT + (LANE_HEIGHT - NODE_HEIGHT) / 2,
        w,
        h: NODE_HEIGHT,
        title: o.title,
      });
    });
  }
  return { lanes, nodes, height: PERSPECTIVES.length * LANE_HEIGHT };
}

type Box = { x: number; y: number; w: number; h: number };
export type LinkLine = { id: string; kind: "cause" | "synergy"; x1: number; y1: number; x2: number; y2: number };

/**
 * Line ends for the map's links. Cause arrows leave the top or bottom edge and spread their
 * ends along it, so several arrows into one objective stay apart; synergy links join the
 * facing sides. Links to missing objectives are dropped.
 */
export function linkLines(links: StrategyMap["links"], byId: Map<string, Box>): LinkLine[] {
  const cause = (links ?? []).filter((l) => l.kind !== "synergy" && byId.has(l.from) && byId.has(l.to));
  // Each edge (node + side) lists its links ordered by where the other end sits.
  const slots = new Map<string, string[]>();
  const add = (key: string, linkId: string) => slots.set(key, [...(slots.get(key) ?? []), linkId]);
  const otherX = new Map<string, number>();
  for (const l of cause) {
    const from = byId.get(l.from)!;
    const to = byId.get(l.to)!;
    const upward = to.y < from.y;
    add(`${l.from}:${upward ? "top" : "bottom"}`, `${l.id}:from`);
    add(`${l.to}:${upward ? "bottom" : "top"}`, `${l.id}:to`);
    otherX.set(`${l.id}:from`, to.x + to.w / 2);
    otherX.set(`${l.id}:to`, from.x + from.w / 2);
  }
  for (const ids of slots.values()) ids.sort((a, b) => otherX.get(a)! - otherX.get(b)!);
  const at = (nodeId: string, side: string, end: string) => {
    const box = byId.get(nodeId)!;
    const ids = slots.get(`${nodeId}:${side}`)!;
    const index = ids.indexOf(end);
    return box.x + (box.w * (index + 1)) / (ids.length + 1);
  };

  const lines: LinkLine[] = [];
  for (const l of links ?? []) {
    const from = byId.get(l.from);
    const to = byId.get(l.to);
    if (!from || !to) continue;
    if (l.kind === "synergy") {
      const [a, b] = from.x < to.x ? [from, to] : [to, from];
      lines.push({ id: l.id, kind: "synergy", x1: a.x + a.w, y1: a.y + a.h / 2, x2: b.x, y2: b.y + b.h / 2 });
      continue;
    }
    const upward = to.y < from.y;
    lines.push({
      id: l.id,
      kind: "cause",
      x1: at(l.from, upward ? "top" : "bottom", `${l.id}:from`),
      y1: upward ? from.y : from.y + from.h,
      x2: at(l.to, upward ? "bottom" : "top", `${l.id}:to`),
      y2: upward ? to.y + to.h : to.y,
    });
  }
  return lines;
}
