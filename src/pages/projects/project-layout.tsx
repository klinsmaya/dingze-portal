import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useMatch, useParams } from "react-router";

import { UserDropdown } from "@/components/app-shell/header";
import { NotificationBell } from "@/components/dingze/notification-bell";
import { ThemeModeSwitch } from "@/components/dingze/theme-mode-switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_ROLE_LABELS } from "@dingze/shared";
import { useProject, useProjectOverview } from "@/lib/dingze/queries";
import { cn } from "@/lib/utils";

import type { ProjectContextValue } from "./project-context";

// Enterprise members get four plain entries; the consulting side keeps the full set.
const ENTERPRISE_NAV = [
  { to: "overview", label: "今天要做的" },
  { to: "workspace", label: "填写" },
  { to: "materials", label: "资料" },
  { to: "delivery", label: "导出" },
];
const FULL_NAV = [
  { to: "overview", label: "工作台" },
  { to: "workspace", label: "咨询工作区" },
  { to: "materials", label: "资料与画像" },
  { to: "artifacts", label: "成果与定版" },
  { to: "delivery", label: "交付" },
  { to: "expert", label: "专家咨询" },
];
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
            <ThemeModeSwitch className="hidden lg:flex" />
            <ThemeModeSwitch compact className="lg:hidden" />
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
        className="flex min-h-15 flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-gold px-4 text-band-foreground md:px-6"
        style={{ background: "var(--band)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            aria-label="返回我的项目"
            className="flex size-9 items-center justify-center rounded-lg text-band-muted hover:bg-white/10 hover:text-band-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <span className="flex size-8 items-center justify-center rounded-lg bg-gold font-heading text-lg font-bold text-brand">
            责
          </span>
          <div className="leading-tight">
            <div className="font-heading text-base font-bold tracking-wide">自驱战略 · 定三责</div>
            <div className="text-xs text-band-muted">
              {project ? `${project.enterprise?.shortName ?? ""} · ${project.name}` : "加载项目…"}
            </div>
          </div>
        </div>
        <nav aria-label="项目导航" className="flex flex-wrap">
          {(overview.data?.projectRole && ENTERPRISE_ROLES.includes(overview.data.projectRole) && !overview.data.isConsultAdmin ? ENTERPRISE_NAV : FULL_NAV).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "border-b-2 px-3 py-4 text-sm",
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
          <ThemeModeSwitch compact />
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
