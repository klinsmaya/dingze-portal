import { useOutletContext } from "react-router";

import type { ProjectOverview, ProjectSummary } from "@/lib/dingze/api";

export type ProjectContextValue = {
  project: ProjectSummary;
  overview: ProjectOverview;
  /** Top-bar slot the workspace fills with its panel toggle. */
  topbar?: { actions: HTMLElement | null };
};

export function useProjectContext() {
  return useOutletContext<ProjectContextValue>();
}
