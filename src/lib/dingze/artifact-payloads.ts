import {
  emptyBudgetWorksheet,
  emptyCharterSet,
  emptyCompanyPlanBook,
  emptyDeptPlanBook,
  emptyProgressPlan,
  emptyResourceMatch,
  emptyDecodeMap,
  emptyDeptUndertakingTable,
  emptyKeyProjectList,
  emptyPathSystem,
  emptyRaciTable,
  emptyScorecardSet,
  emptyIpoocDesign,
  emptyKpiBreakdown,
  emptyKpiScreening,
  emptyMissionWorksheet,
  emptyStrategyContent,
  emptyStrategyKpiTable,
  emptyStrategyLogic,
  emptyStrategyMap,
  emptyCompanyPathSystem,
  emptyVisionWorksheet,
} from "@dingze/shared";

/** Artifacts whose editor is available in this release. */
export const EDITABLE_CODES = new Set([
  "S1-01", "M-MISSION", "M-VISION", "S1-02", "S1-03", "S1-04", "S1-05", "S1-06", "S1-07",
  "M-BUDGET", "S2-01", "S2-03", "S2-08", "S2-04", "S2-05", "S2-06", "S2-07",
  "S3-02", "S3-05", "S3-06", "S3-07", "S3-08",
]);

/** The blank skeleton a new artifact starts from. */
export function emptyPayload(code: string, project: { primaryExpression: "house" | "sixfold"; year: number; scheduleScale?: "month" | "quarter" }): unknown {
  switch (code) {
    case "S1-01":
      return emptyStrategyContent("sixfold");
    case "M-MISSION":
      return emptyMissionWorksheet();
    case "M-VISION":
      return emptyVisionWorksheet();
    case "S1-02":
      return emptyStrategyMap();
    case "S1-03":
      return emptyStrategyLogic();
    case "S1-04":
      return emptyIpoocDesign();
    case "S1-05":
      return emptyKpiScreening();
    case "S1-06":
      return emptyStrategyKpiTable();
    case "S1-07":
      return emptyKpiBreakdown(project.year);
    case "M-BUDGET":
      return emptyBudgetWorksheet();
    case "S2-01":
      return emptyDecodeMap();
    case "S2-03":
      return emptyCompanyPathSystem(project.year);
    case "S2-06":
      return emptyPathSystem();
    case "S2-08":
      return emptyKeyProjectList();
    case "S2-04":
      return emptyRaciTable();
    case "S2-05":
      return emptyDeptUndertakingTable();
    case "S2-07":
      return emptyScorecardSet();
    case "S3-02":
      return emptyCharterSet();
    case "S3-05":
      return emptyProgressPlan(project.scheduleScale ?? "month");
    case "S3-06":
      return emptyResourceMatch();
    case "S3-07":
      return emptyCompanyPlanBook();
    case "S3-08":
      return emptyDeptPlanBook();
    default:
      return null;
  }
}
