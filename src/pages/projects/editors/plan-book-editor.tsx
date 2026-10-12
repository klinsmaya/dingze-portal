import { useState } from "react";

import {
  type CompanyPlanBook,
  type DeptPlanBook,
  type DeptUndertakingTable,
  type Issue,
  type PlanBookText,
  emptyPlanBookText,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Block, type PlanBookModel, type PlanBookUpstream, buildCompanyPlanBook, buildDeptPlanBook, deptText } from "@/lib/dingze/plan-book";
import { errorAnchors } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { workspacePath } from "@/lib/dingze/progress";
import { useProjectContext } from "@/pages/projects/project-context";

import { EditorToolbar, ImportButton, SourceNote, TextCell } from "./kit";

const ENTERED: Record<string, { key: keyof PlanBookText; hint: string }[]> = {
  一: [{ key: "summary", hint: "一页讲清本年度要做成什么、靠哪些项目做成；数字以定版成果为准，数字咨询师可协助整理语言" }],
  二: [{ key: "lastYear", hint: "上年度目标完成情况、主要经验与问题" }],
  三: [{ key: "environment", hint: "宏观、行业、客户、竞争与内部能力（环境盘点在培训中完成，这里写结论）" }],
  七: [
    { key: "risks", hint: "主要风险、触发条件与应对措施" },
    { key: "notDo", hint: "“不做什么”的边界 / 部门“三不做”清单" },
  ],
  八: [{ key: "dictionaryNote", hint: "指标字典的补充说明（选填）" }],
};

