import { ArrowRight, Check, CircleCheck, CircleDashed, CircleDot, Import, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { STAGES, nextAction, isEmployee } from "@dingze/shared";

import { StatusBadge, StatusDot } from "@/components/dingze/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMaterials, useProfile } from "@/lib/dingze/materials-api";
import { type FlowStep, flowSteps } from "@/lib/dingze/flow";
import type { ArtifactOverview } from "@/lib/dingze/api";
import { STEP_ARTIFACTS, nextActionPath, progressOf, stageEntryCode, stageProgress, workspacePath } from "@/lib/dingze/progress";
import { type StartupItem, startupChecklist } from "@/lib/dingze/project-startup";
import { cn } from "@/lib/utils";

import { FirstRunGuide, useFirstRunGuide } from "./components/first-run-guide";
import { ImportDialog } from "./components/import-dialog";
import { useProjectContext } from "./project-context";

export default function ProjectOverviewPage() {
  const { project, overview } = useProjectContext();
  const artifacts = overview.artifacts;
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  const role = overview.projectRole;
  const steps = progressOf(artifacts);
  const service = (overview.project.service ?? project.service) === "self" ? "self" : "guided";
  const next = nextAction(steps, role, service);
  const stages = stageProgress(artifacts);
  const materials = useMaterials(project);
  const profile = useProfile(project);
  const startup = startupChecklist({ orgUnits: overview.orgUnits ?? [], team: overview.team ?? [], materialCount: materials.data?.length ?? 0, profileItems: profile.data?.items ?? [] });
  const flow = flowSteps({
    stages,
    materialsReady: startup.find((i) => i.key === "materials")?.state === "done",
    started: artifacts.some((a) => a.status !== "not_started"),
  });
  // 普通员工：没有资料页，总览第一张卡就是“现在填哪张表”；邀请、上传、项目启动都不显示。
  const employee = isEmployee(role) && !overview.isConsultAdmin;
  const materialsFirst = !materials.isLoading && !profile.isLoading && flow[0].state === "current" && role === "ent_lead";
  // 企业管理员（定稿方案三）：成员还没到位时第一张卡是“邀请成员”，然后才是“上传资料”；两张卡到位后自动退后。
  const inviteFirst = role === "ent_lead" && !materials.isLoading && startup.find((i) => i.key === "team")?.state !== "done";
  // 一页只有一个实心主按钮：第一张卡实心，其余灰底。
  const primaryIndex = inviteFirst ? 0 : materialsFirst ? 1 : 2;
  const cardClass = (index: number, quiet = false) =>
    cn("flex flex-wrap items-center gap-3 rounded-xl px-5 py-4", index === primaryIndex && !quiet ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-foreground hover:bg-muted/80");
  // 首次进项目弹操作指引（本机记住）。只给企业侧的新项目：还没开始填表、不是咨询方。
  const [guideSeen, setGuideSeen] = useFirstRunGuide();
  const [guideOpen, setGuideOpen] = useState(false);
  const freshProject = !artifacts.some((a) => a.status !== "not_started");
  useEffect(() => {
    // 普通员工多半是中途加入的，项目不新也给看一次三步指引。
    if (!guideSeen && !consulting && (freshProject || employee) && !materials.isLoading && !profile.isLoading) setGuideOpen(true);
    // 只在首次加载完判断一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials.isLoading, profile.isLoading]);
  const closeGuide = () => {
    setGuideOpen(false);
    setGuideSeen(true);
  };
  // 训练营和企业内训对企业是同一套界面；场景只给咨询侧看。
  const consulting = overview.isConsultAdmin || role === "lead_consultant" || role === "co_consultant";

  // 从已有项目带入：企业项目负责人手动触发（咨询管理员可代为操作）；新建项目后带 ?import=1 直接打开。
  const canImport = role === "ent_lead" || overview.isConsultAdmin;
  const [params, setParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(canImport && params.get("import") === "1");
  const closeImport = (open: boolean) => {
    setImportOpen(open);
    if (!open && params.has("import")) setParams({}, { replace: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-6 md:px-7">
      {canImport ? <ImportDialog project={project} open={importOpen} onOpenChange={closeImport} /> : null}
      <FirstRunGuide open={guideOpen} onClose={closeGuide} startHref={employee ? nextActionPath(project.id, next) : `/projects/${project.id}/materials`} variant={employee ? "employee" : "lead"} />
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="min-w-0 flex-1 font-heading text-3xl font-bold text-brand">总览</h1>
        <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)}>
          看操作指引
        </Button>
        {canImport ? (
          <Button variant="outline" onClick={() => setImportOpen(true)} title="把本企业已有项目里的表带进来作为草稿，再按今年改">
            <Import /> 从已有项目带入
          </Button>
        ) : null}
      </div>

      <FlowStrip projectId={project.id} steps={flow} artifacts={artifacts} />

      <section aria-label="下一步" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        {inviteFirst ? (
          <Link to="/enterprise?tab=invites" className={cardClass(0)}>
            <span className="min-w-0 flex-1">
              <span className="block text-xs opacity-80">先做</span>
              <span className="block text-lg font-bold">邀请成员</span>
            </span>
            <ArrowRight className="size-5 shrink-0" />
          </Link>
        ) : null}
        {materialsFirst ? (
          <Link to={`/projects/${project.id}/materials`} className={cardClass(1)}>
            <span className="min-w-0 flex-1">
              <span className="block text-xs opacity-80">{inviteFirst ? "然后" : "先做"}</span>
              <span className="block text-lg font-bold">上传资料</span>
            </span>
            <ArrowRight className="size-5 shrink-0" />
          </Link>
        ) : null}
        <Link to={nextActionPath(project.id, next)} className={cardClass(2, next.kind === "waiting" || next.kind === "view")}>
          <span className="min-w-0 flex-1">
            <span className="block text-xs opacity-80">{next.kind === "waiting" ? "现在在等" : inviteFirst || materialsFirst ? "或者直接开始" : "下一步"}</span>
            <span className="block text-lg font-bold">{next.label}</span>
          </span>
          <ArrowRight className="size-5 shrink-0" />
        </Link>
      </section>

      {employee ? null : <StartupCard projectId={project.id} />}

      <section aria-label="三阶段进度" className="grid gap-4 lg:grid-cols-3">
        {stages.map((stage) => (
          <Card key={stage.stage} className={cn(stage.open && !stage.complete && "border-primary ring-3 ring-accent")}>
            <CardHeader className="gap-2">
              {/* 走查第二批：阶段进度只留一种表达（已定版 n / 总数），不再并排进度条和状态词。 */}
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-lg text-brand">{STAGES.find((s) => s.key === stage.stage)?.flow}</CardTitle>
                <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
                  已定版 {stage.locked} / {stage.gateTotal}
                </span>
              </div>
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

    </div>
  );
}


const START_LINKS: Record<StartupItem["key"], { href: (id: number) => string; label: string } | null> = {
  org: { href: (id) => `/projects/${id}/materials#org`, label: "看组织与职责" },
  materials: { href: (id) => `/projects/${id}/materials#library`, label: "去上传资料、确认画像" },
  team: null,
};

/**
 * 项目启动: 组织与职责、资料与画像、团队与角色 — the same three for 训练营 and 企业内训. Shown open
 * until all three are in place, then folded to one line.
 */
function StartupCard({ projectId }: { projectId: number }) {
  const { project, overview } = useProjectContext();
  const materials = useMaterials(project);
  const profile = useProfile(project);
  if (materials.isLoading || profile.isLoading) return null;
  const items = startupChecklist({ orgUnits: overview.orgUnits ?? [], team: overview.team ?? [], materialCount: materials.data?.length ?? 0, profileItems: profile.data?.items ?? [] });
  const done = items.filter((i) => i.state === "done").length;
  if (done === items.length) {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-status-done-foreground" /> 项目启动已就绪：{items.map((i) => i.title).join("、")}
      </p>
    );
  }
  return (
    <section aria-labelledby="startup" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="startup" className="font-heading text-lg font-bold text-brand">
          项目启动
        </h2>
        <span className="text-sm text-muted-foreground">
          已就绪 {done} / {items.length}。三项齐了再填表最顺，没齐也可以先做。
        </span>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const link = START_LINKS[item.key];
          return (
            <li key={item.key} className={cn("flex flex-col gap-1.5 rounded-xl border p-3", item.state === "done" && "bg-muted/40")}>
              <div className="flex items-center gap-2 font-semibold">
                {item.state === "done" ? (
                  <CircleCheck className="size-4 text-status-done-foreground" />
                ) : item.state === "partial" ? (
                  <CircleDot className="size-4" style={{ color: "var(--dz-warn)" }} />
                ) : (
                  <CircleDashed className="size-4 text-muted-foreground" />
                )}
                {item.title}
              </div>
              {item.problems.length ? (
                <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs">
                  {item.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              {link && item.state !== "done" ? (
                <Link to={link.href(projectId)} className="mt-auto text-xs font-medium text-primary hover:underline">
                  {link.label} →
                </Link>
              ) : item.key === "team" && item.state !== "done" ? (
                <span className="mt-auto text-xs text-muted-foreground">
                  叫同事一起做：企业管理员在<Link to="/enterprise?tab=invites" className="text-primary hover:underline">本企业 › 邀请注册</Link>发一个邀请码，同事凭码注册就进项目；或请运营分派。
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}


/** 五步流程条：资料 → 战略解码 → 目标分解 → 计划制定 → 下载成果，标出做完的、当前的和还没开启的。 */
function FlowStrip({ projectId, steps, artifacts }: { projectId: number; steps: FlowStep[]; artifacts: ArtifactOverview[] }) {
  const href = (step: FlowStep) =>
    step.key === "materials"
      ? `/projects/${projectId}/materials`
      : step.key === "deliver"
        ? `/projects/${projectId}/results`
        : workspacePath(projectId, stageEntryCode(artifacts, step.key));
  return (
    <ol aria-label="流程" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((step) => (
        <li key={step.key}>
          <Link
            to={href(step)}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn(
              "flex h-full flex-col gap-1 rounded-xl border bg-card p-3 hover:border-primary",
              step.state === "current" && "border-primary ring-3 ring-accent",
              step.state === "locked" && "opacity-60",
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  step.state === "done" ? "bg-status-done text-status-done-foreground" : step.state === "current" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {step.state === "done" ? <Check className="size-3.5" /> : step.no}
              </span>
              <span className="font-heading font-bold text-brand">{step.label}</span>
              {step.state === "locked" ? <Lock className="ml-auto size-3.5 text-muted-foreground" aria-label="待开启" /> : null}
              {step.state === "current" ? <span className="ml-auto text-xs font-semibold text-primary">现在</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
