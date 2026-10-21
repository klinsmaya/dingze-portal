import { ChevronDown, CornerDownRight, FilePlus2, Network, Plus, Table2, X } from "lucide-react";
import { useState } from "react";

import {
  CLASS_LABELS,
  type GoalPathSystem,
  type Issue,
  type KeyProjectList,
  MAX_WBS_LEVEL,
  PRIORITY_FACTORS,
  type ProjectCharter,
  type ProjectCharterSet,
  type RaciTable,
  SCREEN_QUESTIONS,
  type ScreeningItem,
  type WbsPackage,
  charterFor,
  classify,
  emptyScreening,
  newRowId,
  nextCharterCode,
  priorityScore,
  screeningFrom,
  wbsPackage,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";
import { MoveToDialog, type TreeConfig, TreeMindMap, TreeNodeMenu, useTreeActions } from "./tree-editor";

type Props = {
  value: ProjectCharterSet;
  onChange: (next: ProjectCharterSet) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S2-08"?: KeyProjectList; "S2-06"?: GoalPathSystem; "S2-04"?: RaciTable };
  projectYear: number;
  people: string[];
};

const CLASS_TONE = { P: "bg-brand text-brand-foreground", S: "bg-gold text-brand", R: "bg-muted text-muted-foreground" } as const;

/** S3-02: 项目化判定 over the S3-01 snapshot, then one 表 4-4 charter (with WBS) per P item. */
export function CharterEditor({ value, onChange, readOnly, issues, upstream, projectYear, people }: Props) {
  const invalid = errorAnchors(issues);
  const [func, setFunc] = useState("OPS");
  const screening = value.screening ?? [];
  const charters = value.charters ?? [];
  const seed = screeningFrom(upstream["S2-08"], upstream["S2-06"], screening);
  const depts = upstream["S2-04"]?.columns ?? [];
  const setScreening = (next: ScreeningItem[]) => onChange({ ...value, screening: next });
  const setCharter = (id: string, patch: Partial<ProjectCharter>) => onChange({ ...value, charters: patchById(charters, id, patch) });

  const createCharter = (item: ScreeningItem) => {
    const code = nextCharterCode(projectYear, func || "OPS", charters);
    const charter = charterFor(item, upstream["S2-08"], code);
    // Lead department: the RACI A of the project row, when the matrix has one.
    const row = upstream["S2-04"]?.rows?.find((r) => r.sourceId === item.sourceId);
    const lead = row ? depts.find((d) => (row.cells?.[d.id] ?? []).includes("A")) : undefined;
    onChange({ ...value, charters: [...charters, { ...charter, deptId: lead?.id ?? "", deptName: lead?.name ?? "", raci: row ? describeRaci(row.cells, depts) : "" }] });
  };

  return (
    <section aria-label="项目任务书" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <EditorToolbar hint="项目化判定：四个问题满足 ≥2 条为项目（P，写任务书），1 条为专项任务（S），0 条为例行（R，转部门日常）。S3-01 关键项目清单只读引用 S2-08 定版。">
          <ImportButton label="带入关键项目与部门一级路径" count={seed.length} readOnly={readOnly} onClick={() => setScreening([...screening, ...seed])} />
          {!readOnly ? <AddButton label="添加事项" onClick={() => setScreening([...screening, emptyScreening()])} /> : null}
        </EditorToolbar>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="min-w-40 px-2 py-2 text-left font-semibold">事项</th>
                <th className="min-w-40 px-2 py-2 text-left font-semibold">成果导向重命名</th>
                {SCREEN_QUESTIONS.map((q, i) => (
                  <th key={q.key} className="min-w-24 px-2 py-2 text-left font-semibold" title={q.label}>
                    {i + 1}. {q.label.slice(0, 6)}…
                  </th>
                ))}
                <th className="min-w-28 px-2 py-2 text-left font-semibold">判定</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {screening.length === 0 ? (
                <tr>
                  <td colSpan={SCREEN_QUESTIONS.length + 4} className="px-4 py-6 text-center text-muted-foreground">
                    还没有要判定的事项
                  </td>
                </tr>
              ) : (
                screening.map((s) => {
                  const cls = classify(s.answers);
                  const hasCharter = charters.some((c) => c.screeningId === s.id);
                  return (
                    <tr data-anchor={s.id} key={s.id} className={cn("border-t align-top", invalid.has(s.id) && "bg-destructive/5")}>
                      <td className="px-1 py-1">
                        <TextCell label="事项" value={s.name} onChange={(name) => setScreening(patchById(screening, s.id, { name }))} readOnly={readOnly} />
                        <div className="px-1 pt-0.5 text-[11px] text-muted-foreground">
                          {s.sourceKind === "project" ? "来自 S2-08 关键项目" : s.sourceKind === "path" ? "来自 S2-06 部门路径" : "手工添加"}
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <TextCell label="成果导向重命名" placeholder="如“实现物流车队签约 40 家”" value={s.renamed} onChange={(renamed) => setScreening(patchById(screening, s.id, { renamed }))} readOnly={readOnly} />
                      </td>
                      {SCREEN_QUESTIONS.map((q) => (
                        <td key={q.key} className="px-1 py-1">
                          <NativeSelect
                            size="sm"
                            aria-label={`${s.name} ${q.label}`}
                            value={s.answers?.[q.key] === null || s.answers?.[q.key] === undefined ? "" : s.answers[q.key] ? "y" : "n"}
                            disabled={readOnly}
                            onChange={(e) =>
                              setScreening(
                                patchById(screening, s.id, { answers: { ...s.answers, [q.key]: e.target.value === "" ? null : e.target.value === "y" } })
                              )
                            }
                          >
                            <NativeSelectOption value="">—</NativeSelectOption>
                            <NativeSelectOption value="y">是</NativeSelectOption>
                            <NativeSelectOption value="n">否</NativeSelectOption>
                          </NativeSelect>
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        {cls ? <Badge className={CLASS_TONE[cls]}>{cls} {CLASS_LABELS[cls]}</Badge> : <span className="text-xs text-muted-foreground">待判定</span>}
                        {cls === "P" && !hasCharter && !readOnly ? (
                          <Button type="button" size="sm" variant="outline" className="mt-1" onClick={() => createCharter(s)}>
                            <FilePlus2 /> 写任务书
                          </Button>
                        ) : null}
                      </td>
                      <td className="px-1 py-1">
                        <RowActions label={s.name || "事项"} readOnly={readOnly} onRemove={() => setScreening(removeById(screening, s.id))} onMove={(delta) => setScreening(moveById(screening, s.id, delta))} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!readOnly ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            新任务书编号的职能英文简称
            <Input aria-label="职能英文简称" value={func} onChange={(e) => setFunc(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} className="h-7 w-24" />
            编号规则：年份＋职能英文简称＋P＋3 位序号，如 {nextCharterCode(projectYear, func || "OPS", charters)}（也可写成 2024HR-P001）
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="font-heading text-lg font-bold text-brand">项目任务书（{charters.length}）</div>
        {charters.length === 0 ? <p className="text-sm text-muted-foreground">判定为 P 的事项点“写任务书”。</p> : null}
        {charters.map((c) => (
          <CharterCard
            key={c.id}
            charter={c}
            onChange={(patch) => setCharter(c.id, patch)}
            onRemove={() => onChange({ ...value, charters: removeById(charters, c.id) })}
            readOnly={readOnly}
            invalid={invalid}
            depts={depts}
            people={people}
          />
        ))}
      </div>
    </section>
  );
}

function describeRaci(cells: Record<string, string[]>, depts: { id: string; name: string }[]) {
  return ["A", "R", "C", "I"]
    .map((letter) => {
      const names = depts.filter((d) => (cells?.[d.id] ?? []).includes(letter)).map((d) => d.name);
      return names.length ? `${letter}：${names.join("、")}` : "";
    })
    .filter(Boolean)
    .join("；");
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function CharterCard({
  charter: c,
  onChange,
  onRemove,
  readOnly,
  invalid,
  depts,
  people,
}: {
  charter: ProjectCharter;
  onChange: (patch: Partial<ProjectCharter>) => void;
  onRemove: () => void;
  readOnly: boolean;
  invalid: Set<string>;
  depts: { id: string; name: string }[];
  people: string[];
}) {
  const [open, setOpen] = useState(true);
  const score = priorityScore(c.priority);
  const t = (key: keyof ProjectCharter, label: string, multiline = false, placeholder?: string) => (
    <Field label={label}>
      <TextCell label={`${c.name} ${label}`} multiline={multiline} placeholder={placeholder} value={(c[key] as string) ?? ""} onChange={(v) => onChange({ [key]: v })} readOnly={readOnly} />
    </Field>
  );

  return (
    <Collapsible data-anchor={c.id} open={open} onOpenChange={setOpen} className={cn("rounded-xl border bg-card", invalid.has(c.id) && "border-destructive/40")}>
      <div className="flex items-center gap-2 px-4 py-3">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="font-mono text-xs text-muted-foreground">{c.code || "未编号"}</span>
          <span className="truncate font-heading font-bold text-brand">{c.name || "未命名项目"}</span>
          {score !== null ? <Badge variant="outline">优先级 {score}</Badge> : null}
          {c.deptName ? <Badge variant="secondary">{c.deptName}牵头</Badge> : null}
        </CollapsibleTrigger>
        <RowActions label={c.name || "任务书"} readOnly={readOnly} onRemove={onRemove} />
      </div>
      <CollapsibleContent className="flex flex-col gap-4 border-t px-4 py-4">
        <div className="grid gap-3 md:grid-cols-[10rem_1fr_1fr]">
          {t("code", "项目编号")}
          {t("name", "项目名称")}
          {t("theme", "战略关联 / 主题")}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_9rem_9rem]">
          {t("objective", "项目目标", true)}
          <Field label="开始">
            <Input aria-label={`${c.name} 开始`} type="month" value={c.start} readOnly={readOnly} onChange={(e) => onChange({ start: e.target.value })} />
          </Field>
          <Field label="结束">
            <Input aria-label={`${c.name} 结束`} type="month" value={c.end} readOnly={readOnly} onChange={(e) => onChange({ end: e.target.value })} />
          </Field>
        </div>
        <Field label={`优先级（五因子 1—5 分）${score !== null ? ` · 加权 ${score}` : ""}`}>
          <div className="flex flex-wrap gap-3">
            {PRIORITY_FACTORS.map((f) => (
              <label key={f.key} className="flex items-center gap-1.5 text-sm">
                {f.label} {Math.round(f.weight * 100)}%
                <NativeSelect
                  size="sm"
                  aria-label={`${c.name} ${f.label}`}
                  value={c.priority?.[f.key] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => onChange({ priority: { ...c.priority, [f.key]: e.target.value ? Number(e.target.value) : null } })}
                >
                  <NativeSelectOption value="">—</NativeSelectOption>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <NativeSelectOption key={n} value={n}>
                      {n}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          {t("inScope", "范围内", true)}
          {t("outOfScope", "范围外（不做什么）", true)}
          {t("deliverables", "关键交付物", true)}
          {t("milestones", "关键节点", true)}
        </div>
        <div className="grid gap-3 md:grid-cols-[12rem_10rem_1fr]">
          <Field label="牵头部门">
            <NativeSelect
              aria-label={`${c.name} 牵头部门`}
              className="w-full"
              value={c.deptId}
              disabled={readOnly}
              onChange={(e) => onChange({ deptId: e.target.value, deptName: depts.find((d) => d.id === e.target.value)?.name ?? "" })}
            >
              <NativeSelectOption value="">选择部门…</NativeSelectOption>
              {depts.map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {d.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="项目负责人">
            <TextCell label={`${c.name} 负责人`} value={c.owner} onChange={(owner) => onChange({ owner })} readOnly={readOnly} placeholder={people[0]} />
          </Field>
          {t("raci", "RACI（来自 S2-04，可补充）")}
        </div>
        <Field label="资源与预算（表 4-4 三分法，S3-06 会按四类汇总）">
          <div className="grid gap-2 md:grid-cols-3">
            {(
              [
                ["fte", "人力 FTE"],
                ["budget", "财务预算"],
                ["material", "物力与支持"],
              ] as const
            ).map(([key, label]) => (
              <TextCell
                key={key}
                label={`${c.name} ${label}`}
                placeholder={label}
                value={c.resources?.[key] ?? ""}
                onChange={(v) => onChange({ resources: { ...c.resources, [key]: v } })}
                readOnly={readOnly}
              />
            ))}
          </div>
        </Field>
        <Field label="风险与假设（Top3 风险：风险 · 触发点 · 应对措施）">
          <div className="flex flex-col gap-2">
            {(c.risks ?? []).map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                {(["risk", "trigger", "response"] as const).map((key) => (
                  <TextCell
                    key={key}
                    label={`风险 ${key}`}
                    placeholder={{ risk: "风险", trigger: "触发点", response: "应对措施" }[key]}
                    value={r[key]}
                    onChange={(v) => onChange({ risks: patchById(c.risks, r.id, { [key]: v }) })}
                    readOnly={readOnly}
                  />
                ))}
                <RowActions label="风险" readOnly={readOnly} onRemove={() => onChange({ risks: removeById(c.risks, r.id) })} onMove={(delta) => onChange({ risks: moveById(c.risks, r.id, delta) })} />
              </div>
            ))}
            {!readOnly ? (
              <div>
                <AddButton label="添加风险" disabled={(c.risks ?? []).length >= 3} onClick={() => onChange({ risks: [...(c.risks ?? []), { id: newRowId("rk"), risk: "", trigger: "", response: "" }] })} />
              </div>
            ) : null}
            <TextCell label={`${c.name} 关键假设`} placeholder="关键假设与前置依赖" multiline value={c.assumptions} onChange={(assumptions) => onChange({ assumptions })} readOnly={readOnly} />
          </div>
        </Field>
        <Field label="验收标准">
          <div className="grid gap-2 md:grid-cols-3">
            {(
              [
                ["result", "结果指标"],
                ["process", "过程指标"],
                ["close", "关闭条件"],
              ] as const
            ).map(([key, label]) => (
              <TextCell
                key={key}
                label={`${c.name} ${label}`}
                placeholder={label}
                value={c.acceptance?.[key] ?? ""}
                onChange={(v) => onChange({ acceptance: { ...c.acceptance, [key]: v } })}
                readOnly={readOnly}
              />
            ))}
          </div>
        </Field>
        <WbsTable wbs={c.wbs ?? []} onChange={(wbs) => onChange({ wbs })} readOnly={readOnly} invalid={invalid} charterName={c.name} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function WbsTable({ wbs, onChange, readOnly, invalid, charterName }: { wbs: WbsPackage[]; onChange: (next: WbsPackage[]) => void; readOnly: boolean; invalid: Set<string>; charterName: string }) {
  const [view, setView] = useState<"table" | "mind">("table");
  const ordered: WbsPackage[] = [];
  const walk = (parentId: string | null) => {
    for (const w of wbs.filter((x) => x.parentId === parentId)) {
      ordered.push(w);
      walk(w.id);
    }
  };
  walk(null);
  for (const w of wbs) if (!ordered.includes(w)) ordered.push(w);
  // Dependencies on packages that are gone are dropped with them.
  const setNodes = (next: WbsPackage[]) => {
    const ids = new Set(next.map((w) => w.id));
    onChange(next.map((w) => ((w.dependsOn ?? []).every((d) => ids.has(d)) ? w : { ...w, dependsOn: w.dependsOn.filter((d) => ids.has(d)) })));
  };
  const cfg: TreeConfig<WbsPackage> = {
    nodes: wbs,
    setNodes,
    make: (p) => wbsPackage({ parentId: p.parentId ?? null, level: p.level ?? 1, ...p }),
    maxLevel: MAX_WBS_LEVEL,
    title: (w) => w.name,
    copyForSplit: (w) => ({ name: w.name ? `${w.name}（拆分）` : "", owner: w.owner, dependsOn: [...(w.dependsOn ?? [])] }),
    combine: (keep, gone) => ({
      name: [keep.name, gone.name].filter(Boolean).join("、"),
      deliverable: [keep.deliverable, gone.deliverable].filter(Boolean).join("；"),
      dependsOn: [...new Set([...(keep.dependsOn ?? []), ...(gone.dependsOn ?? [])])].filter((d) => d !== keep.id && d !== gone.id),
    }),
    roots: [{ id: null, label: charterName || "本项目" }],
    levelWord: (l) => `${["", "一", "二", "三"][l] ?? l}级工作包`,
  };
  const actions = useTreeActions(cfg);
  const [moving, setMoving] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">WBS（S3-03）：以交付物为中心拆到 2—3 层，写清完成定义、责任人和前后依赖</div>
        <div className="flex items-center gap-2">
          <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as "table" | "mind")} variant="outline" size="sm" aria-label="WBS 展示方式">
            <ToggleGroupItem value="mind" title="思维导图：拆解、调整层级（拖动、下级 / 同级、移动到…）">
              <Network /> 思维导图
            </ToggleGroupItem>
            <ToggleGroupItem value="table" title="表格：逐格填交付物、完成定义、责任人和依赖">
              <Table2 /> 表格
            </ToggleGroupItem>
          </ToggleGroup>
          {!readOnly ? <AddButton label="一级工作包" onClick={() => onChange([...wbs, wbsPackage()])} /> : null}
        </div>
      </div>
      {view === "mind" ? (
        <TreeMindMap
          cfg={cfg}
          readOnly={readOnly}
          invalid={invalid}
          fields={[
            { key: "name", label: "工作包" },
            { key: "deliverable", label: "交付物" },
            { key: "owner", label: "责任人" },
          ]}
          patch={(id, p) => onChange(patchById(wbs, id, p))}
          detail={(w) => [w.deliverable && `交付：${w.deliverable}`, w.owner && `责任人 ${w.owner}`].filter(Boolean).join(" · ") || "（未填交付物）"}
          rootCards={[{ root: cfg.roots[0], nodes: wbs.filter((w) => !w.parentId), onAdd: () => onChange([...wbs, wbsPackage()]) }]}
          addLabel="一级工作包"
          emptyHint="还没有工作包"
        />
      ) : (
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">工作包</th>
              <th className="w-44 px-2 py-2 text-left font-semibold">交付物</th>
              <th className="w-48 px-2 py-2 text-left font-semibold">完成定义</th>
              <th className="w-28 px-2 py-2 text-left font-semibold">责任人</th>
              <th className="w-52 px-2 py-2 text-left font-semibold">前置依赖</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">
                  还没有工作包
                </td>
              </tr>
            ) : (
              ordered.map((w) => (
                <tr data-anchor={w.id} key={w.id} className={cn("border-t align-top", invalid.has(w.id) && "bg-destructive/5")}>
                  <td className="px-1 py-1">
                    <div className="flex items-start gap-1" style={{ paddingLeft: `${(w.level - 1) * 1.25}rem` }}>
                      {w.level > 1 ? <CornerDownRight className="mt-2.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
                      <TextCell label="工作包" value={w.name} onChange={(name) => onChange(patchById(wbs, w.id, { name }))} readOnly={readOnly} />
                    </div>
                  </td>
                  {(["deliverable", "doneDefinition", "owner"] as const).map((key) => (
                    <td key={key} className="px-1 py-1">
                      <TextCell label={`${w.name} ${key}`} value={w[key]} onChange={(v) => onChange(patchById(wbs, w.id, { [key]: v }))} readOnly={readOnly} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <div className="flex flex-wrap items-center gap-1">
                      {(w.dependsOn ?? []).map((d) => (
                        <Badge key={d} variant="outline" className="gap-1 font-normal">
                          {wbs.find((x) => x.id === d)?.name || "（已删除）"}
                          {!readOnly ? (
                            <button type="button" aria-label="移除依赖" onClick={() => onChange(patchById(wbs, w.id, { dependsOn: w.dependsOn.filter((x) => x !== d) }))}>
                              <X className="size-3" />
                            </button>
                          ) : null}
                        </Badge>
                      ))}
                      {!readOnly ? (
                        <NativeSelect
                          size="sm"
                          aria-label={`${w.name} 添加前置依赖`}
                          value=""
                          onChange={(e) => e.target.value && onChange(patchById(wbs, w.id, { dependsOn: [...(w.dependsOn ?? []), e.target.value] }))}
                        >
                          <NativeSelectOption value="">＋ 依赖</NativeSelectOption>
                          {wbs
                            .filter((x) => x.id !== w.id && !(w.dependsOn ?? []).includes(x.id))
                            .map((x) => (
                              <NativeSelectOption key={x.id} value={x.id}>
                                {x.name || "（未命名）"}
                              </NativeSelectOption>
                            ))}
                        </NativeSelect>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex items-center justify-end gap-0.5">
                      {!readOnly && w.level < MAX_WBS_LEVEL ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => actions.child(w.id)}>
                          <Plus /> 下级
                        </Button>
                      ) : null}
                      <TreeNodeMenu id={w.id} actions={actions} readOnly={readOnly} onMoveTo={setMoving} label={w.name || "工作包"} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
      {view === "table" ? <MoveToDialog cfg={cfg} nodeId={moving} actions={actions} onClose={() => setMoving(null)} orderedNodes={ordered} /> : null}
    </div>
  );
}
