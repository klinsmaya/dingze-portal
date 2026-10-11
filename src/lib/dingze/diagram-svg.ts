import { SIXFOLD_FIELDS, houseStarted, type StrategyContent, type StrategyMap } from "@dingze/shared";

import { LANE_HEIGHT, LANE_LABEL_WIDTH, layoutStrategyMap, linkLines } from "./map-layout";

// Standalone SVG for the strategy house / 六分法 (S1-01) and the strategy map (S1-02):
// downloaded as SVG or PNG and embedded in the company plan book. Plain text and shapes
// only (no foreignObject), fixed light colours, so the file renders the same in a browser,
// on a canvas and in Word.

export type SvgDiagram = { svg: string; width: number; height: number };

const WIDTH = 960;
const FONT = `"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC",sans-serif`;
const C = {
  brand: "#0c3d52",
  brandText: "#ffffff",
  gold: "#c8a27a",
  muted: "#eef4f6",
  border: "#dce5e8",
  text: "#0f2530",
  sub: "#587079",
  paper: "#ffffff",
};

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Rough advance width: CJK and full-width forms take 1em, everything else about half. */
function charWidth(ch: string, fontSize: number): number {
  return /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? fontSize : fontSize * 0.56;
}

/** Break text into lines that fit `maxWidth`; the last allowed line ends in “…” when cut. */
export function wrapText(text: string, maxWidth: number, fontSize: number, maxLines = Infinity): string[] {
  const lines: string[] = [];
  for (const paragraph of (text ?? "").replace(/\r/g, "").split("\n")) {
    let line = "";
    let width = 0;
    for (const ch of paragraph) {
      const w = charWidth(ch, fontSize);
      if (width + w > maxWidth && line) {
        lines.push(line);
        line = "";
        width = 0;
      }
      line += ch;
      width += w;
    }
    lines.push(line);
  }
  while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && [...last].reduce((n, ch) => n + charWidth(ch, fontSize), 0) + fontSize > maxWidth) last = [...last].slice(0, -1).join("");
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function textLines(lines: string[], x: number, y: number, opts: { size: number; color: string; weight?: number; anchor?: "start" | "middle"; lineHeight?: number }): string {
  const lh = opts.lineHeight ?? Math.round(opts.size * 1.5);
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * lh}" font-size="${opts.size}" fill="${opts.color}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}${opts.anchor === "middle" ? ' text-anchor="middle"' : ""}>${escapeXml(line)}</text>`
    )
    .join("");
}

const BODY = 13;
const BODY_LH = 20;
const LABEL = 11;

/** A labelled text cell: its height for the given width, and the markup at (x, y). */
function cell(label: string, value: string, w: number, color = C.text, labelColor = C.sub) {
  const lines = wrapText(value.trim() || "—", w - 20, BODY, 8);
  const height = 14 + 16 + lines.length * BODY_LH + 6;
  return {
    height,
    draw: (x: number, y: number) =>
      (label ? textLines([label], x + 10, y + 20, { size: LABEL, color: labelColor, weight: 700 }) : "") +
      textLines(lines, x + 10, y + (label ? 40 : 24), { size: BODY, color, lineHeight: BODY_LH }),
  };
}

function wrap(width: number, height: number, body: string, title: string): SvgDiagram {
  return {
    width,
    height,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family='${FONT}'>` +
      `<title>${escapeXml(title)}</title><rect width="${width}" height="${height}" fill="${C.paper}"/>${body}</svg>`,
  };
}

function header(title: string, subtitle: string | undefined): { svg: string; height: number } {
  return {
    height: subtitle ? 64 : 48,
    svg:
      textLines([title], WIDTH / 2, 34, { size: 20, color: C.brand, weight: 700, anchor: "middle" }) +
      (subtitle ? textLines([subtitle], WIDTH / 2, 56, { size: 12, color: C.sub, anchor: "middle" }) : ""),
  };
}

