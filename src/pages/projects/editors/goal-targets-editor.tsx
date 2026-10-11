import {
  type AnnualGoal,
  type BudgetWorksheet,
  type GoalTargets,
  type Issue,
  type KpiBreakdown,
  PERSPECTIVES,
  type Perspective,
  emptyGoal,
  goalsFromBreakdown,
  newRowId,
} from "@dingze/shared";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: GoalTargets;
  onChange: (next: GoalTargets) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S1-07"?: KpiBreakdown };
  projectYear: number;
};

const COLUMNS: { key: "purpose" | "task" | "metric" | "value" | "unit"; label: string; placeholder: string; width: string }[] = [
  { key: "purpose", label: "目的", placeholder: "为什么做：对战略的贡献", width: "min-w-48" },
  { key: "task", label: "任务", placeholder: "动词＋宾语，如“提升车用气销量”", width: "min-w-44" },
  { key: "metric", label: "衡量指标", placeholder: "用什么衡量", width: "min-w-32" },
  { key: "value", label: "指标值", placeholder: "做到什么程度", width: "min-w-28" },
  { key: "unit", label: "单位", placeholder: "", width: "min-w-16" },
];

/** S2-03 第一步 定目标: annual company goals (目的＋任务＋目标值), the starting point of 找路径. */
export function GoalTargetsEditor({ value, onChange, readOnly, issues, upstream, projectYear }: Props) {
  const invalid = errorAnchors(issues);
  const goals = value.goals ?? [];
  const year = value.year || projectYear;
  const fromBreakdown = goalsFromBreakdown(upstream["S1-07"], year, goals);
  const setGoals = (next: AnnualGoal[]) => onChange({ ...value, year, goals: next });

  return (
    <section aria-label="公司级年度目标" className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-muted-foreground">往上看 · 回顾公司战略（表 3-4）</div>
          <TextCell
            label="回顾公司战略"
            multiline
            placeholder="使命、愿景、战略目标与 S1-07 本年度要求"
            value={value.strategyReview}
            onChange={(strategyReview) => onChange({ ...value, year, strategyReview })}
            readOnly={readOnly}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-muted-foreground">往回看 · 上一经营周期的问题及解决方案</div>
          <TextCell
            label="上一经营周期的问题"
            multiline
            placeholder="来自年中 / 年终经营分析会"
            value={value.lastPeriodIssues}
            onChange={(lastPeriodIssues) => onChange({ ...value, year, lastPeriodIssues })}
            readOnly={readOnly}
          />
        </div>
      </div>

      <EditorToolbar hint={`${year} 年度公司级目标。指标值只取企业给定的数（S1-07 本年度目标或经营预算），数字咨询师不会代填。`}>
        <ImportButton label={`带入 S1-07 ${year} 年目标`} count={fromBreakdown.length} readOnly={readOnly} onClick={() => setGoals([...goals, ...fromBreakdown])} />
        {!readOnly ? <AddButton label="添加目标" onClick={() => setGoals([...goals, emptyGoal()])} /> : null}
      </EditorToolbar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="min-w-28 px-2 py-2 text-left font-semibold">层面</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                  {c.label}
                </th>
              ))}
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {goals.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                  还没有年度目标
                </td>
              </tr>
            ) : (
              goals.map((g) => (
                <tr data-anchor={g.id} key={g.id} className={cn("border-t align-top", invalid.has(g.id) && "bg-destructive/5")}>
                  <td className="px-1 py-1">
                    <NativeSelect
                      size="sm"
                      aria-label="层面"
                      value={g.perspective}
                      disabled={readOnly}
                      onChange={(e) => setGoals(patchById(goals, g.id, { perspective: e.target.value as Perspective }))}
                    >
                      {PERSPECTIVES.map((p) => (
                        <NativeSelectOption key={p.key} value={p.key}>
                          {p.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      <TextCell
                        label={`${g.task || g.metric || "目标"} ${c.label}`}
                        placeholder={c.placeholder}
                        multiline={c.key === "purpose"}
                        value={g[c.key]}
                        onChange={(v) => setGoals(patchById(goals, g.id, { [c.key]: v }))}
                        readOnly={readOnly}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <RowActions
                      label={g.task || g.metric || "目标"}
                      readOnly={readOnly}
                      onRemove={() => setGoals(removeById(goals, g.id))}
                      onMove={(delta) => setGoals(moveById(goals, g.id, delta))}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** M-BUDGET (表 3-5): last year vs budget by item. */
export function BudgetWorksheetEditor({
  value,
  onChange,
  readOnly,
}: {
  value: BudgetWorksheet;
  onChange: (next: BudgetWorksheet) => void;
  readOnly: boolean;
  issues: Issue[];
}) {
  const rows = value.rows ?? [];
  const setRows = (next: BudgetWorksheet["rows"]) => onChange({ ...value, rows: next });
  return (
    <section aria-label="年度经营预算" className="flex flex-col gap-4">
      <EditorToolbar hint="表 3-6：先写预算编制说明（战略回顾与假设），再填收入、成本费用、人员、投资研发和现金流预算，最后综合汇总。预算作为方法底稿保存。">
        <div className="flex items-center gap-2 text-sm">
          单位
          <TextCell label="预算单位" value={value.unit} onChange={(unit) => onChange({ ...value, unit })} readOnly={readOnly} className="w-24" />
        </div>
        {!readOnly ? (
          <AddButton label="添加科目" onClick={() => setRows([...rows, { id: newRowId("b"), item: "", lastYear: "", budget: "", note: "" }])} />
        ) : null}
      </EditorToolbar>
      <TextCell
        label="预算编制说明"
        multiline
        placeholder="预算编制说明：依据哪些战略回顾与经营假设（如价格、销量、人员编制）编制"
        value={value.basis ?? ""}
        onChange={(basis) => onChange({ ...value, basis })}
        readOnly={readOnly}
        className="min-h-20"
      />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="min-w-36 px-2 py-2 text-left font-semibold">科目</th>
              <th className="min-w-28 px-2 py-2 text-left font-semibold">上年实际</th>
              <th className="min-w-28 px-2 py-2 text-left font-semibold">本年预算</th>
              <th className="min-w-48 px-2 py-2 text-left font-semibold">说明</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                {(["item", "lastYear", "budget", "note"] as const).map((key) => (
                  <td key={key} className="px-1 py-1">
                    <TextCell label={`${r.item || "科目"} ${key}`} value={r[key]} onChange={(v) => setRows(patchById(rows, r.id, { [key]: v }))} readOnly={readOnly} />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <RowActions label={r.item || "科目"} readOnly={readOnly} onRemove={() => setRows(removeById(rows, r.id))} onMove={(delta) => setRows(moveById(rows, r.id, delta))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
