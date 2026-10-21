import { CircleAlert, CircleCheck, LocateFixed, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Issue, IssueFix } from "@dingze/shared";

import { locateIssue } from "@/lib/dingze/locate";
import { cn } from "@/lib/utils";

function FixButton({ issue, onFix }: { issue: Issue; onFix?: (fix: IssueFix) => void }) {
  if (!issue.fix || !onFix) return null;
  return (
    <button type="button" onClick={() => onFix(issue.fix!)} className="ml-1.5 rounded border border-current/30 px-1.5 py-px text-[11px] font-semibold whitespace-nowrap hover:bg-background/60">
      {issue.fix.label}
    </button>
  );
}

function IssueItem({ issue, onFix }: { issue: Issue; onFix?: (fix: IssueFix) => void }) {
  if (!issue.anchor)
    return (
      <li>
        {issue.message}
        <FixButton issue={issue} onFix={onFix} />
      </li>
    );
  return (
    <li>
      <button
        type="button"
        className="inline-flex items-start gap-1 text-left underline decoration-dotted underline-offset-4 hover:decoration-solid"
        title="定位到这一行"
        onClick={() => {
          void locateIssue(issue).then((found) => {
            if (!found) toast.info("这一条针对整张表，在表里找不到对应的行");
          });
        }}
      >
        <LocateFixed className="mt-0.5 size-3.5 shrink-0 opacity-70" />
        {issue.message}
      </button>
      <FixButton issue={issue} onFix={onFix} />
    </li>
  );
}

/** Errors block “本步完成” and confirmation; warnings never block (Q3). Each issue with an anchor jumps to its row. */
export function ValidationBar({
  issues,
  hasRules,
  optional = false,
  onFix,
}: {
  issues: Issue[];
  hasRules: boolean;
  /** P1 tables can be skipped: their gaps are not shown as 必须改 (验收 E D04). */
  optional?: boolean;
  /** Applies an issue's one-click fix (按上游更新…) to the draft; absent when the table is read-only. */
  onFix?: (fix: IssueFix) => void;
}) {
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const errors = issues.filter((i) => i.level === "error");
  // 能一键修正的上下游不一致排在前面，免得被折叠。
  const warnings = issues.filter((i) => i.level === "warning").sort((a, b) => Number(!!b.fix) - Number(!!a.fix));
  if (!hasRules) return null;
  const shownWarnings = showAllWarnings ? warnings : warnings.slice(0, 3);

  return (
    <section data-dingze-validation
      role="status"
      aria-label="校验结果"
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-sm",
        errors.length && optional
          ? "border-[color:var(--dz-warn)]/40 bg-card text-foreground"
          : errors.length
            ? "border-destructive/30 bg-status-stale text-status-stale-foreground"
            : "border-status-done-foreground/20 bg-status-done text-status-done-foreground"
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        {errors.length ? <CircleAlert className="size-4" /> : <CircleCheck className="size-4" />}
        {errors.length && optional
          ? `这张表可选，可以跳过；要做完还差 ${errors.length} 处——点问题可定位`
          : errors.length
            ? `还差 ${errors.length} 处才能“本步完成”——草稿可以先保存；点问题可定位`
            : "结构校验通过"}
      </div>
      {errors.length ? (
        <ul className="flex flex-col gap-1">
          {errors.slice(0, 12).map((issue, i) => (
            <IssueItem key={`${issue.anchor}-${i}`} issue={issue} onFix={onFix} />
          ))}
          {errors.length > 12 ? <li>……另有 {errors.length - 12} 处</li> : null}
        </ul>
      ) : null}
      {warnings.length ? (
        <div className="flex flex-col gap-1 text-xs opacity-90">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-3.5 shrink-0" />
            <span>提示（不阻断）{warnings.length} 条</span>
            {warnings.length > 3 ? (
              <button type="button" className="underline" onClick={() => setShowAllWarnings((v) => !v)}>
                {showAllWarnings ? "收起" : "全部展开"}
              </button>
            ) : null}
          </div>
          <ul className="flex flex-col gap-0.5 pl-5">
            {shownWarnings.map((issue, i) => (
              <IssueItem key={`${issue.anchor}-w${i}`} issue={issue} onFix={onFix} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
