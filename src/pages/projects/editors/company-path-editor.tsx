import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { type DecodeMap, type GoalPathSystem, type GoalTargets, type Issue, type KpiBreakdown, emptyGoalTargets, pathsFromDecodeMap, targetsOf } from "@dingze/shared";

import { cn } from "@/lib/utils";

import { GoalTargetsEditor } from "./goal-targets-editor";
import { useEditorChrome } from "@/pages/projects/components/edit-session";
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
  // Which step is open lives in the URL (?zone=), so the route rail and top bar can point at it.
  const [params, setParams] = useSearchParams();
  const zone: "targets" | "paths" = params.get("zone") === "paths" ? "paths" : params.get("zone") === "targets" ? "targets" : hasGoals && (value.nodes ?? []).length ? "paths" : "targets";
  const setZone = (z: "targets" | "paths") => {
    const next = new URLSearchParams(params);
    next.set("zone", z);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (!params.get("zone")) setZone(zone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const map = upstream["S2-01"] as DecodeMap | undefined;
  const imported = pathsFromDecodeMap(map, targets, value);
  const zoneIssues = (prefix: string) => issues.filter((i) => i.message.startsWith(prefix));
  useEditorChrome({ title: "公司级目标路径系统表", chip: "S2-03 · 定目标 · 表 3-4、3-5" }, zone === "targets");

  return (
    <div className="flex flex-col gap-4">
      {/* Issue locating (locate.ts) switches steps through these; people use the route rail. */}
      <div hidden>
        <button type="button" data-zone-tab="targets" onClick={() => setZone("targets")} />
        <button type="button" data-zone-tab="paths" onClick={() => setZone("paths")} />
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
        ) : zone === "paths" ? (
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
            titles={{ map: "公司级目标路径系统图", mapChip: "S2-02 · 思维导图", table: "公司级目标路径系统表", tableSpec: "S2-03" }}
            viewKey="S2-03"
            defaultView="t310"
          />
        ) : null}
      </div>
    </div>
  );
}
