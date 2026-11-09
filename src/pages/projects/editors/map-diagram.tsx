import type { StrategyMap } from "@dingze/shared";

import { LANE_LABEL_WIDTH, type NodeShape, layoutStrategyMap, linkLines } from "@/lib/dingze/map-layout";
import { cn } from "@/lib/utils";

const DIAGRAM_WIDTH = 960;

/** Perspective lanes with nodes and links; shared by the strategy map (ellipses) and the decode map (boxes). */
export function MapDiagram({ map, label = "战略地图", shape = "box" }: { map: StrategyMap; label?: string; shape?: NodeShape }) {
  const { lanes, nodes, height } = layoutStrategyMap(map, DIAGRAM_WIDTH);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ellipse = shape === "ellipse";
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
        {linkLines(map.links, byId, shape).map((l) =>
          l.kind === "synergy" ? (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--gold)" strokeWidth={2} strokeDasharray="6 4" />
          ) : (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--brand)" strokeWidth={1.5} markerEnd="url(#map-arrow)" />
          )
        )}
        {nodes.map((node) => (
          <g key={node.id}>
            {ellipse ? (
              <ellipse cx={node.x + node.w / 2} cy={node.y + node.h / 2} rx={node.w / 2 - 1} ry={node.h / 2 - 1} fill="var(--card)" stroke="var(--brand)" strokeWidth={2} />
            ) : null}
            <foreignObject x={node.x} y={node.y} width={node.w} height={node.h}>
              <div
                className={cn(
                  "flex h-full items-center justify-center text-center text-xs leading-snug font-semibold text-brand",
                  ellipse ? "px-6" : "rounded-lg border-2 border-brand bg-card px-2",
                )}
              >
                <span className={ellipse ? "line-clamp-2" : "line-clamp-3"}>{node.title || "（未命名）"}</span>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
    </div>
  );
}
