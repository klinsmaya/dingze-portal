import { Check, ChevronDown, ChevronUp } from "lucide-react";
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

/** 图 3-7 reference card: click an item to start a level-1 path (or financial theme) from it. */
export function Figure37Card({
  used,
  onPick,
  readOnly,
  hint = "点一项 = 加一个一级路径（挂到第一个年度目标，可再移动）",
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
  return (
    <aside aria-label="图 3-7 增长战略参考卡" className={cn("w-full shrink-0 rounded-xl border border-book-border bg-book p-3 text-sm text-book-foreground", open ? "lg:w-56" : "lg:w-auto")}>
      <button type="button" className="flex w-full items-center justify-between font-heading font-bold" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{open ? "图 3-7 · 一级路径按两组想" : "图 3-7"}</span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-3">
          {FIGURE_3_7.map((s) => (
            <div key={s.strategy} className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold opacity-80">{s.strategy}</div>
              {s.groups.map((g) => (
                <div key={g.name} className="flex flex-col gap-1">
                  {s.groups.length > 1 || g.name !== s.strategy ? <div className="text-xs">{g.name}</div> : null}
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((item) => {
                      const nos = used[item.key] ?? [];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          disabled={readOnly}
                          onClick={() => onPick(item)}
                          title={`${figureTag(item)}：加一个一级路径`}
                          className={cn("rounded-md border bg-background px-2 py-1 text-xs text-foreground hover:border-brand disabled:opacity-60", nos.length && "border-brand/50")}
                        >
                          {nos.length ? <Check className="mr-0.5 inline size-3 text-status-done-foreground" /> : null}
                          {item.label}
                          {nos.length ? <span className="ml-1 text-[10px] text-muted-foreground">第 {nos.join("、")} 条</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <p className="text-[11px] opacity-80">{hint}</p>
        </div>
      ) : null}
    </aside>
  );
}
