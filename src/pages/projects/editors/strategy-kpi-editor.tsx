import {
  type Issue,
  type KpiScreening,
  type StrategyKpi,
  type StrategyKpiTable,
  emptyKpi,
  kpisFromScreening,
} from "@dingze/shared";

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

const COLUMNS: { key: keyof StrategyKpi; label: string; placeholder: string; width: string; multiline?: boolean }[] = [
  { key: "theme", label: "战略主题 / 要点", placeholder: "对应的战略或策略", width: "min-w-36" },
  { key: "name", label: "战略 KPI", placeholder: "指标名称", width: "min-w-36" },
  { key: "definition", label: "口径 / 计算公式", placeholder: "统计口径或计算公式", width: "min-w-52", multiline: true },
  { key: "unit", label: "单位", placeholder: "如 亿元、%", width: "min-w-20" },
  { key: "source", label: "数据来源", placeholder: "系统或报表", width: "min-w-32" },
  { key: "period", label: "统计周期", placeholder: "月 / 季 / 年", width: "min-w-24" },
  { key: "owner", label: "责任部门", placeholder: "责任部门", width: "min-w-28" },
];

/** S1-06: the screened strategy KPIs with their definition, data source and period. */
export function StrategyKpiEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const kpis = value.kpis ?? [];
  const fromScreening = kpisFromScreening(upstream["S1-05"], kpis);
  const set = (next: StrategyKpi[]) => onChange({ kpis: next });

  return (
    <section aria-label="战略 KPI 表" className="flex flex-col gap-4">
      <EditorToolbar hint="每个战略 KPI 都要写清口径、数据来源和统计周期，书中建议不超过 6 个。未做筛选表时可直接按逻辑表录入。">
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
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      <TextCell
                        label={`${kpi.name || "战略 KPI"} ${c.label}`}
                        placeholder={c.placeholder}
                        multiline={c.multiline}
                        value={String(kpi[c.key] ?? "")}
                        onChange={(v) => set(patchById(kpis, kpi.id, { [c.key]: v }))}
                        readOnly={readOnly}
                      />
                    </td>
                  ))}
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
