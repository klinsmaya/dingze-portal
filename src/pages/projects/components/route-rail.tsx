import {
  Building2,
  Check,
  CircleCheck,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Contrast,
  FileText,
  FolderOpen,
  Link2,
  Lock,
  Network,
  Table2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import { STAGES, type StageKey, getArtifactDef } from "@dingze/shared";

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

/** ● 已定版 · ✓ 本步完成 · ◑ 进行中 / 复核中 / 退回 · ○ 未开始 · 🔒 未解锁（参考稿左栏）。 */
function StepIcon({ step, className }: { step: RouteStep; className?: string }) {
  if (step.state === "locked") return <Lock className={cn("size-3.5 text-muted-foreground", className)} />;
  if (step.state === "final") return <Check className={cn("size-3.5 rounded-full bg-[color:var(--dz-ok)] p-0.5 text-white", className)} />;
  if (step.state === "done") return <CircleCheck className={cn("size-3.5", STATE_DOT.done, className)} />;
  if (step.state === "doing" || step.state === "returned" || step.state === "review") return <Contrast className={cn("size-3.5", STATE_DOT[step.state], className)} />;
  return <Circle className={cn("size-3.5", STATE_DOT[step.state], className)} />;
}

/** 步骤行第二行：状态说一句话，锁住的说在等什么。 */
function stepNote(s: RouteStep): string {
  switch (s.state) {
    case "locked":
      return s.waiting ?? "前面的表本步完成后解锁";
    case "final":
      return "已定版";
    case "review":
      return s.badge || "待复核";
    case "done":
      return "本步完成 · 可提交复核";
    case "returned":
      return "已退回 · 按批注修改";
    case "doing":
      return /^\d+\/\d+$/.test(s.badge) ? `进行中 · 小节 ${s.badge}` : "进行中";
    default:
      return s.optional ? "可选 · 不做可跳过" : "未开始";
  }
}

export type RailStage = { key: StageKey; to: string; open: boolean; complete: boolean; locked: number; gateTotal: number };
export type RailStats = { ready: number; review: number };

const CHEVRON = [
  "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)",
  "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)",
  "polygon(0 0, 100% 0, 100% 100%, 0 100%, 8px 50%)",
];

/** 三段阶段条：定战略 ▸ 定目标 ▸ 定行动，当前段深色，未开启的上锁，点一下切换。 */
function StageBar({ current, stages }: { current: StageKey; stages: RailStage[] }) {
  return (
    <ol aria-label="三阶段" className="flex min-w-0 flex-1">
      {stages.map((st, i) => {
        const name = STAGES.find((x) => x.key === st.key)!.name.replace(/责$/, "");
        const now = st.key === current;
        const body = (
          <>
            {!st.open ? <Lock className="size-3 shrink-0" /> : st.complete && !now ? <Check className="size-3 shrink-0 text-[color:var(--dz-ok)]" /> : null}
            <span className="truncate">{name}</span>
          </>
        );
        const cls = cn(
          "flex h-7 items-center justify-center gap-0.5 text-[12px]",
          i > 0 ? "pl-2.5 pr-2" : "pl-1.5 pr-2.5",
          now ? "bg-brand font-semibold text-brand-foreground" : st.open ? "bg-muted text-foreground hover:bg-muted/70" : "bg-muted/50 text-muted-foreground",
        );
        return (
          <li key={st.key} className={cn("min-w-0 flex-1", i > 0 && "-ml-1")} style={{ clipPath: CHEVRON[i] }}>
            {st.open && !now ? (
              <Link to={st.to} className={cls} title={`切换到${STAGES[i].name}（必做表已定版 ${st.locked} / ${st.gateTotal}）`}>
                {body}
              </Link>
            ) : (
              <span className={cls} aria-current={now ? "step" : undefined} title={st.open ? STAGES[i].name : `${STAGES[i].name}：上一阶段全部定版后开启`}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}


type FootState = { materials: boolean; products: boolean };
const FOOT_KEY = "dingze:rail-foot";

/** 左栏底部两块默认收起，给路线让出高度；展开过的本机记住。 */
function readFoot(): FootState {
  try {
    const v = JSON.parse(localStorage.getItem(FOOT_KEY) ?? "null");
    if (v && typeof v === "object") return { materials: !!v.materials, products: !!v.products };
  } catch {
    // 读不到按默认
  }
  return { materials: false, products: false };
}

function FootSection({ open, onToggle, icon, title, extra, children }: { open: boolean; onToggle: () => void; icon: ReactNode; title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 items-center gap-1 hover:text-foreground">
          <ChevronRight className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")} />
          {icon}
          <span className="truncate">{title}</span>
        </button>
        {extra}
      </div>
      {open ? <div className="mt-1 pl-4">{children}</div> : null}
    </div>
  );
}

/** 项目路线 (design 10 left rail): 工作任务 → 实施步骤 → 子步骤, collapsible to an icon bar. */
export function RouteRail({
  projectId,
  route,
  stages,
  stats,
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
  /** 三阶段：入口、是否开启、必做表定版进度。 */
  stages: RailStage[];
  /** 当前阶段可提交、待复核的表数。 */
  stats: RailStats;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [foot, setFootState] = useState<FootState>(readFoot);
  const setFoot = (next: FootState) => {
    setFootState(next);
    try {
      localStorage.setItem(FOOT_KEY, JSON.stringify(next));
    } catch {
      // 无痕模式等存不了时只在本页记住
    }
  };
  const stage = stages.find((x) => x.key === route.stage);
  const products = route.current ? route.current.codes.filter((c) => getArtifactDef(c).priority !== "method") : [];

  if (collapsed) {
    return (
      <nav aria-label="项目路线（收起）" className="flex h-full flex-col items-center gap-2 py-3">
        <button type="button" onClick={onToggle} aria-label="展开项目路线" className="flex size-9 items-center justify-center rounded-md border hover:bg-muted">
          <ChevronsRight className="size-4" />
        </button>
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
      <div className="shrink-0 border-b px-3 pt-3 pb-2.5">
        <StageBar current={route.stage} stages={stages} />
        <div className="mt-2.5 px-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 font-heading text-[15px] font-bold leading-snug">
              第{["一", "二", "三"][STAGES.findIndex((x) => x.key === route.stage)]}阶段 {route.stageName}
            </div>
            <button type="button" onClick={onToggle} aria-label="收起项目路线" title="收起（窄屏时自动收起）" className="flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted">
              <ChevronsLeft className="size-3.5" />
            </button>
          </div>
          {stage ? (
            <>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {STAGES.find((x) => x.key === route.stage)!.goal} · 必做表已定版 {stage.locked} / {stage.gateTotal}
                {stats.ready ? ` · ${stats.ready} 张可提交` : ""}
                {stats.review ? ` · ${stats.review} 张待复核` : ""}
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${route.stageName}定版进度`} aria-valuenow={stage.locked} aria-valuemax={stage.gateTotal}>
                <div className="h-full rounded-full bg-brand" style={{ width: `${stage.gateTotal ? (stage.locked / stage.gateTotal) * 100 : 0}%` }} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {route.tasks.map((task) => {
          // 当前阶段的工作任务都展开（每节只有 1–3 步，后面要做什么一眼看清），手动收起的记住。
          const expanded = !closed[task.label];
          return (
            <section key={task.label} className="mb-1.5">
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
                        title={s.state === "locked" ? s.waiting : s.label}
                        className={cn(
                          "flex min-h-8 items-start gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted",
                          s.current && "bg-primary/8 font-semibold shadow-[inset_3px_0_0_var(--primary)] hover:bg-primary/10",
                          s.method && "py-1 pl-6 text-muted-foreground",
                        )}
                      >
                        <StepIcon step={s} className="mt-[3px] shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={cn("min-w-0 flex-1 leading-snug", s.state === "locked" && "text-muted-foreground")}>{s.label}</span>
                            {s.method ? null : <span className="shrink-0 text-[11px] font-normal text-muted-foreground tabular-nums">{s.codeLabel}</span>}
                          </span>
                          {s.method ? null : (
                            <span className={cn("mt-0.5 flex items-center gap-1 text-[11px] font-normal", s.state === "returned" ? "text-destructive" : "text-muted-foreground")}>
                              <span className="truncate">{stepNote(s)}</span>
                              {s.stale ? (
                                <span className="flex shrink-0 items-center gap-1 text-[color:var(--dz-warn)]" title="上游已变更，需要核对">
                                  <span className="size-1.5 rounded-full bg-[color:var(--dz-warn)]" />
                                  上游已变更
                                </span>
                              ) : null}
                            </span>
                          )}
                        </span>
                      </Link>
                      {s.current && s.subs.length ? (
                        <ol className="mt-0.5 mb-1 ml-[15px] flex flex-col gap-0.5 border-l pl-2" aria-label="本表小节">
                          {s.subs.map((sub) => {
                            const inner = (
                              <>
                                {sub.done && !sub.current ? <Check className="size-3 text-[color:var(--dz-ok)]" /> : <span className={cn("size-2 rounded-full border", sub.current ? "border-primary bg-primary" : "border-muted-foreground/50")} />}
                                <span className="truncate">{sub.label}</span>
                              </>
                            );
                            const cls = cn("flex min-h-7 items-center gap-2 rounded px-1.5 text-xs", sub.current ? "font-semibold text-primary" : "text-muted-foreground");
                            return (
                              <li key={sub.key}>
                                {sub.to ? (
                                  <Link to={routePath(projectId, sub.to)} aria-current={sub.current ? "step" : undefined} className={cn(cls, "hover:bg-muted")}>
                                    {inner}
                                  </Link>
                                ) : (
                                  <span className={cls}>{inner}</span>
                                )}
                              </li>
                            );
                          })}
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

      <FootSection
        open={foot.materials}
        onToggle={() => setFoot({ ...foot, materials: !foot.materials })}
        icon={<FolderOpen className="size-3" />}
        title={`参考资料${materials.length ? ` · ${materials.length}` : ""}`}
        extra={
          <Link to={`/projects/${projectId}/materials#library`} className="ml-auto text-primary hover:underline">
            {materials.length ? "全部 / 上传" : "去上传"}
          </Link>
        }
      >
        <Link to={`/projects/${projectId}/materials#org`} className="flex items-center gap-1.5 py-0.5 hover:text-foreground" title="组织与职责：部门、负责人和职责">
          <Building2 className="size-3 shrink-0" /> 组织与职责
        </Link>
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
      </FootSection>
      {products.length ? (
        <FootSection open={foot.products} onToggle={() => setFoot({ ...foot, products: !foot.products })} icon={<Link2 className="size-3" />} title={`本步产出 · 同一份数据 · ${products.length}`}>
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
        </FootSection>
      ) : null}
    </nav>
  );
}
