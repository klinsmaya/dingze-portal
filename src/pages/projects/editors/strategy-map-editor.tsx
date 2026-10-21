import { Network, Table2 } from "lucide-react";
import { useState } from "react";

import {
  type Issue,
  type MapLink,
  type MapObjective,
  PERSPECTIVES,
  type Perspective,
  type StrategyContent,
  type StrategyMap,
  newRowId,
  seedStrategyMap,
} from "@dingze/shared";

import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";
import { MapDiagram } from "./map-diagram";

type Props = {
  value: StrategyMap;
  onChange: (next: StrategyMap) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S1-01"?: StrategyContent };
};

const KIND_LABELS = { cause: "纵向因果（支撑上层）", synergy: "横向协同（同层）" } as const;

/** S1-02: the table is the source of truth; the diagram is a view of the same data. */
export function StrategyMapEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const [view, setView] = useState<"table" | "diagram">("table");
  const invalid = errorAnchors(issues);
  const objectives = value.objectives ?? [];
  const links = value.links ?? [];
  const seed = upstream["S1-01"] ? seedStrategyMap(upstream["S1-01"]) : null;

  const setObjectives = (next: MapObjective[]) => onChange({ ...value, objectives: next });
  const setLinks = (next: MapLink[]) => onChange({ ...value, links: next });
  const removeObjective = (id: string) =>
    onChange({ objectives: removeById(objectives, id), links: links.filter((l) => l.from !== id && l.to !== id) });

  return (
    <section aria-label="战略地图" className="flex flex-col gap-4">
      <EditorToolbar hint="按四个层面列出战略目标，再用关系说明下层如何支撑上层、同层如何协同。图与表是同一份数据。">
        {objectives.length === 0 && seed ? (
          <ImportButton label="从战略屋带入目标" count={seed.objectives.length} readOnly={readOnly} onClick={() => onChange(seed)} />
        ) : null}
        <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as "table" | "diagram")} variant="outline" size="sm">
          <ToggleGroupItem value="table">
            <Table2 /> 表格
          </ToggleGroupItem>
          <ToggleGroupItem value="diagram">
            <Network /> 地图
          </ToggleGroupItem>
        </ToggleGroup>
      </EditorToolbar>

      {view === "diagram" ? (
        <MapDiagram map={value} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            {PERSPECTIVES.map((p) => {
              const items = objectives.filter((o) => o.perspective === p.key);
              return (
                <div key={p.key} className="grid border-b last:border-b-0 md:grid-cols-[140px_1fr]">
                  <div className="bg-muted px-3 py-3">
                    <div className="text-sm font-bold text-brand">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground">{p.hint}</div>
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    {items.map((o) => (
                      <div key={o.id} className="flex items-start gap-2">
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr]">
                          <TextCell
                            label={`${p.label}目标`}
                            placeholder="战略目标，如“车用气客户规模领先”"
                            value={o.title}
                            onChange={(title) => setObjectives(patchById(objectives, o.id, { title }))}
                            readOnly={readOnly}
                            anchor={o.id} invalid={invalid.has(o.id)}
                          />
                          <TextCell
                            label={`${p.label}目标说明`}
                            placeholder="说明（选填）"
                            value={o.note}
                            onChange={(note) => setObjectives(patchById(objectives, o.id, { note }))}
                            readOnly={readOnly}
                          />
                        </div>
                        <RowActions label={o.title || `${p.label}目标`} readOnly={readOnly} onRemove={() => removeObjective(o.id)} />
                      </div>
                    ))}
                    {!readOnly ? (
                      <div>
                        <AddButton
                          label={`添加${p.label}目标`}
                          onClick={() =>
                            setObjectives([...objectives, { id: newRowId("o"), perspective: p.key as Perspective, title: "", note: "" }])
                          }
                        />
                      </div>
                    ) : items.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <EditorToolbar hint="纵向因果自下而上（学习与成长 → 内部流程 → 客户 → 财务）；横向协同只连同一层面。">
              {!readOnly ? (
                <AddButton
                  label="添加关系"
                  disabled={objectives.length < 2}
                  onClick={() => setLinks([...links, { id: newRowId("r"), from: "", to: "", kind: "cause" }])}
                />
              ) : null}
            </EditorToolbar>
            {links.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">还没有关系</p>
            ) : (
              <ul className="overflow-hidden rounded-xl border bg-card">
                {links.map((link) => (
                  <li
                    key={link.id}
                    data-anchor={link.id}
                    className={cn(
                      "grid items-center gap-2 border-b px-3 py-2 last:border-b-0 md:grid-cols-[1fr_auto_1fr_auto]",
                      invalid.has(link.id) && "bg-destructive/5"
                    )}
                  >
                    <ObjectiveSelect label="起点目标" objectives={objectives} value={link.from} disabled={readOnly} onChange={(from) => setLinks(patchById(links, link.id, { from }))} />
                    <NativeSelect
                      aria-label="关系类型"
                      value={link.kind}
                      disabled={readOnly}
                      onChange={(e) => setLinks(patchById(links, link.id, { kind: e.target.value as MapLink["kind"] }))}
                    >
                      {Object.entries(KIND_LABELS).map(([k, label]) => (
                        <NativeSelectOption key={k} value={k}>
                          {label} →
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <ObjectiveSelect label="终点目标" objectives={objectives} value={link.to} disabled={readOnly} onChange={(to) => setLinks(patchById(links, link.id, { to }))} />
                    <RowActions label="这条关系" readOnly={readOnly} onRemove={() => setLinks(removeById(links, link.id))} onMove={(delta) => setLinks(moveById(links, link.id, delta))} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ObjectiveSelect({
  label,
  objectives,
  value,
  onChange,
  disabled,
}: {
  label: string;
  objectives: MapObjective[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <NativeSelect aria-label={label} className="w-full" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <NativeSelectOption value="">选择目标…</NativeSelectOption>
      {PERSPECTIVES.map((p) => (
        <NativeSelectOptGroup key={p.key} label={p.label}>
          {objectives
            .filter((o) => o.perspective === p.key)
            .map((o) => (
              <NativeSelectOption key={o.id} value={o.id}>
                {o.title || "（未命名）"}
              </NativeSelectOption>
            ))}
        </NativeSelectOptGroup>
      ))}
    </NativeSelect>
  );
}
