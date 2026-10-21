import { useState } from "react";

import {
  type DeptUndertakingTable,
  type Issue,
  type Scorecard,
  type ScorecardItem,
  type ScorecardSet,
  cardWeight,
  emptyScorecardItem,
  scorecardsFromUndertakings,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: ScorecardSet;
  onChange: (next: ScorecardSet) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S2-05"?: DeptUndertakingTable };
};

const COLUMNS: { key: keyof ScorecardItem; label: string; width: string; multiline?: boolean }[] = [
  { key: "task", label: "关键任务", width: "min-w-40" },
  { key: "metric", label: "衡量指标", width: "min-w-32" },
  { key: "definition", label: "指标定义", width: "min-w-44", multiline: true },
  { key: "floor", label: "保底值", width: "min-w-24" },
  { key: "target", label: "力争值", width: "min-w-24" },
  { key: "scoring", label: "评分方法", width: "min-w-36", multiline: true },
  { key: "source", label: "数据来源", width: "min-w-28" },
];

/** S2-07 (表 3-21): one scorecard per department; weights add up to 100. */
export function ScorecardEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const cards = value.cards ?? [];
  const [tab, setTab] = useState<string | null>(null);
  const seeded = scorecardsFromUndertakings(upstream["S2-05"], { cards });
  const newItems = seeded.cards.reduce((n, c) => n + c.items.length, 0) - cards.reduce((n, c) => n + c.items.length, 0);
  const active = tab && cards.some((c) => c.deptId === tab) ? tab : cards[0]?.deptId;
  const setCard = (deptId: string, patch: Partial<Scorecard>) => onChange({ cards: cards.map((c) => (c.deptId === deptId ? { ...c, ...patch } : c)) });

  return (
    <section aria-label="绩效计分卡" className="flex flex-col gap-4">
      <EditorToolbar hint="把部门承接的 A / R 指标挂进计分卡：写清指标定义、保底值 / 力争值、权重和评分方法。完成情况与评分在后续范围。">
        <ImportButton label="带入部门承接项" count={newItems} readOnly={readOnly} onClick={() => onChange(seeded)} />
      </EditorToolbar>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">还没有部门计分卡</p>
      ) : (
        <Tabs value={active} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="flex-wrap">
            {cards.map((c) => {
              const total = cardWeight(c);
              return (
                <TabsTrigger data-anchor={c.deptId} key={c.deptId} value={c.deptId} className={cn(invalid.has(c.deptId) && "text-destructive")}>
                  {c.deptName}
                  <Badge variant={total === 100 ? "outline" : "destructive"} className="ml-1 tabular-nums">
                    {total}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {cards.map((card) => {
            const items = card.items ?? [];
            const total = cardWeight(card);
            return (
              <TabsContent key={card.deptId} value={card.deptId} className="flex flex-col gap-2 pt-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    权重合计 <span className={cn("font-semibold tabular-nums", total === 100 ? "text-status-done-foreground" : "text-destructive")}>{total}</span> / 100
                  </div>
                  {!readOnly ? <AddButton label="添加指标" onClick={() => setCard(card.deptId, { items: [...items, emptyScorecardItem()] })} /> : null}
                </div>
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground">
                      <tr>
                        {COLUMNS.slice(0, 5).map((c) => (
                          <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                            {c.label}
                          </th>
                        ))}
                        <th className="min-w-20 px-2 py-2 text-left font-semibold">权重</th>
                        {COLUMNS.slice(5).map((c) => (
                          <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                            {c.label}
                          </th>
                        ))}
                        <th className="w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const cell = (c: (typeof COLUMNS)[number]) => (
                          <td key={c.key} className="px-1 py-1">
                            <TextCell
                              label={`${item.metric || "指标"} ${c.label}`}
                              multiline={c.multiline}
                              value={(item[c.key] as string) ?? ""}
                              onChange={(v) => setCard(card.deptId, { items: patchById(items, item.id, { [c.key]: v }) })}
                              readOnly={readOnly}
                            />
                          </td>
                        );
                        return (
                          <tr data-anchor={item.id} key={item.id} className={cn("border-t align-top", invalid.has(item.id) && "bg-destructive/5")}>
                            {COLUMNS.slice(0, 5).map(cell)}
                            <td className="px-1 py-1">
                              <Input
                                aria-label={`${item.metric || "指标"} 权重`}
                                type="number"
                                min={0}
                                max={100}
                                className="min-w-16"
                                value={item.weight ?? ""}
                                readOnly={readOnly}
                                onChange={(e) =>
                                  setCard(card.deptId, { items: patchById(items, item.id, { weight: e.target.value === "" ? null : Number(e.target.value) }) })
                                }
                              />
                            </td>
                            {COLUMNS.slice(5).map(cell)}
                            <td className="px-1 py-1">
                              <RowActions
                                label={item.metric || "指标"}
                                readOnly={readOnly}
                                onRemove={() => setCard(card.deptId, { items: removeById(items, item.id) })}
                                onMove={(delta) => setCard(card.deptId, { items: moveById(items, item.id, delta) })}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
}
