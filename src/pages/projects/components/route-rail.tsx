import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  CircleDot,
  FileDown,
  FileText,
  FolderOpen,
  Library,
  Link2,
  Lock,
  Network,
  Table2,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { STAGES, type StageKey, getArtifactDef } from "@dingze/shared";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Route, type RouteStep, routePath } from "@/lib/dingze/route";
import { cn } from "@/lib/utils";

const STATE_DOT: Record<RouteStep["state"], string> = {
  locked: "text-muted-foreground",
  todo: "text-muted-foreground",
  doing: "text-[color:var(--dz-cus)]",
  returned: "text-destructive",
  review: "text-[color:var(--dz-ai)]",
  done: "text-[color:var(--dz-ok)]",
  final: "text-[color:var(--dz-ok)]",
};

function StepIcon({ step, className }: { step: RouteStep; className?: string }) {
  if (step.state === "locked") return <Lock className={cn("size-3.5 text-muted-foreground", className)} />;
  if (step.state === "final") return <Check className={cn("size-3.5 rounded-full bg-[color:var(--dz-ok)] p-0.5 text-white", className)} />;
  if (step.current || step.state === "doing" || step.state === "returned" || step.state === "review")
    return <CircleDot className={cn("size-3.5", STATE_DOT[step.state], className)} />;
  return <Circle className={cn("size-3.5", STATE_DOT[step.state], className)} />;
}

export type RailLink = { to: string; label: string; icon: "today" | "materials" | "org" | "export" | "artifacts" | "expert" };
const LINK_ICONS = { today: ArrowLeft, materials: FolderOpen, org: Building2, export: FileDown, artifacts: Library, expert: UsersRound };

