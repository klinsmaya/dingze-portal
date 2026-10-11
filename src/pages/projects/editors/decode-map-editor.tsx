import { Network, Table2, X } from "lucide-react";
import { useState } from "react";

import {
  type GoalPathSystem,
  DECODE_CATEGORIES,
  type DecodeMap,
  type DecodeTheme,
  type Issue,
  PERSPECTIVES,
  type Perspective,
  type StrategyMap,
  emptyTheme,
  targetsOf,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorAnchors, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, RowActions, TextCell } from "./kit";
import { MapDiagram } from "./map-diagram";

type Props = {
  value: DecodeMap;
  onChange: (next: DecodeMap) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S2-03"?: GoalPathSystem };
};

const RANK: Record<Perspective, number> = { learning: 0, process: 1, customer: 2, financial: 3 };

const STEPS: Record<Perspective, string> = {
  financial: "子步骤 1 · 确定股东价值差距：从增收（新客户、老客户、新产品、新市场、渠道、价格、降低流失）与降本两条线拆差距",
  customer: "子步骤 2 · 调整客户价值主张：客户为什么选我们",
  process: "子步骤 3 · 确定关键价值创造流程：运营、客户管理、创新、法规与社会四类流程",
  learning: "子步骤 4 · 提升战略资产准备度：人力资本、信息资本、组织资本",
};

/** The decode map as a diagram: themes are nodes, “支撑” relations are causal links. */
function asStrategyMap(map: DecodeMap): StrategyMap {
  const themes = map.themes ?? [];
  return {
    objectives: themes.map((t) => ({ id: t.id, perspective: t.perspective, title: t.title, note: t.metric })),
    links: themes.flatMap((t) => (t.supports ?? []).map((to) => ({ id: `${t.id}-${to}`, from: t.id, to, kind: "cause" as const }))),
  };
}