/** 战略屋: roof (使命 / 愿景 / 价值观), goals, battlefields by row, and the foundation. */
export function strategyHouseSvg(content: StrategyContent, subtitle?: string): SvgDiagram {
  const margin = 32;
  const inner = WIDTH - margin * 2;
  const labelW = 128;
  const head = header("战略屋", subtitle);
  let y = head.height + 8;
  let body = head.svg;

  // Roof: a gable over three columns.
  const roofRise = 72;
  const roofCols = [
    ["使命", content.mission],
    ["愿景", content.vision],
    ["价值观", content.values],
  ].map(([l, v]) => cell(l, v ?? "", (inner - 24) / 3, C.brandText, C.gold));
  const roofBody = Math.max(...roofCols.map((c) => c.height)) + 12;
  body += `<polygon points="${WIDTH / 2},${y} ${WIDTH - margin + 8},${y + roofRise} ${WIDTH - margin},${y + roofRise} ${WIDTH - margin},${y + roofRise + roofBody} ${margin},${y + roofRise + roofBody} ${margin},${y + roofRise} ${margin - 8},${y + roofRise}" fill="${C.brand}"/>`;
  roofCols.forEach((c, i) => (body += c.draw(margin + 12 + i * ((inner - 24) / 3), y + roofRise)));
  y += roofRise + roofBody;

  const battlefields = content.battlefields ?? [];
  const rows: { label: string; hint: string; cells: [string, string][] }[] = [
    { label: "经营目标", hint: "财务＋非财务", cells: [["一年", content.goals?.y1 ?? ""], ["三年", content.goals?.y3 ?? ""], ["五年", content.goals?.y5 ?? ""]] },
    { label: "主要战场", hint: "业务组合 · 增长曲线", cells: battlefields.map((b, i) => [`第${["一", "二", "三", "四"][i] ?? i + 1}增长曲线`, b.name]) },
    { label: "如何致胜", hint: "可持续核心优势", cells: battlefields.map((b, i) => [`第 ${i + 1} 个战场`, b.advantage]) },
    { label: "必赢之战", hint: "年度落地抓手", cells: battlefields.map((b, i) => [`第 ${i + 1} 个战场`, b.mustWin]) },
  ];
  for (const row of rows) {
    const cols = Math.max(row.cells.length, 1);
    const colW = (inner - labelW) / cols;
    const cells = row.cells.length ? row.cells.map(([l, v]) => cell(l, v, colW)) : [cell("", "（还没有主要战场）", colW, C.sub)];
    const hint = wrapText(row.hint, labelW - 20, 10, 2);
    const h = Math.max(56, 44 + hint.length * 14, ...cells.map((c) => c.height));
    body += `<rect x="${margin}" y="${y}" width="${inner}" height="${h}" fill="${C.paper}" stroke="${C.border}"/>`;
    body += `<rect x="${margin}" y="${y}" width="${labelW}" height="${h}" fill="${C.muted}" stroke="${C.border}"/>`;
    body += textLines([row.label], margin + 12, y + 26, { size: 14, color: C.brand, weight: 700 });
    body += textLines(hint, margin + 12, y + 44, { size: 10, color: C.sub, lineHeight: 14 });
    cells.forEach((c, i) => {
      const x = margin + labelW + i * colW;
      if (i > 0) body += `<line x1="${x}" x2="${x}" y1="${y}" y2="${y + h}" stroke="${C.border}"/>`;
      body += c.draw(x, y);
    });
    y += h;
  }

  // Foundation.
  const baseCols = [
    ["组织", content.foundation?.organization ?? ""],
    ["机制", content.foundation?.mechanism ?? ""],
    ["人才", content.foundation?.talent ?? ""],
  ].map(([l, v]) => cell(l, v, (inner - labelW) / 3));
  const baseH = Math.max(56, ...baseCols.map((c) => c.height));
  y += 8;
  body += `<rect x="${margin}" y="${y}" width="${inner}" height="${baseH}" fill="${C.muted}" stroke="${C.border}"/><rect x="${margin}" y="${y}" width="${inner}" height="3" fill="${C.brand}"/>`;
  body += textLines(["落地保障"], margin + 12, y + 26, { size: 14, color: C.brand, weight: 700 });
  body += textLines(["地基"], margin + 12, y + 44, { size: 10, color: C.sub });
  baseCols.forEach((c, i) => (body += c.draw(margin + labelW + i * ((inner - labelW) / 3), y)));
  y += baseH + margin;

  return wrap(WIDTH, y, body, "战略屋");
}

