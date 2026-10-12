import { X } from "lucide-react";
import { useState } from "react";

import {
  type GoalPathSystem,
  type Issue,
  type KeyProjectList,
  type RaciLetter,
  type RaciTable,
  newRowId,
  raciRowsFrom,
  toggleRaciLetter,
  verifyRaci,
} from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectOrgUnit } from "@/lib/dingze/api";
import { errorAnchors, moveById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { useProjectContext } from "@/pages/projects/project-context";

import { AddButton, EditorToolbar, ImportButton, RowActions, SourceNote, TextCell } from "./kit";

type Props = {
  value: RaciTable;
  onChange: (next: RaciTable) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S2-08"?: KeyProjectList; "S2-03"?: GoalPathSystem };
  orgUnits: ProjectOrgUnit[];
};

const LETTERS: { key: RaciLetter; title: string }[] = [
  { key: "R", title: "执行者" },
  { key: "A", title: "最终负责者（唯一）" },
  { key: "C", title: "咨询 / 协同者" },
  { key: "I", title: "知情者" },
];

const LETTER_TONE: Record<RaciLetter, string> = {
  R: "bg-brand text-brand-foreground",
  A: "bg-gold text-brand",
  C: "bg-secondary text-secondary-foreground",
  I: "bg-muted text-muted-foreground",
};

/** S2-04: rows are key projects (or key paths), columns are departments; A = 1 and R ≥ 1 per row. */
export function RaciEditor({ value, onChange, readOnly, issues, upstream, orgUnits }: Props) {
  const { project } = useProjectContext();
  const invalid = errorAnchors(issues);
  const [newColumn, setNewColumn] = useState("");
  const columns = value.columns ?? [];
  const rows = value.rows ?? [];
  const projects = upstream["S2-08"]?.projects ?? [];
  const rowSeed = raciRowsFrom(projects.length ? { projects } : { paths: (upstream["S2-03"]?.nodes ?? []).filter((n) => n.level <= 2) }, rows);
  const deptSeed = orgUnits
    .filter((o) => o.kind !== "company" && !columns.some((c) => c.id === `org-${o.id}`))
    .map((o) => ({ id: `org-${o.id}`, name: o.name }));

  const removeColumn = (id: string) =>
    onChange({
      columns: removeById(columns, id),
      rows: rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[id];
        return { ...r, cells };
      }),
    });

  const depts = orgUnits.filter((o) => o.kind === "department");
  const headless = depts.filter((d) => !d.headId && !d.headName).map((d) => d.name);
  return (
    <section aria-label="RACI 责任分解矩阵" className="flex flex-col gap-4">
      <SourceNote to={`/projects/${project.id}/materials#org`} linkLabel="看组织与职责" warn={!depts.length}>
        {!depts.length
          ? "组织里还没有部门：责任者列只能手动加。请企业管理员先在「本企业 › 组织部门」建好部门和负责人。"
          : `责任者列取自组织部门（${depts.length} 个）${headless.length ? `；${headless.join("、")} 还没写负责人` : ""}，表头小字是部门职责，定 A、R 时对照着看。组织之外的责任者可以加自定义列；定版后组织再变，这里只提示、不自动改。`}
      </SourceNote>
      <EditorToolbar hint="R 执行者、A 最终负责者、C 咨询协同、I 知情。每行 A 必须唯一、至少一个 R；点 A 会自动从同行其他部门移走。">
        <ImportButton label="带入组织部门" count={deptSeed.length} readOnly={readOnly} onClick={() => onChange({ ...value, columns: [...columns, ...deptSeed] })} />
        <ImportButton
          label={projects.length ? "带入关键项目" : "带入一、二级路径"}
          count={rowSeed.length}
          readOnly={readOnly}
          onClick={() => onChange({ ...value, rows: [...rows, ...rowSeed] })}
        />
        {!readOnly ? (
          <AddButton label="添加行" onClick={() => onChange({ ...value, rows: [...rows, { id: newRowId("ra"), name: "", cells: {}, sourceId: null, sourceKind: "manual" }] })} />
        ) : null}
      </EditorToolbar>

      {!readOnly ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newColumn.trim()) return;
            onChange({ ...value, columns: [...columns, { id: newRowId("col"), name: newColumn.trim() }] });
            setNewColumn("");
          }}
        >
          <Input aria-label="新增责任部门或岗位" placeholder="新增部门 / 岗位列" value={newColumn} onChange={(e) => setNewColumn(e.target.value)} className="w-56" />
          <Button type="submit" variant="outline" size="sm" disabled={!newColumn.trim()}>
            添加列
          </Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 min-w-56 bg-muted px-2 py-2 text-left font-semibold">关键项目 / 路径</th>
              {columns.map((c) => {
                // 部门职责作参考（闭环第二批）：取当前组织里的职责，表里只存部门名。
                const unit = c.id.startsWith("org-") ? orgUnits.find((o) => `org-${o.id}` === c.id) : undefined;
                return (
                  <th data-anchor={c.id} key={c.id} className={cn("min-w-32 px-2 py-2 text-center align-top font-semibold", invalid.has(c.id) && "text-destructive")}>
                    <div className="flex items-center justify-center gap-1">
                      {c.name}
                      {!readOnly ? (
                        <button type="button" aria-label={`删除列 ${c.name}`} onClick={() => removeColumn(c.id)} className="text-muted-foreground hover:text-destructive">
                          <X className="size-3" />
                        </button>
                      ) : null}
                    </div>
                    {unit?.duty ? (
                      <div className="mx-auto mt-0.5 line-clamp-2 max-w-40 text-[10px] font-normal" title={`职责：${unit.duty}`}>
                        {unit.duty}
                      </div>
                    ) : null}
                  </th>
                );
              })}
              <th className="w-20 px-2 py-2 text-center font-semibold">A / R</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                  还没有要分配责任的项目或路径
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const a = columns.filter((c) => (row.cells?.[c.id] ?? []).includes("A")).length;
                const r = columns.filter((c) => (row.cells?.[c.id] ?? []).includes("R")).length;
                return (
                  <tr data-anchor={row.id} key={row.id} className={cn("border-t align-middle", invalid.has(row.id) && "bg-destructive/5")}>
                    <td className="sticky left-0 bg-card px-1 py-1">
                      <TextCell label="行名称" value={row.name} onChange={(name) => onChange({ ...value, rows: rows.map((x) => (x.id === row.id ? { ...x, name } : x)) })} readOnly={readOnly} />
                    </td>
                    {columns.map((c) => {
                      const letters = row.cells?.[c.id] ?? [];
                      return (
                        <td key={c.id} className="px-1 py-1 text-center">
                          <div className="inline-flex gap-0.5">
                            {LETTERS.map((l) => {
                              const on = letters.includes(l.key);
                              return (
                                <button
                                  key={l.key}
                                  type="button"
                                  disabled={readOnly}
                                  aria-pressed={on}
                                  aria-label={`${row.name || "行"} · ${c.name} · ${l.key} ${l.title}`}
                                  title={`${l.key} ${l.title}`}
                                  onClick={() => onChange(toggleRaciLetter(value, row.id, c.id, l.key))}
                                  className={cn(
                                    "size-7 rounded-md border text-xs font-bold transition-colors disabled:cursor-default",
                                    on ? LETTER_TONE[l.key] : "border-dashed text-muted-foreground/60 hover:border-solid hover:text-foreground"
                                  )}
                                >
                                  {l.key}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                    <td className={cn("px-2 py-1 text-center text-xs font-semibold tabular-nums", a === 1 && r >= 1 ? "text-status-done-foreground" : "text-destructive")}>
                      {a} / {r}
                    </td>
                    <td className="px-1 py-1">
                      <RowActions
                        label={row.name || "行"}
                        readOnly={readOnly}
                        onRemove={() => onChange({ ...value, rows: removeById(rows, row.id) })}
                        onMove={(delta) => onChange({ ...value, rows: moveById(rows, row.id, delta) })}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && columns.length > 0 ? <RaciVerification table={value} /> : null}
    </section>
  );
}

/** 表 3-18 RACI 验证优化表: the book's seven checks, run live on the matrix. */
function RaciVerification({ table }: { table: RaciTable }) {
  const v = verifyRaci(table);
  const h = v.horizontal;
  const checks: { dir: string; point: string; hit: number | string[]; action: string }[] = [
    { dir: "横向（按任务）", point: "无 R：任务无人实施", hit: h.noR, action: "补充执行人" },
    { dir: "横向", point: "无 A：缺乏问责", hit: h.noA, action: "明确唯一主责" },
    { dir: "横向", point: "多 A：多头负责", hit: h.multiA, action: "只保留一个 A" },
    { dir: "横向", point: "多 C：顾问过多", hit: h.manyC, action: "精简征询范围" },
    { dir: "横向", point: "多 I：知情过宽", hit: h.manyI, action: "按需设定" },
    { dir: "横向", point: "R 兼 C / I", hit: h.rWithCI, action: "执行者不再被征询 / 知会" },
    { dir: "纵向（按角色）", point: "R 超载", hit: v.vertical.rOverload, action: "拆分或下放" },
    { dir: "纵向", point: "A 泛滥", hit: v.vertical.aSprawl, action: "梳理授权链" },
    { dir: "纵向", point: "全无 RA", hit: v.vertical.noRA, action: "界定为 C 或 I（支持性岗位）" },
  ];
  const describe = (hit: number | string[]) => (Array.isArray(hit) ? (hit.length ? hit.join("、") : "—") : hit ? `${hit} 行` : "—");
  const bad = (hit: number | string[]) => (Array.isArray(hit) ? hit.length > 0 : hit > 0);
  return (
    <details className="rounded-xl border bg-card" open={checks.some((c) => bad(c.hit))}>
      <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">
        验证优化表（表 3-18）
        <span className="ml-2 text-xs font-normal text-muted-foreground">{checks.filter((c) => bad(c.hit)).length ? `${checks.filter((c) => bad(c.hit)).length} 项待处理` : "全部通过"}</span>
      </summary>
      <table className="w-full border-t text-xs">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 text-left font-semibold">验证方向</th>
            <th className="px-3 py-1.5 text-left font-semibold">验证点</th>
            <th className="px-3 py-1.5 text-left font-semibold">现状</th>
            <th className="px-3 py-1.5 text-left font-semibold">处理动作</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.point} className={cn("border-t", bad(c.hit) && "bg-destructive/5")}>
              <td className="px-3 py-1.5 text-muted-foreground">{c.dir}</td>
              <td className="px-3 py-1.5">{c.point}</td>
              <td className={cn("px-3 py-1.5", bad(c.hit) ? "font-semibold text-destructive" : "text-status-done-foreground")}>
                {!v.verticalApplies && c.dir.startsWith("纵向") ? "行数不足 4，暂不检查" : describe(c.hit)}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">{c.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
