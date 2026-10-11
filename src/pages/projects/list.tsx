import { ArrowRight, FolderKanban } from "lucide-react";
import { Link } from "react-router";

import { PROJECT_ROLE_LABELS, STAGES } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { nextActionPath } from "@/lib/dingze/progress";
import { useMyProjects } from "@/lib/dingze/queries";

const SCENE_LABELS = { camp: "训练营", inhouse: "企业内训" } as const;

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useMyProjects();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand">我的项目</h1>
        <p className="mt-1 text-sm text-muted-foreground">往哪打 · 怎么走 · 谁负责 —— 选择一个项目继续定三责。</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>项目列表加载失败</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "请稍后刷新重试"}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !projects?.length ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle>还没有加入任何项目</EmptyTitle>
            <EmptyDescription>项目由运营管理员开通。开通后，你会在这里看到并进入项目。</EmptyDescription>
          </EmptyHeader>
        </Empty>
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
                              <span>{stage.name}</span>
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
