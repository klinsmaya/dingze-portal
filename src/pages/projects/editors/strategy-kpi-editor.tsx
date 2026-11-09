import {
  type Issue,
  type KpiScreening,
  type StrategyKpi,
  type StrategyKpiTable,
  emptyKpi,
  kpisFromScreening,
} from "@dingze/shared";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: StrategyKpiTable;
  onChange: (next: StrategyKpiTable) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S1-05"?: KpiScreening };
};

/** 考核周期的常用选法；已有数据里别的写法照样显示。 */
const PERIOD_OPTIONS = ["月考", "季考", "半年考", "年考"];

// 指标值和单位在 S1-07 逐年目标里填（2026-11 会议纪要：数值自带单位，去掉单位列）。
const COLUMNS: { key: keyof StrategyKpi; label: string; placeholder: string; width: string; multiline?: boolean; options?: string[] }[] = [
  { key: "theme", label: "战略主题 / 要点", placeholder: "", width: "min-w-28" },
  { key: "name", label: "战略 KPI", placeholder: "", width: "min-w-28" },
  { key: "definition", label: "口径 / 计算公式", placeholder: "", width: "min-w-44", multiline: true },
  { key: "source", label: "数据来源", placeholder: "", width: "min-w-24" },
  { key: "period", label: "考核周期", placeholder: "选择", width: "min-w-20", options: PERIOD_OPTIONS },
  { key: "owner", label: "责任部门", placeholder: "", width: "min-w-24" },
];

/** S1-06: the screened strategy KPIs with their definition, data source and period. */
export function StrategyKpiEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const kpis = value.kpis ?? [];
  const fromScreening = kpisFromScreening(upstream["S1-05"], kpis);
  const set = (next: StrategyKpi[]) => onChange({ kpis: next });

  return (
    <section aria-label="战略 KPI 表" className="flex flex-col gap-4">
      <EditorToolbar hint="每个战略 KPI 都要写清口径、数据来源和考核周期，建议不超过 6 个。">
        <ImportButton label="带入筛选保留的指标" count={fromScreening.length} readOnly={readOnly} onClick={() => set([...kpis, ...fromScreening])} />
        {!readOnly ? <AddButton label="添加战略 KPI" onClick={() => set([...kpis, emptyKpi()])} /> : null}
      </EditorToolbar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                  {c.label}
                </th>
              ))}
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {kpis.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                  还没有战略 KPI
                </td>
              </tr>
            ) : (
              kpis.map((kpi) => (
                <tr data-anchor={kpi.id} key={kpi.id} className={cn("border-t align-top", invalid.has(kpi.id) && "bg-destructive/5")}>
                  {COLUMNS.map((c) => {
                    const current = String(kpi[c.key] ?? "");
                    return (
                      <td key={c.key} className="px-1 py-1">
                        {c.options ? (
                          <NativeSelect
                            aria-label={`${kpi.name || "战略 KPI"} ${c.label}`}
                            className="w-full"
                            value={current}
                            disabled={readOnly}
                            onChange={(e) => set(patchById(kpis, kpi.id, { [c.key]: e.target.value }))}
                          >
                            <NativeSelectOption value="">{c.placeholder}</NativeSelectOption>
                            {(current && !c.options.includes(current) ? [current, ...c.options] : c.options).map((o) => (
                              <NativeSelectOption key={o} value={o}>
                                {o}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        ) : (
                          <TextCell
                            label={`${kpi.name || "战略 KPI"} ${c.label}`}
                            placeholder={c.placeholder}
                            multiline={c.multiline}
                            value={current}
                            onChange={(v) => set(patchById(kpis, kpi.id, { [c.key]: v }))}
                            readOnly={readOnly}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1">
                    <RowActions
                      label={kpi.name || "战略 KPI"}
                      readOnly={readOnly}
                      onRemove={() => set(removeById(kpis, kpi.id))}
                      onMove={(delta) => set(moveById(kpis, kpi.id, delta))}
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
