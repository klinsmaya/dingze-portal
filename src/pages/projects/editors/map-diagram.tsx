import type { StrategyMap } from "@dingze/shared";

import { LANE_LABEL_WIDTH, layoutStrategyMap, linkLines } from "@/lib/dingze/map-layout";

const DIAGRAM_WIDTH = 960;

/** Perspective lanes with nodes and links; shared by the strategy map and the decode map. */
export function MapDiagram({ map, label = "战略地图" }: { map: StrategyMap; label?: string }) {
  const { lanes, nodes, height } = layoutStrategyMap(map, DIAGRAM_WIDTH);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-2">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${DIAGRAM_WIDTH} ${height}`}
        className="min-w-[720px] text-foreground"
        style={{ width: "100%", height: "auto" }}
      >
        <defs>
          <marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--brand)" />
          </marker>
        </defs>
        {lanes.map((lane, i) => (
          <g key={lane.key}>
            <rect x={0} y={lane.y} width={DIAGRAM_WIDTH} height={120} fill={i % 2 ? "var(--muted)" : "transparent"} opacity={0.6} />
            <text x={12} y={lane.y + 64} fontSize={14} fontWeight={700} fill="var(--brand)">
              {lane.label}
            </text>
            <line x1={LANE_LABEL_WIDTH} x2={LANE_LABEL_WIDTH} y1={lane.y} y2={lane.y + 120} stroke="var(--border)" />
          </g>
        ))}
        {linkLines(map.links, byId).map((l) =>
          l.kind === "synergy" ? (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--gold)" strokeWidth={2} strokeDasharray="6 4" />
          ) : (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--brand)" strokeWidth={1.5} markerEnd="url(#map-arrow)" />
          )
        )}
        {nodes.map((node) => (
          <foreignObject key={node.id} x={node.x} y={node.y} width={node.w} height={node.h}>
            <div className="flex h-full items-center justify-center rounded-lg border-2 border-brand bg-card px-2 text-center text-xs leading-snug font-semibold text-brand">
              <span className="line-clamp-3">{node.title || "（未命名）"}</span>
            </div>
          </foreignObject>
        ))}
      </svg>
      <p className="px-2 pt-1 text-xs text-muted-foreground">实线箭头：纵向因果；金色虚线：横向协同。</p>
    </div>
  );
}