function BlockView({ block }: { block: Block }) {
  if (block.kind === "heading") return <div className="mt-2 text-sm font-semibold text-brand">{block.text}</div>;
  if (block.kind === "note") return <p className="text-xs text-muted-foreground italic">{block.text}</p>;
  if (block.kind === "text") return <p className="text-sm whitespace-pre-wrap">{block.text}</p>;
  if (block.kind === "figure")
    return (
      <figure className="flex flex-col items-center gap-1 rounded-lg border bg-white p-2">
        <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(block.diagram.svg)}`} alt={block.caption} className="w-full max-w-2xl" />
        <figcaption className="text-xs text-muted-foreground">{block.caption}</figcaption>
      </figure>
    );
  if (block.rows.length === 0) return <p className="text-xs text-muted-foreground">（无）</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {block.headers.map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r, i) => (
            <tr key={i} className="border-t align-top">
              {r.map((v, j) => (
                <td key={j} className="px-2 py-1.5 whitespace-pre-wrap">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Entered chapters are editable; same-source chapters are previews built from upstream tables. */
function BookBody({
  model,
  text,
  onText,
  readOnly,
  invalid,
  anchor,
}: {
  anchor?: string;
  model: PlanBookModel;
  text: PlanBookText;
  onText: (next: PlanBookText) => void;
  readOnly: boolean;
  invalid: boolean;
}) {
  return (
    <div data-anchor={anchor} className={cn("flex flex-col gap-4", invalid && "rounded-xl ring-1 ring-destructive/40")}>
      {model.chapters.map((chapter) => {
        const fields = ENTERED[chapter.no] ?? [];
        return (
          <section key={chapter.no} className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-heading text-base font-bold text-brand">
                {chapter.no}、{chapter.title}
              </h3>
              <Badge variant={chapter.source === "same" ? "secondary" : "outline"}>{chapter.source === "same" ? "同源 · 自动汇总" : "企业录入"}</Badge>
            </div>
            {fields.length ? (
              <div className="flex flex-col gap-2">
                {fields.map((f) => (
                  <TextCell key={f.key} label={`${chapter.title} ${f.key}`} multiline placeholder={f.hint} value={text[f.key] ?? ""} onChange={(v) => onText({ ...text, [f.key]: v })} readOnly={readOnly} className="min-h-24" />
                ))}
                {chapter.no === "八" ? chapter.blocks.map((b, i) => <BlockView key={i} block={b} />) : null}
                {/* 战略屋 / 战略地图 go into chapter one of the Word file; show them here too. */}
                {chapter.blocks.filter((b) => b.kind === "figure").map((b, i) => (
                  <BlockView key={`figure-${i}`} block={b} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {chapter.blocks.map((b, i) => (
                  <BlockView key={i} block={b} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const HINT = "计划书由项目任务书、计划实施推进表、资源匹配表合成。同源章节直接引用定版成果，不重新创造目标、路径、责任和指标值；企业只需填写标“企业录入”的章节。";

export function CompanyPlanBookEditor({
  value,
  onChange,
  readOnly,
  issues,
  upstream,
  enterprise,
  projectYear,
}: {
  value: CompanyPlanBook;
  onChange: (next: CompanyPlanBook) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: PlanBookUpstream;
  enterprise: string;
  projectYear: number;
}) {
  const text = value.text ?? emptyPlanBookText();
  const model = buildCompanyPlanBook({ enterprise, year: projectYear, text, upstream });
  return (
    <section aria-label="公司级年度经营计划书" className="flex flex-col gap-4">
      <EditorToolbar hint={HINT} />
      <BookBody model={model} text={text} onText={(t) => onChange({ text: t })} readOnly={readOnly} anchor="text" invalid={errorAnchors(issues).has("text")} />
    </section>
  );
}

export function DeptPlanBookEditor({
  value,
  onChange,
  readOnly,
  issues,
  upstream,
  enterprise,
  projectYear,
}: {
  value: DeptPlanBook;
  onChange: (next: DeptPlanBook) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: PlanBookUpstream & { "S2-05"?: DeptUndertakingTable };
  enterprise: string;
  projectYear: number;
}) {
  const { project } = useProjectContext();
  const invalid = errorAnchors(issues);
  const depts = value.depts ?? [];
  const [tab, setTab] = useState<string | null>(null);
  const known = new Map<string, string>();
  for (const r of upstream["S2-05"]?.rows ?? []) if (r.deptId) known.set(r.deptId, r.deptName);
  const missing = [...known.entries()].filter(([id]) => !depts.some((d) => d.deptId === id));
  const active = tab && depts.some((d) => d.deptId === tab) ? tab : depts[0]?.deptId;
  return (
    <section aria-label="部门年度经营计划书" className="flex flex-col gap-4">
      <EditorToolbar hint={HINT}>
        <ImportButton
          label="按部门承接表建立部门计划书"
          count={missing.length}
          readOnly={readOnly}
          onClick={() => onChange({ depts: [...depts, ...missing.map(([deptId, deptName]) => ({ id: deptId, deptId, deptName, ...emptyPlanBookText() }))] })}
        />
      </EditorToolbar>
      <SourceNote to={workspacePath(project.id, "S2-05")} linkLabel="打开部门目标承接">
        部门页签来自 S2-05《部门目标承接》里的承接部门（{known.size} 个）{missing.length ? `，其中 ${missing.map(([, n]) => n).join("、")} 还没有建部门计划书${readOnly ? "（解锁后可用“按部门承接表建立部门计划书”补上）" : "，点上方按钮补上"}` : ""}。组织里新增的部门，要先在部门承接里承接目标，才会出现在这里；部门改名不会改已写好的计划书。
      </SourceNote>
      {depts.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">还没有部门计划书</p>
      ) : (
        <Tabs value={active} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="flex-wrap">
            {depts.map((d) => (
              <TabsTrigger data-anchor={d.deptId} key={d.deptId} value={d.deptId} className={cn(invalid.has(d.deptId) && "text-destructive")}>
                {d.deptName}
              </TabsTrigger>
            ))}
          </TabsList>
          {depts.map((d) => {
            const { deptId, deptName } = d;
            const text = deptText(d);
            const model = buildDeptPlanBook({ enterprise, year: projectYear, dept: { deptId, deptName }, text, upstream });
            return (
              <TabsContent key={deptId} value={deptId} className="pt-3">
                <BookBody
                  model={model}
                  text={text}
                  onText={(t) => onChange({ depts: depts.map((x) => (x.deptId === deptId ? { id: deptId, deptId, deptName, ...t } : x)) })}
                  readOnly={readOnly}
                  anchor={deptId} invalid={invalid.has(deptId)}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
}

