import type { GoalPathSystem, KeyProjectList } from "@dingze/shared";

/**
 * What a RACI row stands for, for department undertakings: a path carries its own
 * metric and value; a key project uses its first source path, else its objective.
 */
export function sourceLookup(paths: GoalPathSystem | undefined, projects: KeyProjectList | undefined) {
  const nodes = paths?.nodes ?? [];
  return (sourceId: string | null) => {
    if (!sourceId) return null;
    const node = nodes.find((n) => n.id === sourceId);
    if (node) {
      const parent = nodes.find((n) => n.id === node.parentId);
      return { metric: node.metric, value: node.value, purpose: parent ? `支撑“${parent.path}”` : `承接“${node.path}”` };
    }
    const project = projects?.projects?.find((p) => p.id === sourceId);
    if (!project) return null;
    const source = nodes.find((n) => n.id === project.sourcePathIds?.[0]);
    return source
      ? { metric: source.metric, value: source.value, purpose: `推进关键项目“${project.name}”` }
      : { metric: "项目目标", value: project.objective, purpose: `推进关键项目“${project.name}”` };
  };
}