/** 战略简约六分法表: six labelled rows. */
export function sixfoldSvg(content: StrategyContent, subtitle?: string): SvgDiagram {
  const margin = 32;
  const inner = WIDTH - margin * 2;
  const labelW = 150;
  const head = header("战略简约六分法表", subtitle);
  let y = head.height + 8;
  let body = head.svg;
  for (const [i, f] of SIXFOLD_FIELDS.entries()) {
    const c = cell("", String(content[f.key] ?? ""), inner - labelW);
    const h = Math.max(48, c.height);
    body += `<rect x="${margin}" y="${y}" width="${inner}" height="${h}" fill="${C.paper}" stroke="${C.border}"/>`;
    body += `<rect x="${margin}" y="${y}" width="${labelW}" height="${h}" fill="${i < 2 ? C.brand : C.muted}" stroke="${C.border}"/>`;
    body += textLines([f.label], margin + 14, y + 28, { size: 14, color: i < 2 ? C.brandText : C.brand, weight: 700 });
    body += c.draw(margin + labelW, y);
    y += h;
  }
  return wrap(WIDTH, y + margin, body, "战略简约六分法表");
}

/** 战略地图: four perspective lanes, objectives as boxes, cause arrows and synergy dashes. */
export function strategyMapSvg(map: StrategyMap, subtitle?: string, title = "战略地图"): SvgDiagram {
  const head = header(title, subtitle);
  const top = head.height + 8;
  const { lanes, nodes, height } = layoutStrategyMap(map, WIDTH);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let body = head.svg;
  body += `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.brand}"/></marker></defs>`;
  body += `<g transform="translate(0 ${top})">`;
  lanes.forEach((lane, i) => {
    body += `<rect x="0" y="${lane.y}" width="${WIDTH}" height="${LANE_HEIGHT}" fill="${i % 2 ? C.muted : C.paper}"/>`;
    body += textLines([lane.label], 14, lane.y + LANE_HEIGHT / 2 + 5, { size: 14, color: C.brand, weight: 700 });
    body += `<line x1="${LANE_LABEL_WIDTH}" x2="${LANE_LABEL_WIDTH}" y1="${lane.y}" y2="${lane.y + LANE_HEIGHT}" stroke="${C.border}"/>`;
  });
  for (const l of linkLines(map.links, byId)) {
    body +=
      l.kind === "synergy"
        ? `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${C.gold}" stroke-width="2" stroke-dasharray="6 4"/>`
        : `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${C.brand}" stroke-width="1.5" marker-end="url(#arrow)"/>`;
  }
  for (const n of nodes) {
    const lines = wrapText(n.title || "（未命名）", n.w - 14, 12, 3);
    const lh = 16;
    const firstY = n.y + n.h / 2 - ((lines.length - 1) * lh) / 2 + 4;
    body += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${C.paper}" stroke="${C.brand}" stroke-width="2"/>`;
    body += textLines(lines, n.x + n.w / 2, firstY, { size: 12, color: C.brand, weight: 700, anchor: "middle", lineHeight: lh });
  }
  if (!nodes.length) body += textLines(["还没有战略目标"], WIDTH / 2, height / 2, { size: 14, color: C.sub, anchor: "middle" });
  body += `</g>`;
  const legendY = top + height + 24;
  body += `<line x1="32" x2="64" y1="${legendY - 4}" y2="${legendY - 4}" stroke="${C.brand}" stroke-width="1.5" marker-end="url(#arrow)"/>`;
  body += textLines(["纵向因果（下层支撑上层）"], 72, legendY, { size: 12, color: C.sub });
  body += `<line x1="260" x2="292" y1="${legendY - 4}" y2="${legendY - 4}" stroke="${C.gold}" stroke-width="2" stroke-dasharray="6 4"/>`;
  body += textLines(["横向协同"], 300, legendY, { size: 12, color: C.sub });
  return wrap(WIDTH, legendY + 20, body, title);
}

/** The diagrams of an artifact: S1-01 六分法 (plus the strategy house when filled in), S1-02 战略地图. */
export function artifactDiagrams(code: string, payload: unknown, subtitle?: string): { key: string; label: string; diagram: SvgDiagram }[] {
  if (!payload || typeof payload !== "object") return [];
  if (code === "S1-01") {
    const content = payload as StrategyContent;
    return [
      { key: "sixfold", label: "战略简约六分法表", diagram: sixfoldSvg(content, subtitle) },
      ...(houseStarted(content) ? [{ key: "house", label: "战略屋", diagram: strategyHouseSvg(content, subtitle) }] : []),
    ];
  }
  if (code === "S1-02") return [{ key: "map", label: "战略地图", diagram: strategyMapSvg(payload as StrategyMap, subtitle) }];
  return [];
}
