import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import {
  SIXFOLD_FIELDS,
  houseStarted,
  type Battlefield,
  type Issue,
  type StrategyContent,
  type StrategyExpression,
} from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useEditSession, useEditorChrome } from "@/pages/projects/components/edit-session";

import { EditorToolbar } from "./kit";

const MAX_BATTLEFIELDS = 4;

const SIXFOLD_HINTS: Record<string, string> = {
  mission: "企业为什么而存在？",
  vision: "企业未来发展方向是什么？",
  strategicGoals: "5 年战略目标 + 3 年中期目标",
  strategyChoice: "业务组合、价值创造、能力与资源布局等基本策略",
  stepsAndMeasures: "目标与策略在时间上的分布，通常两步走或三步走",
  indicatorSystem: "伴随步骤的核心衡量指标，如收入、利润、人效",
};

// Read-only reference abridged from the book's 表 2-2 (A 智能装备制造企业).
const SIXFOLD_SAMPLE: Record<string, string> = {
  mission: "帮助企业制造持续升级与进步，让制造更高效，让产品更美好",
  vision: "成为一家在锄草机智能制造领域可持续发展的创新型企业",
  strategicGoals: "2030 年总收入达到［目标值］；2035 年进入上市新阶段",
  strategyChoice: "一个核心（相对竞争优势）＋三大业务＋三大策略（聚焦 / 转型 / 升级）",
  stepsAndMeasures: "产品突围 → 品牌突围 → 拔节升级",
  indicatorSystem: "收入 / 利润 / 人效，分年列示（近详远略）",
};

type EditorProps = {
  value: StrategyContent;
  onChange: (next: StrategyContent) => void;
  readOnly: boolean;
  issues: Issue[];
};

function issueFor(issues: Issue[], anchor: string) {
  return issues.find((i) => i.anchor === anchor && i.level === "error");
}

function Cell({
  label,
  hint,
  value,
  onChange,
  readOnly,
  invalid,
  tone = "default",
  className,
  anchor,
}: {
  anchor?: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  invalid?: boolean;
  tone?: "default" | "roof";
  className?: string;
}) {
  const id = useId();
  return (
    <div data-anchor={anchor} className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={cn("text-xs font-semibold", tone === "roof" ? "text-gold" : "text-muted-foreground")}>
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        placeholder={readOnly ? "" : hint ?? "填写，或写“待补”"}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-h-14 resize-none",
          tone === "roof" && "border-white/25 bg-white/10 text-brand-foreground placeholder:text-white/60",
          value.trim() === "待补" && "border-suggestion-border bg-suggestion text-suggestion-foreground"
        )}
      />
    </div>
  );
}

