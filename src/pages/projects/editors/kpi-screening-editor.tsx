import { ArrowDownWideNarrow } from "lucide-react";

import {
  type IpoocDesign,
  type Issue,
  type KpiCandidate,
  type KpiScreening,
  MAX_STRATEGY_KPIS,
  SCREEN_DIMENSIONS,
  type ScreenDimension,
  candidateTotal,
  candidatesFromIpooc,
  emptyCandidate,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: KpiScreening;
  onChange: (next: KpiScreening) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S1-04"?: IpoocDesign };
};

/** S1-05 (表 2-10/2-11, P1): score each candidate 1–5 on four aspects, then keep or drop. */
export function KpiScreeningEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const candidates = value.candidates ?? [];
  const fromIpooc = candidatesFromIpooc(upstream["S1-04"], candidates);
  const kept = candidates.filter((c) => c.keep === true).length;
  const set = (next: KpiCandidate[]) => onChange({ candidates: next });
  const setScore = (c: KpiCandidate, key: ScreenDimension, score: string) =>
    set(patchById(candidates, c.id, { scores: { ...c.scores, [key]: score ? Number(score) : null } }));
  const sortByTotal = () => set([...candidates].sort((a, b) => (candidateTotal(b) ?? -1) - (candidateTotal(a) ?? -1)));

  return (
    <section aria-label="KPI 筛选评价表" className="flex flex-col gap-4">
      <EditorToolbar
        hint={
          <>
            四个方面各打 1—5 分，合计排序后给出保留 / 剔除结论。已保留{" "}
            <Badge variant={kept > MAX_STRATEGY_KPIS ? "destructive" : "outline"}>{kept}</Badge> 个，建议不超过 {MAX_STRATEGY_KPIS} 个。
          </>
        }
      >
        <ImportButton label="带入 IPOOC 指标" count={fromIpooc.length} readOnly={readOnly} onClick={() => set([...candidates, ...fromIpooc])} />
        {!readOnly && candidates.length > 1 ? (
          <Button type="button" variant="outline" size="sm" onClick={sortByTotal}>
            <ArrowDownWideNarrow /> 按合计排序
          </Button>
        ) : null}
        {!readOnly ? <AddButton label="添加候选指标" onClick={() => set([...candidates, emptyCandidate()])} /> : null}
      </EditorToolbar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="min-w-44 px-2 py-2 text-left font-semibold">候选指标</th>
              {SCREEN_DIMENSIONS.map((d) => (
                <th key={d.key} className="px-2 py-2 text-center font-semibold" title={d.hint}>
                  {d.label}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-semibold">合计</th>
              <th className="px-2 py-2 text-left font-semibold">结论</th>
              <th className="min-w-40 px-2 py-2 text-left font-semibold">理由</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={SCREEN_DIMENSIONS.length + 5} className="px-4 py-8 text-center text-muted-foreground">
                  还没有候选指标
                </td>
              </tr>
            ) : (
              candidates.map((c) => {
                const total = candidateTotal(c);
                return (
                  <tr data-anchor={c.id} key={c.id} className={cn("border-t align-top", invalid.has(c.id) && "bg-destructive/5", c.keep === false && "text-muted-foreground")}>
                    <td className="px-1 py-1">
                      <TextCell label="候选指标" value={c.name} onChange={(name) => set(patchById(candidates, c.id, { name }))} readOnly={readOnly} />
                      {c.origin ? <div className="px-1 pt-1 text-[11px] text-muted-foreground">{c.origin}</div> : null}
                    </td>
                    {SCREEN_DIMENSIONS.map((d) => (
                      <td key={d.key} className="px-1 py-1 text-center">
                        <NativeSelect
                          size="sm"
                          aria-label={`${c.name || "候选指标"} ${d.label}`}
                          value={c.scores?.[d.key] ?? ""}
                          disabled={readOnly}
                          onChange={(e) => setScore(c, d.key, e.target.value)}
                        >
                          <NativeSelectOption value="">—</NativeSelectOption>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <NativeSelectOption key={n} value={n}>
                              {n}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-semibold tabular-nums">{total ?? "—"}</td>
                    <td className="px-1 py-1">
                      <NativeSelect
                        size="sm"
                        aria-label={`${c.name || "候选指标"} 结论`}
                        value={c.keep === null || c.keep === undefined ? "" : c.keep ? "keep" : "drop"}
                        disabled={readOnly}
                        onChange={(e) => set(patchById(candidates, c.id, { keep: e.target.value === "" ? null : e.target.value === "keep" }))}
                      >
                        <NativeSelectOption value="">未决</NativeSelectOption>
                        <NativeSelectOption value="keep">保留</NativeSelectOption>
                        <NativeSelectOption value="drop">剔除</NativeSelectOption>
                      </NativeSelect>
                    </td>
                    <td className="px-1 py-1">
                      <TextCell label="理由" value={c.reason} onChange={(reason) => set(patchById(candidates, c.id, { reason }))} readOnly={readOnly} />
                    </td>
                    <td className="px-1 py-1">
                      <RowActions label={c.name || "候选指标"} readOnly={readOnly} onRemove={() => set(removeById(candidates, c.id))} onMove={(delta) => set(moveById(candidates, c.id, delta))} />
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
