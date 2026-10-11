import { Map as MapIcon, Network, Table2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

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

import { FIGURE_3_7, type Figure37Item } from "@/lib/dingze/figure-3-7";

import { FIND_PATH_STEPS, Figure37Card, FindPathSteps } from "./find-path";
import { AddButton, EditorToolbar, RowActions, TextCell } from "./kit";
import { MapDiagram } from "./map-diagram";
import { type TreeConfig, TreeMindMap } from "./tree-editor";

/** A theme as a map node: `goalId` is borrowed for the layer, the theme's own goal kept aside. */
type ThemeNode = Omit<DecodeTheme, "goalId"> & { parentId: string | null; level: number; goalId: string | null; themeGoalId: string | null };
type View = "mind" | "table" | "diagram";

function rememberedView(): View {
  try {
    const v = window.localStorage.getItem("dingze:view:S2-01");
    return v === "table" || v === "diagram" ? v : "mind";
  } catch {
    return "mind";
  }
}

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
  // 子步骤 1–4 default to the 思维导图; the choice is remembered per person.
  const [view, setViewState] = useState<View>(rememberedView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem("dingze:view:S2-01", v);
    } catch {
      // Not remembered in private mode.
    }
  };
  const [params] = useSearchParams();
  const [sub, setSub] = useState(() => Math.min(4, Math.max(1, Number(params.get("sub")) || 1)));
  const pick = (no: number) => {
    setSub(no);
    const key = FIND_PATH_STEPS[no - 1]?.perspective;
    window.setTimeout(() => document.querySelector(`[data-mm-root="${key}"], [data-perspective="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  useEffect(() => {
    if (params.get("sub")) pick(Math.min(4, Math.max(1, Number(params.get("sub")) || 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const invalid = errorAnchors(issues);
  const themes = value.themes ?? [];
  const goals = targetsOf(upstream["S2-03"])?.goals ?? [];
  const gap = value.valueGap ?? { target: "", baseline: "", gap: "" };
  const setThemes = (next: DecodeTheme[]) => onChange({ ...value, valueGap: gap, themes: next });
  const setTheme = (id: string, patch: Partial<DecodeTheme>) => setThemes(patchById(themes, id, patch));
  const removeTheme = (id: string) =>
    setThemes(removeById(themes, id).map((t) => ({ ...t, supports: (t.supports ?? []).filter((s) => s !== id) })));

  // The map view treats each layer as a root and its themes as first-level nodes: moving a
  // theme to another root changes its layer; links that no longer point upward are dropped.
  const cfg: TreeConfig<ThemeNode> = useMemo(
    () => ({
      nodes: themes.map((t) => ({ ...t, parentId: null, level: 1, goalId: t.perspective, themeGoalId: t.goalId ?? null })),
      setNodes: (next) => {
        const back: DecodeTheme[] = next.map((n) => {
          const perspective = (n.goalId ?? n.perspective) as Perspective;
          return { id: n.id, perspective, category: n.category, title: n.title, metric: n.metric, value: n.value, supports: n.supports ?? [], goalId: perspective === "financial" ? n.themeGoalId : null };
        });
        const layer = new Map(back.map((t) => [t.id, t.perspective]));
        setThemes(back.map((t) => ({ ...t, supports: (t.supports ?? []).filter((s) => layer.has(s) && RANK[layer.get(s)!] > RANK[t.perspective]) })));
      },
      make: (p) => {
        const layer = ((p.goalId as Perspective) ?? "financial") as Perspective;
        return { ...emptyTheme(layer), ...p, perspective: layer, parentId: null, level: 1, goalId: layer, themeGoalId: null } as ThemeNode;
      },
      maxLevel: 1,
      title: (n) => n.title,
      copyForSplit: (n) => ({ title: n.title ? `${n.title}（拆分）` : "", category: n.category, metric: n.metric, goalId: n.goalId }),
      combine: (keep, gone) => ({ title: [keep.title, gone.title].filter(Boolean).join("、"), supports: [...new Set([...(keep.supports ?? []), ...(gone.supports ?? [])])] }),
      roots: PERSPECTIVES.map((p) => ({ id: p.key, label: p.label })),
      levelWord: () => "战略主题",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themes, value],
  );
  const categoryLabel = (t: DecodeTheme) => DECODE_CATEGORIES[t.perspective].find((c) => c.key === t.category)?.label;
  const figureUsed: Record<string, number[]> = {};
  const financial = themes.filter((t) => t.perspective === "financial");
  for (const s of FIGURE_3_7) for (const g of s.groups) for (const item of g.items) {
    const nos = financial.flatMap((t, i) => (t.category === item.decodeCategory ? [i + 1] : []));
    if (nos.length) figureUsed[item.key] = nos;
  }
  const pickFigure = (item: Figure37Item) => setThemes([...themes, emptyTheme("financial", { category: item.decodeCategory })]);

  return (
    <section aria-label="年度战略解码地图" className="flex flex-col gap-4">
      <FindPathSteps active={sub} map={value} paths={upstream["S2-03"]} onPick={pick} />
      <EditorToolbar hint="自上而下找差距、定主张、选流程、补资产；每个下层主题都要说明支撑哪个上层主题。完成后在 S2-03 子步骤 5 一键导入路径系统表。思维导图和表格是同一份数据。">
        <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as View)} variant="outline" size="sm" aria-label="展示方式">
          <ToggleGroupItem value="mind" title="思维导图：共创、发散、调整（拖到别的层面、上下移、拆分合并）">
            <Network /> 思维导图 <span className="text-[10px] opacity-70">S2-01</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="table" title="表格：逐项填类别、指标和支撑关系">
            <Table2 /> 表格
          </ToggleGroupItem>
          <ToggleGroupItem value="diagram" title="解码地图版式：汇报用的四层泳道图，只读预览（书中图 3-3）">
            <MapIcon /> 解码地图版式 <span className="text-[10px] opacity-70">图 3-3</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </EditorToolbar>

      {view === "diagram" ? (
        <MapDiagram map={asStrategyMap(value)} label="年度战略解码地图" />
      ) : view === "mind" ? (
        <TreeMindMap
          cfg={cfg}
          readOnly={readOnly}
          invalid={invalid}
          fields={[
            { key: "title", label: "战略主题", placeholder: "如“拓展物流车队客户”" },
            { key: "metric", label: "衡量指标" },
            { key: "value", label: "指标值" },
          ]}
          patch={(id, p) => setTheme(id, p as Partial<DecodeTheme>)}
          detail={(n) => {
            const up = (n.supports ?? []).map((id) => themes.find((x) => x.id === id)?.title).filter(Boolean);
            return [[n.metric, n.value].filter(Boolean).join(" ") || "（未填指标）", up.length ? `支撑：${up.join("、")}` : ""].filter(Boolean).join(" · ");
          }}
          tag={(n) => categoryLabel(n as unknown as DecodeTheme)}
          rootCards={PERSPECTIVES.map((p, i) => ({
            root: { id: p.key, label: p.label, sub: p.key === "financial" && gap.gap ? `差距 ${gap.gap}` : FIND_PATH_STEPS[i]?.title },
            badge: `子步骤 ${i + 1}${themes.some((t) => t.perspective === p.key) ? "" : " · 待开始"}`,
            nodes: cfg.nodes.filter((n) => n.goalId === p.key),
            onAdd: () => setThemes([...themes, emptyTheme(p.key)]),
          }))}
          emptyHint="还没有主题"
          side={sub === 1 && !readOnly ? <Figure37Card defaultOpen={!financial.length} used={figureUsed} onPick={pickFigure} readOnly={readOnly} hint="点一项 = 在财务层面加一个主题（类别已选好）" /> : undefined}
        />
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
              <div key={p.key} data-perspective={p.key} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
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
