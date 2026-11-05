import { ArrowRight, FolderKanban } from "lucide-react";
import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link } from "react-router";
import { toast } from "sonner";

import { PROJECT_ROLE_LABELS, STAGES } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectSummary } from "@/lib/dingze/api";
import { errorMessage } from "@/lib/dingze/errors";
import { opsApi } from "@/lib/dingze/ops-api";
import { useEnterpriseDetail, useEnterprises, useOpsMutation } from "@/lib/dingze/ops-queries";
import { canRevealHidden, createOffer, projectListEntries, type ProjectListEntry } from "@/lib/dingze/project-list";
import { useMyProjects } from "@/lib/dingze/queries";
import { ConfirmAction } from "@/pages/ops/components/confirm-action";
import { OwnProjectDialog, ProjectDialog } from "@/pages/ops/components/projects-tab";

const SCENE_LABELS = { camp: "训练营", inhouse: "企业内训" } as const;
const ENTERPRISE_LIST_ROLES = ["dz_ops", "dz_consult_admin", "dz_ent_admin", "root"];

type IdentityRole = string | { name: string };

function roleNames(roles: readonly IdentityRole[] | undefined) {
  return (roles ?? []).map((role) => (typeof role === "string" ? role : role.name));
}

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useMyProjects();
  const identity = useGetIdentity<{ roles?: IdentityRole[] }>();
  const names = roleNames(identity.data?.roles);
  const ops = names.some((name) => name === "dz_ops" || name === "dz_consult_admin" || name === "root");
  const entAdmin = names.includes("dz_ent_admin");
  const enterprises = useEnterprises(names.some((name) => ENTERPRISE_LIST_ROLES.includes(name)));
  const offer = createOffer(
    { ops, entAdmin },
    (enterprises.data ?? []).map((enterprise) => ({
      id: enterprise.id,
      name: enterprise.name,
      allowSelfProject: enterprise.allowSelfProject,
      status: enterprise.status,
    })),
  );
  const [showHidden, setShowHidden] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState<number | null>(null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const detail = useEnterpriseDetail(chosenId ?? undefined);
  const hide = useOpsMutation(opsApi.setProjectHidden);
  const remove = useOpsMutation(opsApi.deleteProject);
  const pending = hide.isPending || remove.isPending;
  const entries = projectListEntries(projects ?? [], showHidden);
  const projectEntries = entries.filter((entry) => entry.kind === "project");
  const opened = chosenId != null && detail.data?.enterprise.id === chosenId ? detail.data : null;

  useEffect(() => {
    if (chosenId == null || !detail.error) return;
    toast.error(errorMessage(detail.error));
    setChosenId(null);
  }, [chosenId, detail.error]);

  const beginCreate = () => {
    if (!offer || chosenId != null) return;
    if (offer.enterprises.length === 1) {
      setChosenId(offer.enterprises[0].id);
      return;
    }
    setPickId(offer.enterprises[0]?.id ?? null);
    setPicking(true);
  };

  const confirmPick = () => {
    if (pickId == null || !offer?.enterprises.some((enterprise) => enterprise.id === pickId)) return;
    setChosenId(pickId);
    setPicking(false);
  };

  const hideProject = (projectId: number, hidden: boolean) =>
    hide.mutateAsync(
      { projectId, hidden },
      {
        onSuccess: () => toast.success(hidden ? "已隐藏" : "已取消隐藏"),
        onError: (cause) => toast.error(errorMessage(cause)),
      },
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-brand">我的项目</h1>
        <div className="flex flex-wrap gap-2">
          {canRevealHidden(projects ?? []) ? (
            <Button variant="outline" onClick={() => setShowHidden((value) => !value)}>
              {showHidden ? "收起已隐藏" : "显示已隐藏"}
            </Button>
          ) : null}
          {offer ? (
            <Button onClick={beginCreate} disabled={chosenId != null || picking}>
              新建项目
            </Button>
          ) : null}
        </div>
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
      ) : (
        <>
          {projectEntries.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanban />
                </EmptyMedia>
                <EmptyTitle>还没有加入任何项目</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(projectEntries.length === 0 ? entries.filter((entry) => entry.kind === "sample") : entries).map((entry) => (
              <ProjectCard
                key={entry.kind === "project" ? entry.project.id : "sample"}
                entry={entry}
                pending={pending}
                onHide={(projectId) => hideProject(projectId, true)}
                onUnhide={(projectId) => hideProject(projectId, false)}
                onDelete={(projectId) =>
                  remove.mutateAsync(
                    { projectId },
                    {
                      onSuccess: () => toast.success("已删除"),
                      onError: (cause) => toast.error(errorMessage(cause)),
                    },
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={picking && !!offer} onOpenChange={(open) => { if (!open) setPicking(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <NativeSelect aria-label="选择企业" value={pickId ?? ""} onChange={(event) => setPickId(Number(event.target.value))}>
            {(offer?.enterprises ?? []).map((enterprise) => (
              <NativeSelectOption key={enterprise.id} value={enterprise.id}>
                {enterprise.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicking(false)}>
              取消
            </Button>
            <Button onClick={confirmPick} disabled={pickId == null}>
              继续
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {opened && offer?.kind === "ops" ? <ProjectDialog target="new" detail={opened} onClose={() => setChosenId(null)} /> : null}
      {opened && offer?.kind === "own" ? <OwnProjectDialog open detail={opened} onClose={() => setChosenId(null)} /> : null}
    </div>
  );
}

function ProjectCard({
  entry,
  pending,
  onHide,
  onUnhide,
  onDelete,
}: {
  entry: ProjectListEntry;
  pending: boolean;
  onHide: (projectId: number) => Promise<unknown>;
  onUnhide: (projectId: number) => Promise<unknown>;
  onDelete: (projectId: number) => Promise<unknown>;
}) {
  if (entry.kind === "sample") {
    return (
      <article>
        <Card className="h-full">
          <CardHeader>
            <CardDescription>{entry.enterprise}</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg text-brand">
              {entry.name}
              <Badge variant="secondary">示例</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{entry.year} 年度</p>
          </CardContent>
          <CardFooter>
            <EnterLink href={entry.href} />
          </CardFooter>
        </Card>
      </article>
    );
  }

  const project = entry.project;
  return (
    <article>
      <Card className="h-full">
        <CardHeader>
          <CardDescription>{project.enterprise?.name ?? "未命名企业"}</CardDescription>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-brand">
            {project.name}
            {project.hidden ? <Badge variant="outline">已隐藏</Badge> : null}
            {project.status === "archived" ? <Badge variant="outline">已归档</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ProjectProgress project={project} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{project.year} 年度</span>
            <span>{SCENE_LABELS[project.scene] ?? project.scene}</span>
            <span>{project.projectRole ? PROJECT_ROLE_LABELS[project.projectRole] : "管理员查看"}</span>
          </div>
          {project.next ? (
            <div className="rounded-lg bg-brand/5 px-3 py-2">
              <div className="truncate text-sm font-semibold text-brand">{project.next.label}</div>
              {project.next.hint ? <div className="truncate text-xs text-muted-foreground">{project.next.hint}</div> : null}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <EnterLink href={entry.href} />
          {project.canGovern ? (
            <>
              {project.hidden ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    void onUnhide(project.id).catch(() => undefined);
                  }}
                >
                  取消隐藏
                </Button>
              ) : (
                <ConfirmAction
                  trigger={
                    <Button size="sm" variant="outline" disabled={pending}>
                      隐藏
                    </Button>
                  }
                  title="隐藏这个项目？"
                  description="列表不再显示，数据保留。"
                  confirmLabel="隐藏"
                  onConfirm={() => onHide(project.id)}
                />
              )}
              <ConfirmAction
                trigger={
                  <Button size="sm" variant="destructive" disabled={pending}>
                    删除
                  </Button>
                }
                title="删除这个项目？"
                description="删除后项目和里面的表、资料都会清掉，不能恢复。"
                confirmLabel="删除"
                destructive
                onConfirm={() => onDelete(project.id)}
              />
            </>
          ) : null}
        </CardFooter>
      </Card>
    </article>
  );
}

function EnterLink({ href }: { href: ProjectListEntry["href"] }) {
  return (
    <Button size="sm" nativeButton={false} render={<Link to={href} />}>
      进入 <ArrowRight />
    </Button>
  );
}

function ProjectProgress({ project }: { project: ProjectSummary }) {
  if (!project.progress) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {STAGES.map((stage) => {
        const row = project.progress?.[stage.key] ?? { locked: 0, total: 0 };
        const pct = row.total ? Math.round((row.locked / row.total) * 100) : 0;
        return (
          <div key={stage.key} className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>{stage.flow}</span>
              <span className="tabular-nums">
                {row.locked}/{row.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={pct === 100 ? "h-full bg-gold" : "h-full bg-brand"} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
