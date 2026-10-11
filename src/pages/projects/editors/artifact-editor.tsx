import {
  type BudgetWorksheet,
  type CompanyPlanBook,
  type DeptPlanBook,
  type ProgressPlan,
  type ProjectCharterSet,
  type ResourceMatch,
  type DecodeMap,
  type DeptUndertakingTable,
  type GoalPathSystem,
  type KeyProjectList,
  type RaciTable,
  type ScorecardSet,
} from "@dingze/shared";
import type {
  IpoocDesign,
  Issue,
  KpiBreakdown,
  KpiScreening,
  MissionWorksheet,
  StrategyContent,
  StrategyKpiTable,
  StrategyLogic,
  StrategyMap,
  VisionWorksheet,
} from "@dingze/shared";

import type { ProjectOrgUnit, ProjectTeamMember } from "@/lib/dingze/api";

import { CharterEditor } from "./charter-editor";
import { CompanyPathEditor } from "./company-path-editor";
import { DecodeMapEditor } from "./decode-map-editor";
import { BudgetWorksheetEditor } from "./goal-targets-editor";
import { IpoocEditor } from "./ipooc-editor";
import { KeyProjectsEditor } from "./key-projects-editor";
import { PathSystemEditor } from "./path-system-editor";
import { CompanyPlanBookEditor, DeptPlanBookEditor } from "./plan-book-editor";
import { ProgressPlanEditor } from "./progress-plan-editor";
import { RaciEditor } from "./raci-editor";
import { ResourceMatchEditor } from "./resource-match-editor";
import { ScorecardEditor } from "./scorecard-editor";
import { UndertakingEditor } from "./undertaking-editor";
import { KpiBreakdownEditor } from "./kpi-breakdown-editor";
import { KpiScreeningEditor } from "./kpi-screening-editor";
import { StrategyContentEditor } from "./strategy-content-editor";
import { StrategyKpiEditor } from "./strategy-kpi-editor";
import { StrategyLogicEditor } from "./strategy-logic-editor";
import { StrategyMapEditor } from "./strategy-map-editor";
import { MissionWorksheetEditor, VisionWorksheetEditor } from "./worksheet-editors";

type Props = {
  code: string;
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly: boolean;
  issues: Issue[];
  /** Upstream payloads by code (current versions). */
  upstream: Record<string, unknown>;
  projectYear: number;
  keyProjectLevel: 1 | 2;
  orgUnits: ProjectOrgUnit[];
  team: ProjectTeamMember[];
  scheduleScale: "month" | "quarter";
  enterprise: string;
};

/** Picks the editor for an artifact code; every editor works on that code's payload type. */
export function ArtifactEditor({
  code,
  value,
  onChange,
  readOnly,
  issues,
  upstream,
  projectYear,
  keyProjectLevel,
  orgUnits,
  team,
  scheduleScale,
  enterprise,
}: Props) {
  const people = team.map((m) => m.nickname).filter(Boolean);
  const common = { readOnly, issues, onChange };
  switch (code) {
    case "S1-01":
      return <StrategyContentEditor {...common} value={value as StrategyContent} />;
    case "M-MISSION":
      return <MissionWorksheetEditor {...common} value={value as MissionWorksheet} />;
    case "M-VISION":
      return <VisionWorksheetEditor {...common} value={value as VisionWorksheet} />;
    case "S1-02":
      return <StrategyMapEditor {...common} value={value as StrategyMap} upstream={upstream as { "S1-01"?: StrategyContent }} />;
    case "S1-03":
      return <StrategyLogicEditor {...common} value={value as StrategyLogic} upstream={upstream as { "S1-01"?: StrategyContent }} />;
    case "S1-04":
      return <IpoocEditor {...common} value={value as IpoocDesign} upstream={upstream as { "S1-03"?: StrategyLogic }} />;
    case "S1-05":
      return <KpiScreeningEditor {...common} value={value as KpiScreening} upstream={upstream as { "S1-04"?: IpoocDesign }} />;
    case "S1-06":
      return <StrategyKpiEditor {...common} value={value as StrategyKpiTable} upstream={upstream as { "S1-05"?: KpiScreening }} />;
    case "S1-07":
      return (
        <KpiBreakdownEditor
          {...common}
          value={value as KpiBreakdown}
          upstream={upstream as { "S1-06"?: StrategyKpiTable }}
          projectYear={projectYear}
        />
      );
    case "M-BUDGET":
      return <BudgetWorksheetEditor {...common} value={value as BudgetWorksheet} />;
    case "S2-01":
      return <DecodeMapEditor {...common} value={value as DecodeMap} upstream={upstream as { "S2-03"?: GoalPathSystem }} />;
    case "S2-03":
      return <CompanyPathEditor {...common} value={value as GoalPathSystem} upstream={upstream} projectYear={projectYear} />;
    case "S2-06": {
      const rows = (upstream["S2-05"] as DeptUndertakingTable | undefined)?.rows ?? [];
      return (
        <PathSystemEditor
          {...common}
          value={value as GoalPathSystem}
          goalWord="部门目标"
          viewKey="S2-06"
          goals={rows.map((r) => ({ id: r.id, label: r.task, metric: r.metric, value: r.value, group: r.deptName }))}
        />
      );
    }
    case "S2-08":
      return (
        <KeyProjectsEditor
          {...common}
          value={value as KeyProjectList}
          upstream={upstream as { "S2-03"?: GoalPathSystem }}
          keyProjectLevel={keyProjectLevel}
          people={people}
        />
      );
    case "S2-04":
      return <RaciEditor {...common} value={value as RaciTable} upstream={upstream} orgUnits={orgUnits} />;
    case "S2-05":
      return <UndertakingEditor {...common} value={value as DeptUndertakingTable} upstream={upstream} />;
    case "S2-07":
      return <ScorecardEditor {...common} value={value as ScorecardSet} upstream={upstream as { "S2-05"?: DeptUndertakingTable }} />;
    case "S3-02":
      return <CharterEditor {...common} value={value as ProjectCharterSet} upstream={upstream} projectYear={projectYear} people={people} />;
    case "S3-05":
      return (
        <ProgressPlanEditor
          {...common}
          value={value as ProgressPlan}
          upstream={upstream as { "S3-02"?: ProjectCharterSet }}
          projectYear={projectYear}
          scheduleScale={scheduleScale}
        />
      );
    case "S3-06":
      return <ResourceMatchEditor {...common} value={value as ResourceMatch} upstream={upstream as { "S3-02"?: ProjectCharterSet }} />;
    case "S3-07":
      return <CompanyPlanBookEditor {...common} value={value as CompanyPlanBook} upstream={upstream} enterprise={enterprise} projectYear={projectYear} />;
    case "S3-08":
      return <DeptPlanBookEditor {...common} value={value as DeptPlanBook} upstream={upstream} enterprise={enterprise} projectYear={projectYear} />;
    default:
      return null;
  }
}