/** S2-01: four layers top-down (子步骤 1–4); 子步骤 5 imports the themes into S2-03. */
export function DecodeMapEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const [view, setView] = useState<"table" | "diagram">("table");
  const invalid = errorAnchors(issues);
  const themes = value.themes ?? [];
  const goals = targetsOf(upstream["S2-03"])?.goals ?? [];
  const gap = value.valueGap ?? { target: "", baseline: "", gap: "" };
  const setThemes = (next: DecodeTheme[]) => onChange({ ...value, valueGap: gap, themes: next });
  const setTheme = (id: string, patch: Partial<DecodeTheme>) => setThemes(patchById(themes, id, patch));
  const removeTheme = (id: string) =>
    setThemes(removeById(themes, id).map((t) => ({ ...t, supports: (t.supports ?? []).filter((s) => s !== id) })));

  return (
    <section aria-label="年度战略解码地图" className="flex flex-col gap-4">
      <EditorToolbar hint="自上而下找差距、定主张、选流程、补资产；每个下层主题都要说明支撑哪个上层主题。完成后在 S2-03 一键导入路径系统表。">
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
        <MapDiagram map={asStrategyMap(value)} label="年度战略解码地图" />
      ) : (
        <>
          <div data-anchor={"valueGap"} className={cn("grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3", invalid.has("valueGap") && "border-destructive/40")}>
            <div className="text-sm font-semibold text-brand md:col-span-3">股东价值差距</div>
            {(
              [
                ["target", "年度目标", "如 售气量 1100 万方"],
                ["baseline", "现状 / 自然增长", "如 不做改变能到 900 万方"],
                ["gap", "差距", "如 200 万方，需要新路径填补"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div key={key} className="flex flex-col gap-1">
                <div className="text-xs text-muted-foreground">{label}</div>
                <TextCell
                  label={label}
                  placeholder={placeholder}
                  value={gap[key]}
                  onChange={(v) => onChange({ ...value, valueGap: { ...gap, [key]: v } })}
                  readOnly={readOnly}
                  invalid={key === "gap" && invalid.has("valueGap")}
                />
              </div>
            ))}
          </div>

          {PERSPECTIVES.map((p) => {
            const items = themes.filter((t) => t.perspective === p.key);
            const upper = themes.filter((t) => RANK[t.perspective] > RANK[p.key]);
            return (
              <div key={p.key} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-heading text-base font-bold text-brand">{p.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{STEPS[p.key]}</span>
                  </div>
                  {!readOnly ? <AddButton label={`添加${p.label}主题`} onClick={() => setThemes([...themes, emptyTheme(p.key)])} /> : null}
                </div>
                {items.length === 0 ? <p className="text-xs text-muted-foreground">还没有主题</p> : null}
                {items.map((t) => (
                  <div data-anchor={t.id} key={t.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", invalid.has(t.id) && "border-destructive/40 bg-destructive/5")}>
                    <div className="flex items-start gap-2">
                      <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[10rem_1.4fr_1fr_0.8fr]">
                        <NativeSelect
                          size="sm"
                          aria-label="类别"
                          className="w-full"
                          value={t.category}
                          disabled={readOnly}
                          onChange={(e) => setTheme(t.id, { category: e.target.value })}
                        >
                          <NativeSelectOption value="">类别（选填）</NativeSelectOption>
                          {DECODE_CATEGORIES[p.key].map((c) => (
                            <NativeSelectOption key={c.key} value={c.key}>
                              {c.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        <TextCell label={`${p.label}主题`} placeholder="战略主题，如“拓展物流车队客户”" value={t.title} onChange={(title) => setTheme(t.id, { title })} readOnly={readOnly} />
                        <TextCell label={`${t.title || p.label + "主题"} 衡量指标`} placeholder="衡量指标" value={t.metric} onChange={(metric) => setTheme(t.id, { metric })} readOnly={readOnly} />
                        <TextCell label={`${t.title || p.label + "主题"} 指标值`} placeholder="指标值" value={t.value} onChange={(v) => setTheme(t.id, { value: v })} readOnly={readOnly} />
                      </div>
                      <RowActions label={t.title || `${p.label}主题`} readOnly={readOnly} onRemove={() => removeTheme(t.id)} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {p.key === "financial" ? (
                        <>
                          <span className="text-muted-foreground">弥补哪个年度目标的差距</span>
                          <NativeSelect
                            size="sm"
                            aria-label={`${t.title || "财务主题"} 对应年度目标`}
                            value={t.goalId ?? ""}
                            disabled={readOnly}
                            onChange={(e) => setTheme(t.id, { goalId: e.target.value || null })}
                          >
                            <NativeSelectOption value="">选择年度目标…</NativeSelectOption>
                            {goals.map((g) => (
                              <NativeSelectOption key={g.id} value={g.id}>
                                {g.task || g.metric} {g.value}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">支撑</span>
                          {(t.supports ?? []).map((id) => {
                            const target = themes.find((x) => x.id === id);
                            return (
                              <Badge key={id} variant="secondary" className="gap-1 font-normal">
                                {target?.title || "（已删除）"}
                                {!readOnly ? (
                                  <button
                                    type="button"
                                    aria-label={`取消支撑 ${target?.title ?? ""}`}
                                    onClick={() => setTheme(t.id, { supports: (t.supports ?? []).filter((s) => s !== id) })}
                                  >
                                    <X className="size-3" />
                                  </button>
                                ) : null}
                              </Badge>
                            );
                          })}
                          {!readOnly ? (
                            <NativeSelect
                              size="sm"
                              aria-label={`${t.title || "主题"} 支撑的上层主题`}
                              value=""
                              onChange={(e) => e.target.value && setTheme(t.id, { supports: [...(t.supports ?? []), e.target.value] })}
                            >
                              <NativeSelectOption value="">＋ 选择上层主题…</NativeSelectOption>
                              {upper
                                .filter((u) => !(t.supports ?? []).includes(u.id))
                                .map((u) => (
                                  <NativeSelectOption key={u.id} value={u.id}>
                                    {PERSPECTIVES.find((x) => x.key === u.perspective)?.label} · {u.title || "（未命名）"}
                                  </NativeSelectOption>
                                ))}
                            </NativeSelect>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
