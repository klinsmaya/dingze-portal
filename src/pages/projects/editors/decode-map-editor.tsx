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
  additive,
  emptyTheme,
  parseAmount,
  targetsOf,
  themesFromStrategyMap,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type EditorChrome, useEditorChrome } from "@/pages/projects/components/edit-session";
import { errorAnchors, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { FIGURE_3_7, type Figure37Item } from "@/lib/dingze/figure-3-7";

import { FIND_PATH_STEPS, Figure37Card } from "./find-path";
import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";
import { sumText } from "./path-system-editor";
import { PERSPECTIVE_STYLE } from "./perspective-style";
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
  upstream: { "S2-03"?: GoalPathSystem; "S1-02"?: StrategyMap };
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
  // 子步骤 1–4 come from the URL (?sub=), set by the top bar and the route rail.
  const [params] = useSearchParams();
  const sub = Math.min(4, Math.max(1, Number(params.get("sub")) || 1));
  useEffect(() => {
    const key = FIND_PATH_STEPS[sub - 1]?.perspective;
    const timer = window.setTimeout(() => document.querySelector(`[data-mm-root="${key}"], [data-perspective="${key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => window.clearTimeout(timer);
  }, [sub, view]);
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
  // The map hangs on the annual goal(s).
  const hub =
    goals.length === 1
      ? { id: "goal", label: goals[0].task || goals[0].metric || "年度目标", sub: goals[0].metric, value: goals[0].value }
      : { id: "goal", label: goals.length ? `年度目标（${goals.length} 个）` : "年度目标", sub: goals.length ? goals.map((g) => g.metric).filter(Boolean).join("、") : "定目标后显示" };
  // Financial themes add up to the goal when there is one goal; with several, the sum is only shown.
  const gapTarget = goals.length === 1 ? parseAmount(goals[0].value ?? "") : null;
  const pickFigure = (item: Figure37Item) => setThemes([...themes, emptyTheme("financial", { category: item.decodeCategory })]);

  const baseChrome: EditorChrome = {
    title: "年度战略解码地图",
    chip: view === "diagram" ? "S2-01 · 解码地图版式（图 3-3）" : view === "mind" ? "S2-01 · 思维导图" : "S2-01 · 表格",
    views: [
      { key: "mind", label: "思维导图", icon: <Network className="size-4" /> },
      { key: "table", label: "表格", icon: <Table2 className="size-4" /> },
      { key: "diagram", label: "版式", icon: <MapIcon className="size-4" /> },
    ],
    view,
    setView: (k) => setView(k as View),
  };
  useEditorChrome(baseChrome, view !== "mind");

  return (
    <section aria-label="年度战略解码地图" className="flex flex-col gap-4">
      <EditorToolbar hint="自上而下找差距、定主张、选流程、补资产；每个下层主题都要说明支撑哪个上层主题。完成后在 S2-03 子步骤 5 一键导入路径系统表。思维导图和表格是同一份数据。">
        {upstream["S1-02"] ? (
          <ImportButton label="从战略地图带入目标" count={themesFromStrategyMap(upstream["S1-02"], value).length} readOnly={readOnly} onClick={() => setThemes([...themes, ...themesFromStrategyMap(upstream["S1-02"], value)])} />
        ) : null}
      </EditorToolbar>

      {view === "diagram" ? (
        <MapDiagram map={asStrategyMap(value)} label="年度战略解码地图" />
      ) : view === "mind" ? (
        <TreeMindMap
          chrome={baseChrome}
          cfg={cfg}
          readOnly={readOnly}
          invalid={invalid}
          fields={[
            { key: "title", label: "战略主题", placeholder: "如“拓展物流车队客户”" },
            { key: "metric", label: "衡量指标" },
            { key: "value", label: "指标值" },
          ]}
          patch={(id, p) => setTheme(id, p as Partial<DecodeTheme>)}
          tag={(n) => {
            const up = (n.supports ?? []).map((id) => themes.find((x) => x.id === id)?.title).filter(Boolean);
            return up.length ? `支撑 ${up.join("、")}` : categoryLabel(n as unknown as DecodeTheme);
          }}
          amount={(n) => n.value}
          detail={(n) => n.metric || "（未填指标）"}
          rootCards={[
            {
              // 年度目标 → 四个层面 → 战略主题 (design 10 画面 1).
              root: hub,
              badge: "年度目标",
              nodes: [],
              layers: PERSPECTIVES.map((p, i) => {
                const own = cfg.nodes.filter((n) => n.goalId === p.key);
                const style = PERSPECTIVE_STYLE[p.key];
                const Icon = style.icon;
                const amounts = own.map((n) => parseAmount(n.value));
                const numeric = p.key === "financial" && own.length > 0 && amounts.every((a) => a !== null);
                return {
                  key: p.key,
                  label: p.label,
                  sub: FIND_PATH_STEPS[i]?.title,
                  icon: <Icon className="size-4" />,
                  tone: style.tone,
                  soft: style.soft,
                  nodes: own,
                  placeholder: `子步骤 ${i + 1} · 待开始`,
                  // 口径不同的主题共同支撑缺口，不求和 (验收 E D02)。
                  roll: numeric ? (additive(own) ? sumText(amounts as number[], gapTarget) : { ok: null, text: "口径不同：共同支撑，不求和" }) : null,
                  onAdd: () => setThemes([...themes, emptyTheme(p.key)]),
                  target: { parentId: null, goalId: p.key },
                };
              }),
            },
          ]}
          addLabel="战略主题"
          addHint={sub === 1 ? "按图 3-7 两组想" : undefined}
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
