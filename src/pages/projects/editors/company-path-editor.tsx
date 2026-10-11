import { useState } from "react";

import { type DecodeMap, type GoalPathSystem, type GoalTargets, type Issue, type KpiBreakdown, emptyGoalTargets, pathsFromDecodeMap, targetsOf } from "@dingze/shared";

import { cn } from "@/lib/utils";

import { GoalTargetsEditor } from "./goal-targets-editor";
import { FindPathSteps } from "./find-path";
import { PathSystemEditor } from "./path-system-editor";

type Props = {
  value: GoalPathSystem;
  onChange: (next: GoalPathSystem) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: Record<string, unknown>;
  projectYear: number;
};

/**
 * S2-03 公司级目标路径系统表: 第一步 定目标 (target zone, 表 3-4/3-5) and 第二步 找路径
 * (paths, 表 3-9/3-10, with the S2-02 graph view). S2-01 sits between the two steps.
 */
export function CompanyPathEditor({ value, onChange, readOnly, issues, upstream, projectYear }: Props) {
  const targets: GoalTargets = targetsOf(value) ?? emptyGoalTargets(projectYear);
  const hasGoals = (targets.goals ?? []).length > 0;
  const [zone, setZone] = useState<"targets" | "paths">(hasGoals && (value.nodes ?? []).length ? "paths" : "targets");
  const map = upstream["S2-01"] as DecodeMap | undefined;
  const imported = pathsFromDecodeMap(map, targets, value);
  const zoneIssues = (prefix: string) => issues.filter((i) => i.message.startsWith(prefix));

  const steps = [
    { key: "targets" as const, no: "第一步", title: "定目标", hint: "往上看、往回看，确定公司年度目标", count: zoneIssues("定目标").filter((i) => i.level === "error").length },
    { key: "paths" as const, no: "第二步", title: "找路径", hint: "先做 S2-01 解码地图，再导入并分解到三、四级", count: zoneIssues("找路径").filter((i) => i.level === "error").length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="公司级目标路径系统表的两步" className="grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={zone === s.key}
            data-zone-tab={s.key}
            onClick={() => setZone(s.key)}
            className={cn(
              "flex flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-colors",
              zone === s.key ? "border-brand bg-brand/5" : "bg-card hover:border-brand/40"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-brand">
              <span className="text-xs font-normal text-muted-foreground">{s.no}</span> {s.title}
              {s.count ? <span className="rounded-full bg-destructive/10 px-1.5 text-xs text-destructive">{s.count}</span> : null}
            </span>
            <span className="text-xs text-muted-foreground">{s.hint}</span>
          </button>
        ))}
      </div>

      <div data-zone="targets" className={cn(zone !== "targets" && "hidden")}>
        <GoalTargetsEditor
          value={targets}
          onChange={(next) => onChange({ ...value, targets: next })}
          readOnly={readOnly}
          issues={zoneIssues("定目标")}
          upstream={upstream as { "S1-07"?: KpiBreakdown }}
          projectYear={projectYear}
        />
      </div>
      <div data-zone="paths" className={cn(zone !== "paths" && "hidden")}>
        {!hasGoals ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            先在“第一步 定目标”里确定至少一个年度目标，再来找路径。
          </p>
        ) : (
          <div className="flex flex-col gap-3">
          <FindPathSteps active={5} map={map} paths={value} />
          <PathSystemEditor
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            issues={zoneIssues("找路径")}
            goalWord="年度目标"
            goals={(targets.goals ?? []).map((g) => ({ id: g.id, label: g.task || g.metric, metric: g.metric, value: g.value }))}
            importFromMap={{ count: imported.nodes.length - (value.nodes ?? []).length, run: () => onChange(imported) }}
            decodeLayout
            graphSpecId="S2-02"
            viewKey="S2-03"
            defaultView="t310"
          />
          </div>
        )}
      </div>
    </div>
  );
}
