import { Minus, Plus, RotateCcw } from "lucide-react";

import {
  type Issue,
  type KpiBreakdown,
  type KpiBreakdownRow,
  type StrategyKpiTable,
  breakdownRow,
  breakdownRowsFromKpis,
  defaultBreakdownYears,
} from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: KpiBreakdown;
  onChange: (next: KpiBreakdown) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S1-06"?: StrategyKpiTable };
  projectYear: number;
};

const REFERENCE_COLUMNS: { key: "baseline" | "benchmark" | "challenge"; label: string; hint: string }[] = [
  { key: "baseline", label: "基准值", hint: "历史水平" },
  { key: "benchmark", label: "标杆值", hint: "行业最佳" },
  { key: "challenge", label: "挑战值", hint: "约 70% 达成概率" },
];

/** S1-07 (表 2-12): strategy KPI values by year, 前三后一, with baseline / benchmark / challenge. */
export function KpiBreakdownEditor({ value, onChange, readOnly, issues, upstream, projectYear }: Props) {
  const invalid = errorAnchors(issues);
  const years = value.years?.length ? value.years : defaultBreakdownYears(projectYear);
  const rows = value.rows ?? [];
  const fromKpis = breakdownRowsFromKpis(upstream["S1-06"], rows);
  const setRows = (next: KpiBreakdownRow[]) => onChange({ ...value, years, rows: next });
  const setYears = (next: number[]) => onChange({ ...value, years: next, rows });

  return (
    <section aria-label="战略 KPI 3—5 年年度分解表" className="flex flex-col gap-4">
      <EditorToolbar hint={`设值三步：基准值 → 标杆值 → 挑战值；按近详远略分解（前三后一）。第一列 ${years[0]} 年即本年度目标，定目标责会读取它。`}>
        <ImportButton label="带入战略 KPI" count={fromKpis.length} readOnly={readOnly} onClick={() => setRows([...rows, ...fromKpis])} />
        {!readOnly ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setYears([...years, (years.at(-1) ?? projectYear) + 1])} disabled={years.length >= 6}>
              <Plus /> 加一年
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setYears(years.slice(0, -1))} disabled={years.length <= 3}>
              <Minus /> 减一年
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setYears(defaultBreakdownYears(projectYear))}>
              <RotateCcw /> 恢复前三后一
            </Button>
            <AddButton label="添加指标" onClick={() => setRows([...rows, breakdownRow()])} />
          </>
        ) : null}
      </EditorToolbar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="min-w-36 px-2 py-2 text-left font-semibold">战略主题 / 要点</th>
              <th className="min-w-36 px-2 py-2 text-left font-semibold">战略 KPI</th>
              <th className="min-w-20 px-2 py-2 text-left font-semibold">单位</th>
              {years.map((year, i) => (
                <th key={`${year}-${i}`} className={cn("min-w-24 px-2 py-2 text-left font-semibold", i === 0 && "text-brand")}>
                  {readOnly ? (
                    `${year} 年`
                  ) : (
                    <input
                      aria-label={`第 ${i + 1} 个年度`}
                      type="number"
                      className="w-20 rounded-md border bg-background px-2 py-1 text-xs"
                      value={year}
                      onChange={(e) => setYears(years.map((y, j) => (j === i ? Number(e.target.value) : y)))}
                    />
                  )}
                  {i === 0 ? <div className="text-[10px] font-normal">本年度目标</div> : null}
                </th>
              ))}
              {REFERENCE_COLUMNS.map((c) => (
                <th key={c.key} className="min-w-24 px-2 py-2 text-left font-semibold" title={c.hint}>
                  {c.label}
                </th>
              ))}
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={years.length + 7} className="px-4 py-8 text-center text-muted-foreground">
                  还没有要分解的战略 KPI
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const label = row.name || "战略 KPI";
                return (
                  <tr data-anchor={row.id} key={row.id} className={cn("border-t align-top", invalid.has(row.id) && "bg-destructive/5")}>
                    <td className="px-1 py-1">
                      <TextCell label={`${label} 战略主题`} value={row.theme} onChange={(theme) => setRows(patchById(rows, row.id, { theme }))} readOnly={readOnly} />
                    </td>
                    <td className="px-1 py-1">
                      <TextCell label="战略 KPI" value={row.name} onChange={(name) => setRows(patchById(rows, row.id, { name }))} readOnly={readOnly} />
                    </td>
                    <td className="px-1 py-1">
                      <TextCell label={`${label} 单位`} value={row.unit} onChange={(unit) => setRows(patchById(rows, row.id, { unit }))} readOnly={readOnly} />
                    </td>
                    {years.map((year, i) => (
                      <td key={`${year}-${i}`} className="px-1 py-1">
                        <TextCell
                          label={`${label} ${year} 年`}
                          placeholder={i === 0 ? "必填" : "待补"}
                          value={row.values?.[String(year)] ?? ""}
                          onChange={(v) => setRows(patchById(rows, row.id, { values: { ...row.values, [String(year)]: v } }))}
                          readOnly={readOnly}
                          invalid={i === 0 && invalid.has(row.id) && !(row.values?.[String(year)] ?? "").trim()}
                        />
                      </td>
                    ))}
                    {REFERENCE_COLUMNS.map((c) => (
                      <td key={c.key} className="px-1 py-1">
                        <TextCell
                          label={`${label} ${c.label}`}
                          value={row[c.key]}
                          onChange={(v) => setRows(patchById(rows, row.id, { [c.key]: v }))}
                          readOnly={readOnly}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <RowActions
                        label={label}
                        readOnly={readOnly}
                        onRemove={() => setRows(removeById(rows, row.id))}
                        onMove={(delta) => setRows(moveById(rows, row.id, delta))}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
