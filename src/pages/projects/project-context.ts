import { useOutletContext } from "react-router";

import type { ProjectOverview, ProjectSummary } from "@/lib/dingze/api";

export type ProjectContextValue = {
  project: ProjectSummary;
  overview: ProjectOverview;
  /** Top-bar slots the workspace fills with its step title, sub-steps and panel toggle. */
  topbar?: { main: HTMLElement | null; actions: HTMLElement | null };
};

export function useProjectContext() {
  return useOutletContext<ProjectContextValue>();
}
