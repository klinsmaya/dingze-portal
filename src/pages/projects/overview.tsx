import { ArrowRight, CircleCheck, CircleDashed, CircleDot, Import } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { collaborationStatus, getArtifactDef, nextAction } from "@dingze/shared";

import { StatusBadge, StatusDot } from "@/components/dingze/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMaterials, useProfile } from "@/lib/dingze/materials-api";
import { STEP_ARTIFACTS, nextActionPath, progressOf, stageProgress, workspacePath } from "@/lib/dingze/progress";
import { type StartupItem, startupChecklist } from "@/lib/dingze/project-startup";
import { cn } from "@/lib/utils";

import { ImportDialog } from "./components/import-dialog";
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
  const service = (overview.project.service ?? project.service) === "self" ? "self" : "guided";
  const next = nextAction(steps, role, service);
  const stages = stageProgress(artifacts);
  // 训练营和企业内训对企业是同一套界面；场景只给咨询侧看。
  const consulting = overview.isConsultAdmin || role === "lead_consultant" || role === "co_consultant";
  // Everything else that is moving: returned, in review, waiting for 定版, upstream changed.
  const moving = steps
    .filter((a) => a.code !== next.code && getArtifactDef(a.code).priority !== "method")
    .map((a) => ({ a, status: collaborationStatus(a, role, service) }))
    .filter((x): x is { a: (typeof steps)[number]; status: NonNullable<ReturnType<typeof collaborationStatus>> } => !!x.status && x.status.tone !== "done");

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
      <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">
          {project.year} 年度{consulting ? ` · ${project.scene === "camp" ? "训练营" : "企业内训"}` : ""}
          {service === "self" ? " · 自助（数字咨询师陪你做，复核由企业项目负责人对照书中门禁自查）" : ""} · 往哪打 · 怎么走 · 谁负责
        </p>
        <h1 className="font-heading text-3xl font-bold text-brand">待办</h1>
        <p className="mt-1 text-sm text-muted-foreground">先做最上面那件事；下面是正在流转的表和项目启动还缺的准备。</p>
      </div>
        {canImport ? (
          <Button variant="outline" onClick={() => setImportOpen(true)} title="把本企业已有项目里的表带进来作为草稿，再按今年改">
            <Import /> 从已有项目带入
          </Button>
        ) : null}
      </div>

      <StartupCard projectId={project.id} />

      <section aria-label="待办" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
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
        <CircleCheck className="size-4 text-status-done-foreground" /> 项目启动已就绪：{items.map((i) => `${i.title}（${i.detail}）`).join("；")}
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
              <div className="text-xs text-muted-foreground">{item.detail}</div>
              {item.problems.length ? (
                <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs">
                  {item.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              {item.notes.map((n) => (
                <p key={n} className="text-xs text-muted-foreground">
                  {n}
                </p>
              ))}
              {link && item.state !== "done" ? (
                <Link to={link.href(projectId)} className="mt-auto text-xs font-medium text-primary hover:underline">
                  {link.label} →
                </Link>
              ) : item.key === "team" && item.state !== "done" ? (
                <span className="mt-auto text-xs text-muted-foreground">成员和角色由咨询机构运营在“项目与分派”里设置，有调整请告诉主咨询师。</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
