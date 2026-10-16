import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate, useParams } from "react-router";

import { UserDropdown } from "@/components/app-shell/header";
import { NotificationBell } from "@/components/dingze/notification-bell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_ROLE_LABELS, type ProjectRole } from "@dingze/shared";
import type { ProjectSummary } from "@/lib/dingze/api";
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

type TeamMember = { userId: number; nickname: string; projectRole: string };

/** 项目切换：标题即下拉，列出当前账号能进的项目；切换后停在同一入口（参考稿顶栏）。 */
function ProjectSwitcher({ projectId, projects, section }: { projectId: number; projects: ProjectSummary[]; section: string }) {
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === projectId);
  const label = project ? `${project.enterprise?.shortName ?? project.enterprise?.name ?? ""} · ${project.name}` : "加载项目…";
  const title = <span className="truncate font-heading text-[15px] font-bold tracking-wide">{label}</span>;
  if (projects.length < 2) return <div className="flex min-w-0 max-w-[20rem] items-center" title={label}>{title}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 max-w-[20rem] items-center gap-1 rounded-md px-1.5 py-1 hover:bg-white/10" aria-label="切换项目" title={`${label}（切换项目）`}>
        {title}
        <ChevronDown className="size-3.5 shrink-0 text-band-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>切换项目</DropdownMenuLabel>
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}/${p.id === projectId || section !== "expert" ? section : "overview"}`)}
              className="gap-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.enterprise?.shortName ?? p.enterprise?.name ?? ""} · {p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.projectRole ? PROJECT_ROLE_LABELS[p.projectRole] : ""}</span>
              </span>
              {p.id === projectId ? <Check className="size-4 shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/projects")}>全部项目</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 所有项目页同一条顶栏：品牌 · 项目切换 · 待办 / 定责 / 资料 / 成果 · 角色、成员、通知、头像。 */
function ProjectTopbar({
  projectId,
  projects,
  projectRole,
  isConsultAdmin,
  team,
  setSlotActions,
}: {
  projectId: number;
  projects: ProjectSummary[];
  projectRole: ProjectRole | null | undefined;
  isConsultAdmin: boolean;
  team: TeamMember[];
  setSlotActions?: (el: HTMLElement | null) => void;
}) {
  const section = useLocation().pathname.split("/")[3] || "overview";
  const nav = projectRole && ENTERPRISE_ROLES.includes(projectRole) && !isConsultAdmin ? ENTERPRISE_NAV : FULL_NAV;
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b-2 border-gold px-3 text-band-foreground md:px-4" style={{ background: "var(--band)" }}>
      <Link to="/projects" aria-label="返回我的项目" title="我的项目" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 hover:bg-white/10">
        <span className="flex size-9 items-center justify-center rounded-lg border border-white/25 font-heading text-lg font-bold text-gold">责</span>
        <span className="hidden font-heading text-[15px] font-bold tracking-wide xl:inline">自驱战略</span>
      </Link>
      <span aria-hidden className="hidden h-5 w-px bg-white/25 xl:block" />
      <ProjectSwitcher projectId={projectId} projects={projects} section={section} />
      <nav aria-label="项目导航" className="ml-2 flex h-full min-w-0 items-stretch overflow-x-auto">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.title}
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center border-b-2 px-3 pt-0.5 text-sm",
                isActive ? "border-gold font-bold text-band-foreground" : "border-transparent text-band-muted hover:text-band-foreground",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {projectRole ? <span className="hidden text-xs text-band-muted lg:inline">{PROJECT_ROLE_LABELS[projectRole]}</span> : null}
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
        {setSlotActions ? <div ref={setSlotActions} className="flex items-center" /> : null}
        <UserDropdown />
      </div>
    </header>
  );
}

export default function ProjectLayout() {
  const projectId = Number(useParams().projectId);
  const { project, data: projects, isLoading, error, notFound } = useProject(projectId);
  const overview = useProjectOverview(project);
  // The workspace fills the screen; its panel toggle goes into the top bar's action slot.
  const inWorkspace = !!useMatch("/projects/:projectId/workspace/*");
  const [slotActions, setSlotActions] = useState<HTMLElement | null>(null);
  const topbar = (
    <ProjectTopbar
      projectId={projectId}
      projects={projects ?? []}
      projectRole={overview.data?.projectRole ?? project?.projectRole}
      isConsultAdmin={!!overview.data?.isConsultAdmin}
      team={overview.data?.team ?? []}
      setSlotActions={inWorkspace ? setSlotActions : undefined}
    />
  );

  if (inWorkspace) {
    return (
      <div data-dingze-project className="flex h-svh flex-col overflow-hidden">
        {topbar}
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
            <Outlet context={{ project, overview: overview.data, topbar: { actions: slotActions } } satisfies ProjectContextValue} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-dingze-project className="flex min-h-svh flex-col">
      {topbar}

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
