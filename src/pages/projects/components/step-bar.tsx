import { Lock } from "lucide-react";
import { Link } from "react-router";

import { ARTIFACTS, STAGES, type StageKey } from "@dingze/shared";

import { StatusBadge } from "@/components/dingze/status-badge";
import type { ArtifactOverview } from "@/lib/dingze/api";
import { stageProgress, workspacePath } from "@/lib/dingze/progress";
import { cn } from "@/lib/utils";

type StepBarProps = {
  projectId: number;
  artifacts: ArtifactOverview[];
  stage: StageKey;
  activeCode: string;
};

/**
 * Left column of the workspace: the checklist's 工作任务 → 实施步骤 for one stage,
 * in book order, with each table's status and why a locked table is waiting.
 */
export function StepBar({ projectId, artifacts, stage, activeCode }: StepBarProps) {
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  const progress = stageProgress(artifacts).find((p) => p.stage === stage)!;
  const steps = ARTIFACTS.filter((a) => a.stage === stage);
  const tasks = [...new Set(steps.map((s) => s.task))];

  return (
    <nav aria-label="步骤条" className="flex flex-col gap-4">
      <div role="tablist" aria-label="阶段" className="flex gap-0.5 rounded-xl bg-muted p-1">
        {STAGES.map((s) => {
          const first = ARTIFACTS.find((a) => a.stage === s.key && a.priority !== "method")!;
          const open = byCode.get(first.code)?.unlock.unlocked;
          return (
            <Link
              key={s.key}
              role="tab"
              aria-selected={s.key === stage}
              to={workspacePath(projectId, first.code)}
              className={cn(
                "flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg text-[13px]",
                s.key === stage ? "bg-brand font-bold text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {open ? null : <Lock className="size-3" aria-label="待解锁" />}
              {s.name}
            </Link>
          );
        })}
      </div>

      <div>
        <div className="font-heading text-base font-bold">
          {STAGES.find((s) => s.key === stage)!.name} · {progress.goal}
        </div>
        <div className="text-xs text-muted-foreground">
          P0 已定版 {progress.locked} / {progress.gateTotal}，全部定版后开启下一阶段
        </div>
      </div>

      {tasks.map((task) => (
        <div key={task} className="flex flex-col gap-1">
          <div className="px-1.5 text-xs font-bold text-muted-foreground">{task}</div>
          {steps
            .filter((s) => s.task === task)
            .map((def) => {
              const a = byCode.get(def.code);
              const unlocked = !!a?.unlock.unlocked;
              const active = def.code === activeCode;
              return (
                <Link
                  key={def.code}
                  to={workspacePath(projectId, def.code)}
                  aria-current={active ? "page" : undefined}
                  title={unlocked ? undefined : a?.unlock.waitingFor}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-muted",
                    def.attachedTo && "ml-4",
                    active && "bg-accent shadow-[inset_3px_0_0_var(--primary)] hover:bg-accent"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-foreground">
                      {def.attachedTo ? def.name : `${def.specId} ${def.name}`}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {def.priority === "method" ? "方法底稿" : def.step}
                      {def.priority === "P1" ? " · 可跳过" : ""}
                    </span>
                  </span>
                  {a?.openComments ? (
                    <span className="shrink-0 rounded-full bg-gold/25 px-1.5 text-[11px] font-semibold text-brand" title={`${a.openComments} 条未解决批注`}>
                      {a.openComments}
                    </span>
                  ) : null}
                  {unlocked && a ? (
                    <StatusBadge status={a.status} stale={a.stale} className="justify-end" />
                  ) : (
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="待解锁" />
                  )}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
