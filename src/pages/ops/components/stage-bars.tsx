import type { OpsBoardProject } from "@/lib/dingze/ops-api";
import { cn } from "@/lib/utils";

/** 三阶段的定版进度条（P0 成果已定版 / 总数）。 */
export function StageBars({ stages }: { stages: OpsBoardProject["stages"] }) {
  return (
    <div className="flex min-w-44 flex-col gap-1">
      {stages.map((s) => {
        const done = s.total > 0 && s.locked === s.total;
        return (
          <div key={s.key} className="flex items-center gap-2 text-xs" title={`${s.name}：已定版 ${s.locked} / ${s.total} 项 P0 成果`}>
            <span className="w-14 shrink-0 text-muted-foreground">{s.name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", done ? "bg-status-done-foreground" : "bg-brand")} style={{ width: `${s.total ? (s.locked / s.total) * 100 : 0}%` }} />
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums">
              {s.locked}/{s.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
