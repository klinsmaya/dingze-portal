import { ArrowRight, Plus } from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router";
import { toast } from "sonner";

import { PROJECT_ROLE_LABELS, STAGES } from "@dingze/shared";

import { EmptyState } from "@/components/dingze/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import type { Enterprise } from "@/lib/dingze/ops-api";
import { useEnterpriseDetail, useEnterprises } from "@/lib/dingze/ops-queries";
import { nextActionPath } from "@/lib/dingze/progress";
import { useMyProjects } from "@/lib/dingze/queries";
import { samplePath } from "@/lib/dingze/sample";
import { useSystemRoles } from "@/lib/dingze/system-roles";
import { OwnProjectDialog } from "@/pages/ops/components/projects-tab";

const SCENE_LABELS = { camp: "训练营", inhouse: "企业内训" } as const;

/**
 * 企业管理员自建项目：运营给本企业打开“允许企业管理员自建项目”后才有。入口从「本企业 › 项目」
 * 挪到这里，项目只在「我的项目」一处出现（测试反馈 5）。
 */
function NewOwnProject({ enterprise }: { enterprise: Enterprise }) {
  const [open, setOpen] = useState(false);
  const detail = useEnterpriseDetail(open ? enterprise.id : undefined);
  return (
    <>
      <Button
        disabled={open && detail.isLoading}
        onClick={() => {
          if (detail.error) toast.error(errorMessage(detail.error));
          setOpen(true);
        }}
      >
        <Plus /> 新建项目
      </Button>
      {detail.data ? <OwnProjectDialog open={open} detail={detail.data} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useMyProjects();
  const system = useSystemRoles();
  const isEntAdmin = system.roles.includes("dz_ent_admin") && !system.roles.includes("dz_ops");
  const enterprises = useEnterprises(isEntAdmin);
  const selfEnterprise = isEntAdmin ? (enterprises.data ?? []).find((e) => e.allowSelfProject) : undefined;
  // 只有一个项目就直接进去（绝大多数企业用户），列表留给多项目的人；能自建项目的企业管理员留在列表，
  // 否则“新建项目”没有地方点。
  const deciding = system.isLoading || (isEntAdmin && enterprises.isLoading);
  if (projects?.length === 1 && !deciding && !selfEnterprise) return <Navigate to={`/projects/${projects[0].id}/overview`} replace />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-bold text-brand">我的项目</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选一个项目继续。不知道怎么填，先看<Link to={samplePath()} className="text-primary hover:underline">示例项目</Link>。
          </p>
        </div>
        {selfEnterprise ? <NewOwnProject enterprise={selfEnterprise} /> : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>项目列表加载失败</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "请稍后刷新重试"}</AlertDescription>
        </Alert>
      ) : isLoading || (projects?.length === 1 && deciding) ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          className="bg-card"
          text="还没有加入任何项目，项目开通后会出现在这里。"
          action={
            <Button variant="outline" nativeButton={false} render={<Link to={samplePath()} />}>
              看看示例项目
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={project.next ? nextActionPath(project.id, project.next) : `/projects/${project.id}/overview`}
              className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <CardDescription>{project.enterprise?.name ?? "未命名企业"}</CardDescription>
                  <CardTitle className="text-lg text-brand">{project.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {project.progress ? (
                    <div className="grid grid-cols-3 gap-2">
                      {STAGES.map((stage) => {
                        const p = project.progress?.[stage.key] ?? { locked: 0, total: 0 };
                        const pct = p.total ? Math.round((p.locked / p.total) * 100) : 0;
                        return (
                          <div key={stage.key} className="flex flex-col gap-1 text-xs">
                            <div className="flex justify-between text-muted-foreground">
                              <span>{stage.flow}</span>
                              <span className="tabular-nums">
                                {p.locked}/{p.total}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                              <div className={pct === 100 ? "h-full bg-gold" : "h-full bg-brand"} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{project.year} 年度</span>
                  <span>{SCENE_LABELS[project.scene] ?? project.scene}</span>
                  <span>{project.projectRole ? PROJECT_ROLE_LABELS[project.projectRole] : "管理员查看"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-brand/5 px-3 py-2 group-hover:bg-brand/10">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-brand">{project.next?.label ?? "进入项目"}</div>
                    {project.next?.hint ? <div className="truncate text-xs text-muted-foreground">{project.next.hint}</div> : null}
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-brand" />
                </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
