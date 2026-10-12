import { BookOpen, Check, ChevronDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { type DecodeMap, type GoalPathSystem, type Perspective } from "@dingze/shared";

import { FIGURE_3_7, type Figure37Item, figureTag } from "@/lib/dingze/figure-3-7";
import { workspacePath } from "@/lib/dingze/progress";
import { cn } from "@/lib/utils";
import { useProjectContext } from "@/pages/projects/project-context";

// 找路径的五个子步骤 (design 10): 1–4 are the four layers of the decode map (S2-01), 5 imports
// and breaks the paths down in the path system table (S2-03). The bar is the same on both tables.

export const FIND_PATH_STEPS: { no: number; title: string; perspective?: Perspective }[] = [
  { no: 1, title: "股东价值差距", perspective: "financial" },
  { no: 2, title: "客户价值主张", perspective: "customer" },
  { no: 3, title: "关键价值创造流程", perspective: "process" },
  { no: 4, title: "战略资产准备度", perspective: "learning" },
  { no: 5, title: "导入路径系统表" },
];

export function FindPathSteps({
  active,
  map,
  paths,
  onPick,
}: {
  /** 1–5. */
  active: number;
  map: DecodeMap | undefined;
  paths: GoalPathSystem | undefined;
  /** Inside S2-01: switch the layer in place instead of navigating. */
  onPick?: (no: number) => void;
}) {
  const { project } = useProjectContext();
  const themes = map?.themes ?? [];
  const count = (step: (typeof FIND_PATH_STEPS)[number]) =>
    step.perspective ? themes.filter((t) => t.perspective === step.perspective).length : (paths?.nodes ?? []).length;
  return (
    <nav aria-label="找路径的五个子步骤" className="flex flex-wrap items-stretch gap-1 rounded-xl border bg-card p-1 text-xs">
      {FIND_PATH_STEPS.map((step) => {
        const n = count(step);
        const current = step.no === active;
        const body = (
          <>
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", current ? "bg-brand-foreground text-brand" : n ? "bg-status-done text-status-done-foreground" : "bg-muted text-muted-foreground")}>
              {n && !current ? <Check className="size-3" /> : step.no}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">{step.title}</span>
              <span className={cn("text-[10px]", current ? "opacity-80" : "text-muted-foreground")}>
                子步骤 {step.no} · {step.perspective ? `S2-01 · ${n ? `${n} 个主题` : "待开始"}` : `S2-03 · ${n ? `${n} 条路径` : "待导入"}`}
              </span>
            </span>
          </>
        );
        const className = cn("flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left", current ? "bg-brand text-brand-foreground" : "hover:bg-accent");
        const inMap = !!step.perspective;
        if (onPick && inMap) {
          return (
            <button key={step.no} type="button" aria-current={current ? "step" : undefined} className={className} onClick={() => onPick(step.no)}>
              {body}
            </button>
          );
        }
        const to = inMap ? `${workspacePath(project.id, "S2-01")}?sub=${step.no}` : workspacePath(project.id, "S2-03");
        return (
          <Link key={step.no} to={to} aria-current={current ? "step" : undefined} className={className}>
            {body}
          </Link>
        );
      })}
    </nav>
  );
}

/** 图 3-7 reference card (design 10 画面 1): ticked items are already on the map; click one to add it. */
export function Figure37Card({
  used,
  onPick,
  readOnly,
  hint = "点一项 = 在导图里加一个一级路径，也可以直接拖进去",
  defaultOpen = true,
}: {
  /** How many existing items started from each figure item, by item key → order numbers. */
  used: Record<string, number[]>;
  onPick: (item: Figure37Item) => void;
  readOnly: boolean;
  hint?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="flex items-center gap-1.5 rounded-lg border bg-popover px-3 py-1.5 text-xs font-semibold shadow-md hover:border-brand"
      >
        <BookOpen className="size-3.5" /> 图 3-7 · 增长战略 <ChevronDown className="size-3.5" />
      </button>
    );
  }
  return (
    <aside aria-label="图 3-7 增长战略参考卡" className="w-60 rounded-xl border bg-popover text-sm shadow-lg">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="flex items-center gap-1.5 font-heading text-sm font-bold">
          <BookOpen className="size-3.5" /> 图 3-7 · 增长战略
        </span>
        <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)} aria-expanded>
          收起
        </button>
      </div>
      <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto px-3 py-2">
        {FIGURE_3_7.map((s) =>
          s.groups.map((g) => (
            <div key={`${s.strategy}-${g.name}`} className="flex flex-col">
              <div className="flex items-center gap-1 py-0.5 text-xs font-semibold" style={{ color: "var(--dz-fin)" }}>
                <TrendingUp className="size-3" /> {g.name === "生产率" ? s.strategy : g.name}
              </div>
              {g.items.map((item) => {
                const nos = used[item.key] ?? [];
                const on = nos.length > 0;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={readOnly}
                    onClick={() => onPick(item)}
                    title={`${figureTag(item)}：加一个一级路径`}
                    className="flex items-center gap-2 rounded px-1 py-1 text-left text-[13px] hover:bg-muted disabled:opacity-60"
                  >
                    <span aria-hidden className={cn("flex size-3.5 shrink-0 items-center justify-center rounded-sm border", on && "border-brand bg-brand text-brand-foreground")}>
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {on ? <span className="text-[11px] text-muted-foreground">第 {nos.join("、")} 条</span> : null}
                  </button>
                );
              })}
            </div>
          )),
        )}
      </div>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">{hint}</p>
    </aside>
  );
}
