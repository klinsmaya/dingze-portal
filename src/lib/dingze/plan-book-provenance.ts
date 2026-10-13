import type { Provenance } from "./plan-book";
import type { PlanBookSources } from "./records-api";

/** The 版本与来源 lines for a plan book export (验收 D01 / D08). */
export function planBookProvenance(s: PlanBookSources, project: { enterprise: string; year: number; name: string }, now = new Date()): Provenance {
  const lines = [
    `项目：${project.enterprise} · ${project.name}（${project.year} 年度）`,
    s.locked ? `本文件：定版 v${s.rev}，正文和各表都取自这一版定版时引用的版本` : `本文件：草稿 v${s.rev}（未定版，仅供讨论）`,
    `生成时间：${now.toLocaleString("zh-CN", { hour12: false })}`,
  ];
  if (s.locked && !s.recorded) lines.push("来源版本按计划书定版的时间回溯（这一版定版早于来源记录功能上线）。");
  if (s.locked && s.stale) lines.push(`注意：定版之后上游已有改动（${s.staleReason || "上游表有新版本"}）。本文件仍是原批准内容；新方案要重开计划书、重新定版后再导出新版本。`);
  return {
    lines,
    sources: s.sources.map((x) => ({ specId: x.specId, name: x.name, version: `v${x.rev} · ${x.basisLabel}` })),
  };
}
