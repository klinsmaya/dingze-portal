import { ArrowRight, Plus, Search, Ticket, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { STAGES } from "@dingze/shared";

import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { EmptyState } from "@/components/dingze/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import type { Enterprise } from "@/lib/dingze/ops-api";
import { useEnterpriseDetail } from "@/lib/dingze/ops-queries";
import { nextActionPath } from "@/lib/dingze/progress";
import { PROJECT_PAGE_SIZE, filterProjects, pageOf, projectRoleLabel, projectYears, splitArchived } from "@/lib/dingze/project-list";
import { useMyProjects } from "@/lib/dingze/queries";
import { samplePath } from "@/lib/dingze/sample";
import { useOwnEnterprise, useSelfProjectEnterprise } from "@/lib/dingze/self-project";
import { OwnProjectDialog } from "@/pages/ops/components/projects-tab";

import { ProjectManageMenu } from "./components/project-manage";

const SCENE_LABELS = { camp: "训练营", inhouse: "企业内训" } as const;

/**
 * 企业管理员自建项目：默认都可以，运营可以按企业关掉（测试反馈 4）。入口从原来的「本企业 › 项目」
 * 挪到这里，项目只在「我的项目」一处出现（测试反馈 5）。
 */
function NewOwnProject({ enterprise, autoOpen }: { enterprise: Enterprise; autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
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
  const selfEnterprise = useSelfProjectEnterprise();
  const ownEnterprise = useOwnEnterprise();
  // 只有一个项目就直接进去（绝大多数企业用户），列表留给多项目的人。从项目里点「全部项目」「新建项目」
  // 过来的（?all=1 / ?new=1）留在列表，否则只有一个项目的企业管理员没有地方新建项目。
  const [params, setParams] = useSearchParams();
  const stay = params.has("all") || params.has("new");

  // 查询条件和页码记在地址里：进项目再退回来，还停在原来那一页。界面读本地状态（中文输入法
  // 拼写中不能被地址更新打断），地址只是跟着记。
  const [query, setQuery] = useState(() => ({ q: params.get("q") ?? "", year: Number(params.get("year")) || null, page: Number(params.get("page")) || 1, archived: params.has("archived") }));
  const { q, year } = query;
  const [pageSize, setPageSize] = useState(PROJECT_PAGE_SIZE);
  const update = (patch: Partial<typeof query>) => setQuery((prev) => ({ ...prev, page: 1, ...patch }));
  useEffect(() => {
    const next = new URLSearchParams(params);
    for (const [key, value] of [["q", query.q], ["year", query.year], ["page", query.page > 1 ? query.page : null], ["archived", query.archived ? 1 : null]] as const) {
      if (value) next.set(key, String(value));
      else next.delete(key);
    }
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [query, params, setParams]);
  // 进行中和已归档分开放；没有进行中的项目时直接看已归档的。没有归档过项目的账号看到的还是原来的样子。
  const { active, archived } = useMemo(() => splitArchived(projects ?? []), [projects]);
  const showArchived = archived.length > 0 && (query.archived || active.length === 0);
  const listed = showArchived ? archived : active;
  const years = useMemo(() => projectYears(listed), [listed]);
  const found = useMemo(() => filterProjects(listed, { q, year }), [listed, q, year]);
  const shown = pageOf(found, query.page, pageSize);
  // 一页放得下就不出查询条和分页，绝大多数企业用户看到的还是原来的样子。
  const searchable = listed.length > PROJECT_PAGE_SIZE;

  if (projects?.length === 1 && !stay) return <Navigate to={`/projects/${projects[0].id}/overview`} replace />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-bold text-brand">我的项目</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选一个项目继续。不知道怎么填，先看<Link to={samplePath()} className="text-primary hover:underline">示例项目</Link>。
          </p>
        </div>
        {/* 企业管理员的常用入口：加人、发邀请码、审核申请都在「成员管理」里，这里放一步到位的口子。 */}
        {ownEnterprise ? (
          <div className="flex flex-wrap items-center gap-2">
            {ownEnterprise.pendingRegistrations ? (
              <Button variant="outline" nativeButton={false} render={<Link to="/enterprise/invites" />}>
                待审核 <Badge>{ownEnterprise.pendingRegistrations}</Badge>
              </Button>
            ) : null}
            <Button variant="outline" nativeButton={false} render={<Link to="/enterprise/members?open=create" />}>
              <UserPlus /> 添加成员
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link to="/enterprise/invites" />}>
              <Ticket /> 邀请成员
            </Button>
          </div>
        ) : null}
        {selfEnterprise ? <NewOwnProject key={selfEnterprise.id} enterprise={selfEnterprise} autoOpen={params.has("new")} /> : null}
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
        <EmptyState
          className="bg-card"
          text="还没有项目，项目开通后会出现在这里。"
          action={
            <Button variant="outline" nativeButton={false} render={<Link to={samplePath()} />}>
              看看示例项目
            </Button>
          }
        />
      ) : (
        <>
        {archived.length ? (
          <div className="flex gap-1" role="group" aria-label="项目状态">
            <Button size="sm" variant={showArchived ? "ghost" : "secondary"} aria-pressed={!showArchived} disabled={active.length === 0} onClick={() => update({ archived: false })}>
              进行中 {active.length}
            </Button>
            <Button size="sm" variant={showArchived ? "secondary" : "ghost"} aria-pressed={showArchived} onClick={() => update({ archived: true })}>
              已归档 {archived.length}
            </Button>
          </div>
        ) : null}
        {searchable ? (
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full bg-card sm:w-72">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="搜索项目"
                placeholder="搜项目或企业名称"
                value={q}
                onChange={(e) => update({ q: e.target.value })}
              />
            </InputGroup>
            {years.length > 1 ? (
              <NativeSelect aria-label="年度" className="bg-card" value={year ?? ""} onChange={(e) => update({ year: Number(e.target.value) || null })}>
                <NativeSelectOption value="">全部年度</NativeSelectOption>
                {years.map((y) => (
                  <NativeSelectOption key={y} value={y}>
                    {y} 年度
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}
          </div>
        ) : null}
        {found.length === 0 ? (
          <EmptyState
            className="bg-card"
            text="没有符合条件的项目。"
            action={
              <Button variant="outline" onClick={() => update({ q: "", year: null })}>
                清除条件
              </Button>
            }
          />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.items.map((project) => (
            // 「⋯」菜单和卡片链接并排放（不放进链接里），点菜单不会进项目。
            <div key={project.id} className="relative min-w-0">
            <Link
              to={project.next ? nextActionPath(project.id, project.next) : `/projects/${project.id}/overview`}
              className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader className={project.manageable ? "pr-12" : undefined}>
                  <CardDescription>{project.enterprise?.name ?? "未命名企业"}</CardDescription>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-brand">
                    {project.name}
                    {project.status === "archived" ? <Badge variant="outline">已归档</Badge> : null}
                  </CardTitle>
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
                  <span>{projectRoleLabel(project)}</span>
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
            {project.manageable ? (
              <ProjectManageMenu
                project={project}
                lockedCount={Object.values(project.progress ?? {}).reduce((sum, stage) => sum + stage.locked, 0)}
                className="absolute top-3 right-3"
              />
            ) : null}
            </div>
          ))}
        </div>
        {searchable && found.length > 0 ? (
          <DataTablePagination
            currentPage={shown.page}
            pageCount={shown.pages}
            setCurrentPage={(page) => update({ page })}
            pageSize={pageSize}
            setPageSize={(size) => {
              setPageSize(size);
              update({});
            }}
            total={found.length}
          />
        ) : null}
        </>
      )}
    </div>
  );
}
