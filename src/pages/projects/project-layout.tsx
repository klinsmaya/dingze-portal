import { useState } from "react";
import { Link, NavLink, Outlet, useMatch, useParams } from "react-router";

import { UserDropdown } from "@/components/app-shell/header";
import { NotificationBell } from "@/components/dingze/notification-bell";
import { DisplayMenu } from "@/components/dingze/display-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_ROLE_LABELS } from "@dingze/shared";
import { useProject, useProjectOverview } from "@/lib/dingze/queries";
import { cn } from "@/lib/utils";

import type { ProjectContextValue } from "./project-context";

// 一级入口两端同名（开营前 UX 改版 IA1）：待办 · 定责 · 资料 · 成果；咨询方另有专家咨询。
const ENTERPRISE_NAV = [
  { to: "overview", label: "待办", title: "待办：要你处理的表、等别人处理的表和项目启动事项" },
  { to: "workspace", label: "定责", title: "定责：逐表填写三张检查表，完成后提交复核、定版" },
  { to: "materials", label: "资料", title: "资料：填表前的准备与参考——资料库、组织与职责、企业画像" },
  { to: "results", label: "成果", title: "成果：每张表的状态与版本，已定版的交付文件" },
];
const FULL_NAV = [...ENTERPRISE_NAV, { to: "expert", label: "专家咨询", title: "专家咨询：方法流程解决不了的关键分歧，由人工咨询师受理" }];
const ENTERPRISE_ROLES = ["ent_lead", "dept_head", "member", "readonly"];

export default function ProjectLayout() {
  const projectId = Number(useParams().projectId);
  const { project, isLoading, error, notFound } = useProject(projectId);
  const overview = useProjectOverview(project);
  // The workspace fills the screen and puts its own step title and sub-steps in the top bar.
  const inWorkspace = !!useMatch("/projects/:projectId/workspace/*");
  const [slotMain, setSlotMain] = useState<HTMLElement | null>(null);
  const [slotActions, setSlotActions] = useState<HTMLElement | null>(null);
  const team = overview.data?.team ?? [];

  if (inWorkspace) {
    return (
      <div data-dingze-project className="flex h-svh flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b-2 border-gold px-3 text-band-foreground md:px-4" style={{ background: "var(--band)" }}>
          <Link to="/projects" aria-label="返回我的项目" title="我的项目" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/25 font-heading text-lg font-bold text-gold hover:bg-white/10">
            责
          </Link>
          <div ref={setSlotMain} className="flex min-w-0 flex-1 items-center gap-4" />
          <div className="flex shrink-0 items-center gap-2.5">
            <DisplayMenu />
            {team.length ? (
              <div className="hidden -space-x-1.5 md:flex" aria-label="项目成员">
                {team.slice(0, 5).map((m) => (
                  <span
                    key={m.userId}
                    title={`${m.nickname} · ${PROJECT_ROLE_LABELS[m.projectRole as keyof typeof PROJECT_ROLE_LABELS] ?? ""}`}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-[#0c3d52] bg-white/90 text-xs font-bold text-[#0c3d52]"
                  >
                    {m.nickname.slice(0, 1)}
                  </span>
                ))}
              </div>
            ) : null}
            <NotificationBell className="text-band-foreground hover:bg-white/10 hover:text-band-foreground" />
            <div ref={setSlotActions} className="flex items-center" />
            <UserDropdown />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {error || overview.error || notFound || isLoading || !project || !overview.data ? (
            <div className="p-6">
              {error || overview.error ? (
                <Alert variant="destructive">
                  <AlertTitle>项目加载失败</AlertTitle>
                  <AlertDescription>请稍后刷新重试</AlertDescription>
                </Alert>
              ) : notFound ? (
                <Alert>
                  <AlertTitle>找不到这个项目</AlertTitle>
                  <AlertDescription>
                    项目不存在，或者你不是它的成员。<Link to="/projects" className="underline">返回我的项目</Link>
                  </AlertDescription>
                </Alert>
              ) : (
                <Skeleton className="h-96 rounded-xl" />
              )}
            </div>
          ) : (
            <Outlet context={{ project, overview: overview.data, topbar: { main: slotMain, actions: slotActions } } satisfies ProjectContextValue} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-dingze-project className="flex min-h-svh flex-col">
      <header
        className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-gold px-3 text-band-foreground md:flex-nowrap md:px-4"
        style={{ background: "var(--band)" }}
      >
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/projects" aria-label="返回我的项目" title="我的项目" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/25 font-heading text-lg font-bold text-gold hover:bg-white/10">
            责
          </Link>
          <div className="min-w-0 max-w-[16rem] leading-tight">
            <div className="truncate font-heading text-[15px] font-bold tracking-wide">
              {project ? `${project.enterprise?.shortName ?? project.enterprise?.name ?? ""} · ${project.name}` : "加载项目…"}
            </div>
            <div className="truncate text-xs text-band-muted">自驱战略 · 定三责</div>
          </div>
        </div>
        <nav aria-label="项目导航" className="flex flex-wrap">
          {(overview.data?.projectRole && ENTERPRISE_ROLES.includes(overview.data.projectRole) && !overview.data.isConsultAdmin ? ENTERPRISE_NAV : FULL_NAV).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.title}
              className={({ isActive }) =>
                cn(
                  "border-b-2 px-3 py-3.5 text-sm",
                  isActive
                    ? "border-gold font-bold text-band-foreground"
                    : "border-transparent text-band-muted hover:text-band-foreground"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {overview.data?.projectRole ? (
            <span className="hidden text-xs text-band-muted sm:inline">
              {PROJECT_ROLE_LABELS[overview.data.projectRole]}
            </span>
          ) : null}
          <NotificationBell className="text-band-foreground hover:bg-white/10 hover:text-band-foreground" />
          <DisplayMenu />
          <UserDropdown />
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        {error || overview.error ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTitle>项目加载失败</AlertTitle>
              <AlertDescription>
                {(error ?? overview.error) instanceof Error ? (error ?? overview.error)!.message : "请稍后刷新重试"}
              </AlertDescription>
            </Alert>
          </div>
        ) : notFound ? (
          <div className="p-6">
            <Alert>
              <AlertTitle>找不到这个项目</AlertTitle>
              <AlertDescription>
                项目不存在，或者你不是它的成员。<Link to="/projects" className="underline">返回我的项目</Link>
              </AlertDescription>
            </Alert>
          </div>
        ) : isLoading || !project || !overview.data ? (
          <div className="grid gap-4 p-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : (
          <Outlet context={{ project, overview: overview.data } satisfies ProjectContextValue} />
        )}
      </div>
    </div>
  );
}