/** 项目路线 (design 10 left rail): 工作任务 → 实施步骤 → 子步骤, collapsible to an icon bar. */
export function RouteRail({
  projectId,
  route,
  stages,
  links,
  collapsed,
  onToggle,
  materials = [],
  onOpenMaterial,
}: {
  /** 参考资料: the project's materials, newest first; opened in a side sheet. */
  materials?: { id: number; title: string }[];
  onOpenMaterial?: (id: number) => void;
  projectId: number;
  route: Route;
  /** First open table of each stage, for the stage switch. */
  stages: { key: StageKey; to: string; open: boolean }[];
  links: RailLink[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const back = links[0];
  const others = links.slice(1);
  const products = route.current ? route.current.codes.filter((c) => getArtifactDef(c).priority !== "method") : [];

  if (collapsed) {
    return (
      <nav aria-label="项目路线（收起）" className="flex h-full flex-col items-center gap-2 py-3">
        <button type="button" onClick={onToggle} aria-label="展开项目路线" className="flex size-9 items-center justify-center rounded-md border hover:bg-muted">
          <ChevronsRight className="size-4" />
        </button>
        {back ? (
          <Link to={back.to} aria-label={back.label} title={back.label} className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
        ) : null}
        <div className="h-px w-8 bg-border" />
        {route.tasks.map((task) => (
          <div key={task.label} className={cn("flex flex-col items-center gap-1 rounded-lg p-1", task.current && "bg-muted")}>
            {task.steps
              .filter((s) => !s.method)
              .map((s) => (
                <Link
                  key={s.key}
                  to={routePath(projectId, s.to)}
                  title={`${s.label}${s.badge ? ` · ${s.badge}` : ""}`}
                  aria-label={s.label}
                  aria-current={s.current ? "step" : undefined}
                  className={cn("flex size-8 items-center justify-center rounded-md hover:bg-background", s.current && "bg-brand text-brand-foreground hover:bg-brand")}
                >
                  <StepIcon step={s} className={s.current ? "text-brand-foreground" : undefined} />
                </Link>
              ))}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="项目路线" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-1 border-b px-3 py-2">
        {back ? (
          <Link to={back.to} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4 shrink-0" /> <span className="truncate">{back.label}</span>
          </Link>
        ) : null}
        <div className="grid grid-cols-4 gap-0.5" aria-label="项目入口">
          {others.map((l) => {
            const Icon = LINK_ICONS[l.icon];
            return (
              <Link key={l.to} to={l.to} className="flex flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
                <Icon className="size-4" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <div className="font-heading text-base font-bold">项目路线</div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-label="切换阶段">
              {route.stageName} · 已定版 {route.done} / {route.total} 步 <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {stages.map((s) => (
                <DropdownMenuItem key={s.key} onClick={() => navigate(s.to)} disabled={!s.open}>
                  {s.open ? null : <Lock className="size-3" />}
                  {STAGES.find((x) => x.key === s.key)!.name}
                  {s.key === route.stage ? <Check className="ml-auto size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <button type="button" onClick={onToggle} aria-label="收起项目路线" title="收起（窄屏时自动收起）" className="flex size-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted">
          <ChevronsLeft className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {route.tasks.map((task) => {
          const expanded = closed[task.label] === undefined ? task.current : !closed[task.label];
          return (
            <section key={task.label} className={cn("mb-2 rounded-lg", task.current && "bg-muted/60")}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setClosed({ ...closed, [task.label]: expanded })}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-semibold hover:bg-muted"
              >
                <span className="min-w-0 flex-1 leading-snug">{task.label}</span>
                {task.locked ? <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="待解锁" /> : <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !expanded && "-rotate-90")} />}
              </button>
              {expanded ? (
                <ol className="flex flex-col gap-0.5 pb-1.5">
                  {task.steps.map((s) => (
                    <li key={s.key}>
                      <Link
                        to={routePath(projectId, s.to)}
                        aria-current={s.current ? "step" : undefined}
                        title={s.state === "locked" ? "前面的表“本步完成”后解锁" : s.label}
                        className={cn(
                          "flex min-h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-background",
                          s.current && "bg-background font-semibold shadow-[inset_3px_0_0_var(--primary)]",
                          s.method && "pl-6 text-muted-foreground",
                        )}
                      >
                        <StepIcon step={s} />
                        <span className="min-w-0 flex-1 truncate">{s.label}</span>
                        {s.stale ? <span className="size-1.5 shrink-0 rounded-full bg-destructive" title="上游有改动" /> : null}
                        {s.badge ? <span className={cn("shrink-0 text-[11px]", s.state === "returned" ? "text-destructive" : "text-muted-foreground")}>{s.optional && s.state === "todo" ? "可跳过" : s.badge}</span> : null}
                      </Link>
                      {s.current && s.subs.length && s.subs.some((x) => x.to) ? (
                        <ol className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l pl-2">
                          {s.subs.map((sub) => (
                            <li key={sub.key}>
                              <Link
                                to={sub.to ? routePath(projectId, sub.to) : "#"}
                                aria-current={sub.current ? "step" : undefined}
                                className={cn("flex min-h-7 items-center gap-2 rounded px-1.5 text-xs hover:bg-background", sub.current ? "bg-brand font-semibold text-brand-foreground hover:bg-brand" : "text-muted-foreground")}
                              >
                                {sub.done && !sub.current ? <Check className="size-3 text-[color:var(--dz-ok)]" /> : <span className={cn("size-3 rounded-sm border", sub.current && "border-brand-foreground bg-brand-foreground/30")} />}
                                <span className="truncate">{sub.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="shrink-0 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <div className="mb-1 flex items-center gap-1">
          <FolderOpen className="size-3" /> 参考资料
          <Link to={`/projects/${projectId}/materials#library`} className="ml-auto text-primary hover:underline">
            {materials.length ? "全部 / 上传" : "去上传"}
          </Link>
        </div>
        {materials.length ? (
          materials.slice(0, 4).map((m) => (
            <button key={m.id} type="button" onClick={() => onOpenMaterial?.(m.id)} className="flex w-full items-center gap-1.5 py-0.5 text-left hover:text-foreground">
              <FileText className="size-3 shrink-0" />
              <span className="truncate">{m.title}</span>
            </button>
          ))
        ) : (
          <p>还没有资料：企业简介、组织架构、战略规划传上来，数字咨询师起草更准。</p>
        )}
      </div>
      {products.length ? (
        <div className="shrink-0 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-1">
            <Link2 className="size-3" /> 本步产出 · 同一份数据
          </div>
          {products.map((code) => {
            const def = getArtifactDef(code);
            const Icon = code === "S2-01" || code === "S1-02" ? Network : code === "S3-07" || code === "S3-08" ? FileText : Table2;
            return (
              <Link key={code} to={routePath(projectId, { code })} className="flex items-center gap-1.5 py-0.5 hover:text-foreground">
                <Icon className="size-3 shrink-0" />
                <span className="truncate">《{def.name}》</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