function HouseView({ value, onChange, readOnly, issues }: EditorProps) {
  const set = (patch: Partial<StrategyContent>) => onChange({ ...value, ...patch });
  const setBattlefield = (id: string, patch: Partial<Battlefield>) =>
    set({ battlefields: value.battlefields.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const addBattlefield = () =>
    set({
      battlefields: [
        ...value.battlefields,
        { id: `b${Date.now().toString(36)}`, name: "", advantage: "", mustWin: "" },
      ],
    });
  const columns = value.battlefields.length || 1;

  return (
    <section aria-label="战略屋" className="flex flex-col">
      <div
        className="grid gap-3 bg-brand px-5 pt-16 pb-4 text-brand-foreground sm:grid-cols-3"
        style={{ clipPath: "polygon(50% 0, 100% 32%, 100% 100%, 0 100%, 0 32%)" }}
      >
        <Cell tone="roof" label="使命" value={value.mission} onChange={(v) => set({ mission: v })} readOnly={readOnly} anchor={"mission"} invalid={!!issueFor(issues, "mission")} />
        <Cell tone="roof" label="愿景" value={value.vision} onChange={(v) => set({ vision: v })} readOnly={readOnly} anchor={"vision"} invalid={!!issueFor(issues, "vision")} />
        <Cell tone="roof" label="价值观" value={value.values} onChange={(v) => set({ values: v })} readOnly={readOnly} anchor={"values"} invalid={!!issueFor(issues, "values")} />
      </div>

      <div className="overflow-x-auto border-x border-border">
        <div className="grid min-w-[640px] grid-cols-[108px_1fr]">
          <div className="border-b bg-muted px-3 py-3">
            <div className="text-sm font-bold text-brand">经营目标</div>
            <div className="text-[11px] text-muted-foreground">财务＋非财务</div>
          </div>
          <div className="grid grid-cols-3 gap-3 border-b p-3">
            {(["y1", "y3", "y5"] as const).map((k, i) => (
              <Cell
                key={k}
                label={["一年", "三年", "五年"][i]}
                value={value.goals[k]}
                onChange={(v) => set({ goals: { ...value.goals, [k]: v } })}
                readOnly={readOnly}
                anchor={`goals.${k}`} invalid={!!issueFor(issues, `goals.${k}`)}
              />
            ))}
          </div>

          {(
            [
              ["name", "主要战场", "业务组合 · 增长曲线"],
              ["advantage", "如何致胜", "按战场写可持续核心优势"],
              ["mustWin", "必赢之战", "年度落地抓手"],
            ] as const
          ).map(([key, label, hint]) => (
            <div key={key} className="contents">
              <div className="border-b bg-muted px-3 py-3">
                <div className="text-sm font-bold text-brand">{label}</div>
                <div className="text-[11px] text-muted-foreground">{hint}</div>
              </div>
              <div className="grid gap-3 border-b p-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {value.battlefields.length === 0 ? (
                  <p className="self-center text-sm text-muted-foreground">还没有主要战场{readOnly ? "" : "，点下方“添加战场”开始"}</p>
                ) : (
                  value.battlefields.map((b, i) => (
                    <Cell
                      key={b.id}
                      label={key === "name" ? `第 ${["一", "二", "三", "四"][i]}增长曲线` : `第 ${i + 1} 个战场`}
                      value={b[key]}
                      onChange={(v) => setBattlefield(b.id, { [key]: v })}
                      readOnly={readOnly}
                      anchor={`battlefields.${b.id}.${key}`} invalid={!!issueFor(issues, `battlefields.${b.id}.${key}`)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2 border-x border-border px-3 py-2">
          <Button variant="outline" size="sm" onClick={addBattlefield} disabled={value.battlefields.length >= MAX_BATTLEFIELDS}>
            <Plus /> 添加战场
          </Button>
          {value.battlefields.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => set({ battlefields: value.battlefields.slice(0, -1) })}
            >
              <Trash2 /> 删除最后一个战场
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-b-xl border border-t-[3px] border-t-brand bg-muted p-3 sm:grid-cols-[96px_repeat(3,minmax(0,1fr))]">
        <div className="self-center">
          <div className="text-sm font-bold text-brand">落地保障</div>
          <div className="text-[11px] text-muted-foreground">地基</div>
        </div>
        {(["organization", "mechanism", "talent"] as const).map((k, i) => (
          <Cell
            key={k}
            label={["组织", "机制", "人才"][i]}
            value={value.foundation[k]}
            onChange={(v) => set({ foundation: { ...value.foundation, [k]: v } })}
            readOnly={readOnly}
            anchor={`foundation.${k}`} invalid={!!issueFor(issues, `foundation.${k}`)}
          />
        ))}
      </div>
    </section>
  );
}

function SixfoldView({ value, onChange, readOnly, issues }: EditorProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="px-3 py-2 text-left text-xs text-muted-foreground">
          战略简约六分法（表 2-1）。目的、方向与战略屋的使命、愿景是同一份数据。
        </caption>
        <thead>
          <tr className="bg-muted text-left text-muted-foreground">
            <th scope="col" className="w-36 px-3 py-2">要素</th>
            <th scope="col" className="px-3 py-2">内容</th>
          </tr>
        </thead>
        <tbody>
          {SIXFOLD_FIELDS.map((f) => (
            <tr key={String(f.key)} className="border-t align-top">
              <th scope="row" className="px-3 py-3 text-left">
                <div className="font-bold text-brand">{f.label}</div>
                <div className="text-[11px] font-normal text-muted-foreground">{SIXFOLD_HINTS[String(f.key)]}</div>
              </th>
              <td className="px-3 py-2">
                <Textarea
                  aria-label={f.label}
                  value={String(value[f.key] ?? "")}
                  readOnly={readOnly}
                  placeholder={readOnly ? "" : "填写，或写“待补”"}
                  data-anchor={String(f.key)}
                  aria-invalid={!!issueFor(issues, String(f.key)) || undefined}
                  onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                  className="min-h-14 resize-none"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StrategyContentEditor(props: EditorProps) {
  const { value } = props;
  // 六分法 is the P0 table; the strategy house is an optional (P1) expression of the same data.
  const [view, setView] = useState<StrategyExpression>("sixfold");
  useEditorChrome({
    title: view === "house" ? "战略屋" : "战略简约六分法表",
    chip: view === "house" ? "S1-01 · 图 2-3 · 可选" : "S1-01 · 表 2-1 · 必做",
    views: [
      { key: "sixfold", label: "六分法" },
      { key: "house", label: "战略屋（可选）" },
    ],
    view,
    setView: (k) => setView(k as StrategyExpression),
  });

  return (
    <div className="flex flex-col gap-3">
      <EditorToolbar hint={`六个方面全部填齐（写“待补”不算）才能“本步完成”；战略屋是可选的另一种表达，使命、愿景两处共用。${houseStarted(value) ? "" : "战略屋尚未填写。"}`} />

      {view === "house" ? <HouseView {...props} /> : <SixfoldView {...props} />}

      {view === "sixfold" ? (
        <details className="rounded-xl border border-book-border bg-book px-4 py-3 text-sm text-book-foreground">
          <summary className="cursor-pointer font-semibold">参考样例（示例，非本企业内容）· 只读，不能保存或导出</summary>
          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr]">
            {SIXFOLD_FIELDS.map((f) => (
              <div key={String(f.key)} className="contents">
                <dt className="font-semibold">{f.label}</dt>
                <dd>{SIXFOLD_SAMPLE[String(f.key)]}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : (
        <BookLink label="书中方法 · 战略屋怎么填（图 2-3）" />
      )}
    </div>
  );
}

/** 方法内容统一放在右栏“书中方法”，这里只留一个打开它的入口。 */
function BookLink({ label }: { label: string }) {
  const session = useEditSession();
  if (!session) return null;
  return (
    <button
      type="button"
      onClick={() => session.openPanel("book")}
      className="flex w-fit items-center gap-1.5 rounded-xl border border-book-border bg-book px-4 py-2 text-sm font-semibold text-book-foreground hover:underline"
    >
      <BookOpen className="size-4" /> {label} → 在右栏打开
    </button>
  );
}
