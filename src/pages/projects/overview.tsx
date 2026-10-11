import { ArrowRight, CircleCheck } from "lucide-react";
import { Link } from "react-router";

import { collaborationStatus, getArtifactDef, nextAction } from "@dingze/shared";

import { StatusBadge, StatusDot } from "@/components/dingze/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STEP_ARTIFACTS, nextActionPath, progressOf, stageProgress, workspacePath } from "@/lib/dingze/progress";
import { cn } from "@/lib/utils";

import { useProjectContext } from "./project-context";

const TONE_STYLES = {
  act: "bg-status-confirm text-status-confirm-foreground",
  wait: "bg-status-review text-status-review-foreground",
  warn: "bg-status-stale text-status-stale-foreground",
  done: "bg-status-done text-status-done-foreground",
  neutral: "bg-muted text-muted-foreground",
} as const;

const TONE_LABELS = { act: "要你处理", wait: "在等别人", warn: "需核对", done: "已定版", neutral: "" } as const;

export default function ProjectOverviewPage() {
  const { project, overview } = useProjectContext();
  const artifacts = overview.artifacts;
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  const role = overview.projectRole;
  const steps = progressOf(artifacts);
  const next = nextAction(steps, role);
  const stages = stageProgress(artifacts);
  // Everything else that is moving: returned, in review, waiting for 定版, upstream changed.
  const moving = steps
    .filter((a) => a.code !== next.code && getArtifactDef(a.code).priority !== "method")
    .map((a) => ({ a, status: collaborationStatus(a, role) }))
    .filter((x): x is { a: (typeof steps)[number]; status: NonNullable<ReturnType<typeof collaborationStatus>> } => !!x.status && x.status.tone !== "done");

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-6 md:px-7">
      <div>
        <p className="text-sm text-muted-foreground">
          {project.year} 年度 · {project.scene === "camp" ? "训练营" : "企业内训"} · 往哪打 · 怎么走 · 谁负责
        </p>
        <h1 className="font-heading text-3xl font-bold text-brand">今天要做的</h1>
      </div>

      <section aria-label="今天要做的" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <Link
          to={nextActionPath(project.id, next)}
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-xl px-5 py-4",
            next.kind === "waiting" || next.kind === "view" ? "bg-muted text-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs opacity-80">{next.kind === "waiting" ? "现在在等" : "下一步"}</span>
            <span className="block text-lg font-bold">{next.label}</span>
            <span className="block text-sm opacity-85">{next.hint}</span>
          </span>
          <ArrowRight className="size-5 shrink-0" />
        </Link>
        {moving.length ? (
          <ul className="flex flex-col gap-1.5" aria-label="其他在流转的表">
            {moving.map(({ a, status }) => {
              const def = getArtifactDef(a.code);
              return (
                <li key={a.code}>
                  <Link to={workspacePath(project.id, a.code)} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 hover:border-primary">
                    <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-bold", TONE_STYLES[status.tone])}>{TONE_LABELS[status.tone]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {def.plain} <span className="text-xs font-normal text-muted-foreground">{def.specId}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{status.text}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-primary" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-status-done-foreground" /> 除了上面这一步，没有别的事在等你或在等别人。
          </p>
        )}
      </section>

      <section aria-label="三阶段进度" className="grid gap-4 lg:grid-cols-3">
        {stages.map((stage) => (
          <Card key={stage.stage} className={cn(stage.open && !stage.complete && "border-primary ring-3 ring-accent")}>
            <CardHeader className="gap-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-lg text-brand">{stage.name}</CardTitle>
                <span className="text-xs text-muted-foreground">{stage.goal}</span>
                <span className="ml-auto text-xs font-semibold text-muted-foreground">
                  {stage.complete ? "已完成" : stage.open ? "进行中" : "待解锁"}
                </span>
              </div>
              <Progress value={(stage.locked / stage.gateTotal) * 100} aria-label={`${stage.name}定版进度`} />
              <p className="text-xs text-muted-foreground">
                必做表已定版 {stage.locked} / {stage.gateTotal}
                {stage.open ? "" : " · 上一阶段全部定版后开启"}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1">
                {STEP_ARTIFACTS.filter((a) => a.stage === stage.stage).map((def) => {
                  const a = byCode.get(def.code);
                  const status = a?.status ?? "not_started";
                  return (
                    <li key={def.code}>
                      <Link
                        to={workspacePath(project.id, def.code)}
                        className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"
                      >
                        <StatusDot status={status} />
                        <span className="min-w-0 flex-1 truncate" title={`${def.specId} ${def.name}`}>
                          {def.plain}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {def.specId}
                            {def.priority === "P1" ? " · 可选" : ""}
                          </span>
                        </span>
                        {a?.unlock.unlocked ? (
                          <StatusBadge status={status} stale={a.stale} />
                        ) : (
                          <span className="text-xs text-muted-foreground">待解锁</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="text-sm text-muted-foreground">
        遇到方法流程解决不了的关键分歧？<Link to={`/projects/${project.id}/expert`} className="text-primary hover:underline">申请专家咨询 →</Link>
      </p>
    </div>
  );
}

