import {
  IPOOC_STAGES,
  type IpoocDesign,
  type IpoocRow,
  type IpoocSheet,
  type IpoocStage,
  type Issue,
  SMART_CHECKS,
  type StrategyLogic,
  emptyIpoocSheet,
  tacticsFromLogic,
} from "@dingze/shared";

import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, RowActions, TextCell } from "./kit";

type Props = {
  value: IpoocDesign;
  onChange: (next: IpoocDesign) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S1-03"?: StrategyLogic };
};

const COLUMNS: { key: keyof IpoocRow; label: string; width: string }[] = [
  { key: "elements", label: "关键要素拆解", width: "min-w-48" },
  { key: "indicator", label: "指标名", width: "min-w-36" },
  { key: "formula", label: "计算公式", width: "min-w-40" },
  { key: "target", label: "目标值", width: "min-w-24" },
  { key: "source", label: "数据来源", width: "min-w-28" },
  { key: "frequency", label: "考核频率", width: "min-w-24" },
];

/** S1-04 (表 2-8, P1): one IPOOC sheet per core strategy theme, then SMART checks. */
export function IpoocEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const sheets = value.sheets ?? [];
  const tactics = tacticsFromLogic(upstream["S1-03"]);
  const unused = tactics.filter((t) => !sheets.some((s) => s.strategy.trim() === t));
  const setSheet = (id: string, patch: Partial<IpoocSheet>) => onChange({ sheets: patchById(sheets, id, patch) });

  return (
    <section aria-label="IPOOC 指标设计表" className="flex flex-col gap-4">
      <EditorToolbar hint="选定需要拆解的关键策略，按投入、过程、产出、结果、成本设计指标；本书约定 C = Cost。">
        {!readOnly ? (
          <>
            {unused.length ? (
              <NativeSelect
                aria-label="从逻辑表选择关键策略"
                value=""
                onChange={(e) => e.target.value && onChange({ sheets: [...sheets, emptyIpoocSheet(e.target.value)] })}
              >
                <NativeSelectOption value="">＋ 从逻辑表选择关键策略…</NativeSelectOption>
                {unused.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {t}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}
            <AddButton label="添加主题" onClick={() => onChange({ sheets: [...sheets, emptyIpoocSheet()] })} />
          </>
        ) : null}
      </EditorToolbar>

      {sheets.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          还没有选择要拆解的关键策略。IPOOC 为选做：策略已足够明确时可以跳过。
        </p>
      ) : null}

      {sheets.map((sheet, index) => (
        <div data-anchor={sheet.id} key={sheet.id} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", invalid.has(sheet.id) && "border-destructive/40")}>
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
              <TextCell
                label={`主题 ${index + 1} 关键策略`}
                placeholder="关键策略"
                value={sheet.strategy}
                onChange={(strategy) => setSheet(sheet.id, { strategy })}
                readOnly={readOnly}
                invalid={invalid.has(sheet.id) && !sheet.strategy.trim()}
              />
              <TextCell label="时间周期" placeholder="时间周期，如 2026 年度" value={sheet.period} onChange={(period) => setSheet(sheet.id, { period })} readOnly={readOnly} />
              <TextCell label="责任部门" placeholder="责任部门" value={sheet.ownerDept} onChange={(ownerDept) => setSheet(sheet.id, { ownerDept })} readOnly={readOnly} />
            </div>
            <RowActions label={sheet.strategy || `主题 ${index + 1}`} readOnly={readOnly} onRemove={() => onChange({ sheets: removeById(sheets, sheet.id) })} onMove={(delta) => onChange({ sheets: moveById(sheets, sheet.id, delta) })} />
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="w-28 px-2 py-2 text-left font-semibold">IPOOC 环节</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {IPOOC_STAGES.map((stage) => {
                  const row = sheet.rows?.[stage.key];
                  const setCell = (key: keyof IpoocRow, v: string) =>
                    setSheet(sheet.id, { rows: { ...sheet.rows, [stage.key as IpoocStage]: { ...row, [key]: v } } });
                  return (
                    <tr key={stage.key} className="border-t align-top">
                      <th scope="row" className="px-2 py-2 text-left">
                        <div className="font-semibold text-brand">{stage.label}</div>
                        <div className="text-[11px] font-normal text-muted-foreground">{stage.dimensions}</div>
                      </th>
                      {COLUMNS.map((c) => (
                        <td key={c.key} className="px-1 py-1">
                          <TextCell
                            label={`${stage.label} ${c.label}`}
                            placeholder={c.key === "elements" ? stage.hint : ""}
                            multiline={c.key === "elements"}
                            value={row?.[c.key] ?? ""}
                            onChange={(v) => setCell(c.key, v)}
                            readOnly={readOnly}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">SMART 验证</legend>
            {SMART_CHECKS.map((check) => (
              <label key={check.key} className="flex items-center gap-2">
                <Checkbox
                  checked={!!sheet.smart?.[check.key]}
                  disabled={readOnly}
                  onCheckedChange={(checked) => setSheet(sheet.id, { smart: { ...sheet.smart, [check.key]: checked === true } })}
                />
                {check.label}
              </label>
            ))}
          </fieldset>
        </div>
      ))}
    </section>
  );
}
