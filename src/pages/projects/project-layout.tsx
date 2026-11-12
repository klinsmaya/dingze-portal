import { Check, ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation, useMatch, useNavigate, useParams } from "react-router";

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
import { ARTIFACTS, PROJECT_ROLE_LABELS, STAGES, type ProjectRole, type StageKey } from "@dingze/shared";
import type { ArtifactOverview, ProjectSummary } from "@/lib/dingze/api";
import { setGateHint } from "@/lib/dingze/gate-hint";
import { stageBlockers, stageEntryCode, stageProgress } from "@/lib/dingze/progress";
import { useProject, useProjectOverview } from "@/lib/dingze/queries";
import { cn } from "@/lib/utils";

import type { ProjectContextValue } from "./project-context";

// 项目导航按客户流程排（2026-11 甲方反馈）：总览 · ① 资料 · ② 战略解码 · ③ 目标分解 · ④ 计划制定 · ⑤ 成果；
// 专家咨询只在数字咨询师面板底部有一个入口。三个阶段各自跳到本阶段第一张还没定版的表。
type NavItem = { key: string; to: string; label: string; no?: number; title: string; locked?: boolean; done?: boolean; gate?: StageKey };

function flowNav(artifacts: ArtifactOverview[], library: boolean): NavItem[] {
  const stages = stageProgress(artifacts);
  return [
    { key: "overview", to: "overview", label: "总览", title: "总览：现在在第几步、下一步做什么" },
    // 资料库和画像由企业管理员、咨询师管；普通员工在填表时传附件，不进这一页。
    ...(library ? [{ key: "materials", to: "materials", label: "资料", no: 1, title: "上传资料：企业简介、组织架构、上年经营复盘，确认企业画像" }] : []),
    ...STAGES.map((stage, i): NavItem => {
      const p = stages.find((x) => x.stage === stage.key);
      const locked = !!p && !p.open;
      // 还没开启的阶段：点一下去前面第一张还没定版的必做表，左栏把没定版的都标出来。
      const blockers = locked ? stageBlockers(artifacts, stage.key) : null;
      return {
        key: stage.key,
        to: `workspace/${encodeURIComponent(blockers ? blockers.codes[0] : stageEntryCode(artifacts, stage.key))}`,
        label: stage.flow,
        no: i + 2,
        title: `${stage.flow}（书中：${stage.name}）${blockers ? `：前面还有 ${blockers.codes.length} 张必做表没定版，点一下去看` : locked ? "：上一步全部定版后开启" : ""}`,
        locked,
        done: !!p?.complete,
        gate: blockers ? stage.key : undefined,
      };
    }),
    { key: "results", to: "results", label: "成果", no: STAGES.length + 2, title: "成果：每张表的状态与版本，下载计划书和各表" },
  ];
}
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
  artifacts,
  setSlotActions,
}: {
  projectId: number;
  projects: ProjectSummary[];
  projectRole: ProjectRole | null | undefined;
  isConsultAdmin: boolean;
  team: TeamMember[];
  artifacts: ArtifactOverview[];
  setSlotActions?: (el: HTMLElement | null) => void;
}) {
  const parts = useLocation().pathname.split("/");
  const section = parts[3] || "overview";
  const consulting = !(projectRole && ENTERPRISE_ROLES.includes(projectRole) && !isConsultAdmin);
  const nav = flowNav(artifacts, consulting || projectRole === "ent_lead");
  // 在填写页时，亮起当前这张表所在的阶段。
  const code = section === "workspace" && parts[4] ? decodeURIComponent(parts[4]) : null;
  const activeKey = code ? ARTIFACTS.find((a) => a.code === code)?.stage ?? null : section;
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b-2 border-gold px-3 text-band-foreground md:px-4" style={{ background: "var(--band)" }}>
      <Link to="/projects" aria-label="返回我的项目" title="我的项目" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 hover:bg-white/10">
        <span className="flex size-9 items-center justify-center rounded-lg border border-white/25 font-heading text-lg font-bold text-gold">责</span>
        <span className="hidden font-heading text-[15px] font-bold tracking-wide xl:inline">自驱战略</span>
      </Link>
      <span aria-hidden className="hidden h-5 w-px bg-white/25 xl:block" />
      <ProjectSwitcher projectId={projectId} projects={projects} section={section} />
      <nav aria-label="项目导航" className="ml-2 flex h-full min-w-0 items-stretch overflow-x-auto">
        {nav.map((item) => {
          const active = item.key === activeKey;
          const className = cn(
            "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-0.5 text-sm",
            active ? "border-gold font-bold text-band-foreground" : item.locked ? cn("border-transparent text-band-muted/60", item.gate ? "hover:text-band-foreground" : "cursor-not-allowed") : "border-transparent text-band-muted hover:text-band-foreground",
          );
          const inner = (
            <>
              {item.no ? (
                <span
                  aria-hidden
                  className={cn(
                    "flex size-[18px] items-center justify-center rounded-full border text-[11px] font-bold",
                    item.done ? "border-gold bg-gold text-[#0c3d52]" : active ? "border-gold text-gold" : item.locked ? "border-white/25" : "border-white/40",
                  )}
                >
                  {item.done ? <Check className="size-3" /> : item.no}
                </span>
              ) : null}
              {item.label}
              {item.locked ? <Lock className="size-3 opacity-70" aria-label="待开启" /> : null}
            </>
          );
          // 还没开启的阶段不进锁定页：带到前面第一张没定版的必做表，并在左栏标红（测试反馈 3）。
          return item.locked && !active && !item.gate ? (
            <span key={item.key} title={item.title} aria-disabled="true" className={className}>
              {inner}
            </span>
          ) : (
            <Link
              key={item.key}
              to={item.to}
              title={item.title}
              aria-current={active ? "page" : undefined}
              className={className}
              onClick={item.gate ? () => setGateHint(projectId, item.gate!) : undefined}
            >
              {inner}
            </Link>
          );
        })}
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
  // 资料页和填写页一样：左边内容自己滚动，右边对话的输入框固定在底部（大屏）。
  const fillScreen = !!useMatch("/projects/:projectId/materials");
  const [slotActions, setSlotActions] = useState<HTMLElement | null>(null);
  const topbar = (
    <ProjectTopbar
      projectId={projectId}
      projects={projects ?? []}
      projectRole={overview.data?.projectRole ?? project?.projectRole}
      isConsultAdmin={!!overview.data?.isConsultAdmin}
      team={overview.data?.team ?? []}
      artifacts={overview.data?.artifacts ?? []}
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
    <div data-dingze-project className={cn("flex min-h-svh flex-col", fillScreen && "lg:h-svh lg:overflow-hidden")}>
      {topbar}

      <div className={cn("flex flex-1 flex-col", fillScreen && "lg:min-h-0")}>
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
