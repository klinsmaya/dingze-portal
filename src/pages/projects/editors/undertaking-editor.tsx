import {
  type DeptUndertaking,
  type DeptUndertakingTable,
  type GoalPathSystem,
  type Issue,
  type KeyProjectList,
  type RaciTable,
  newRowId,
  undertakingsFromRaci,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { sourceLookup } from "@/lib/dingze/goal-sources";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: DeptUndertakingTable;
  onChange: (next: DeptUndertakingTable) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S2-03"?: GoalPathSystem; "S2-04"?: RaciTable; "S2-08"?: KeyProjectList };
};

const COLUMNS: { key: "purpose" | "task" | "metric" | "value"; label: string; width: string; multiline?: boolean }[] = [
  { key: "purpose", label: "目的", width: "min-w-44", multiline: true },
  { key: "task", label: "任务", width: "min-w-44" },
  { key: "metric", label: "衡量指标", width: "min-w-32" },
  { key: "value", label: "指标值", width: "min-w-28" },
];

/** S2-05: what each department undertakes, from its A / R cells in the RACI matrix. */
export function UndertakingEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const rows = value.rows ?? [];
  const raci = upstream["S2-04"];
  const depts = raci?.columns ?? [];
  const seed = undertakingsFromRaci(raci, sourceLookup(upstream["S2-03"], upstream["S2-08"]), rows);
  const set = (next: DeptUndertaking[]) => onChange({ rows: next });
  const sorted = [...rows].sort((a, b) => depts.findIndex((d) => d.id === a.deptId) - depts.findIndex((d) => d.id === b.deptId));

  return (
    <section aria-label="部门目标承接表" className="flex flex-col gap-4">
      <EditorToolbar hint="两级参与、两级分解：部门承接自己担任 A / R 的项目或路径，写清目的、任务、衡量指标和指标值；不只是分摊数字。">
        <ImportButton label="按 RACI 生成承接项" count={seed.length} readOnly={readOnly} onClick={() => set([...rows, ...seed])} />
        {!readOnly ? (
          <AddButton
            label="添加承接项"
            onClick={() =>
              set([...rows, { id: newRowId("u"), deptId: depts[0]?.id ?? "", deptName: depts[0]?.name ?? "", role: "R", purpose: "", task: "", metric: "", value: "", sourceRowId: null }])
            }
          />
        ) : null}
      </EditorToolbar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="min-w-36 px-2 py-2 text-left font-semibold">部门</th>
              <th className="w-20 px-2 py-2 text-left font-semibold">角色</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                  {c.label}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                  还没有承接项
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr data-anchor={r.id} key={r.id} className={cn("border-t align-top", invalid.has(r.id) && "bg-destructive/5")}>
                  <td className="px-1 py-1">
                    <NativeSelect
                      size="sm"
                      aria-label="承接部门"
                      className="w-full"
                      value={r.deptId}
                      disabled={readOnly}
                      onChange={(e) => {
                        const dept = depts.find((d) => d.id === e.target.value);
                        set(patchById(rows, r.id, { deptId: e.target.value, deptName: dept?.name ?? "" }));
                      }}
                    >
                      <NativeSelectOption value="">选择部门…</NativeSelectOption>
                      {depts.map((d) => (
                        <NativeSelectOption key={d.id} value={d.id}>
                          {d.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="px-2 py-2">
                    {readOnly ? (
                      <Badge variant={r.role === "A" ? "default" : "outline"}>{r.role}</Badge>
                    ) : (
                      <NativeSelect size="sm" aria-label="承接角色" value={r.role} onChange={(e) => set(patchById(rows, r.id, { role: e.target.value as "A" | "R" }))}>
                        <NativeSelectOption value="A">A</NativeSelectOption>
                        <NativeSelectOption value="R">R</NativeSelectOption>
                      </NativeSelect>
                    )}
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      <TextCell
                        label={`${r.deptName} ${c.label}`}
                        multiline={c.multiline}
                        value={r[c.key]}
                        onChange={(v) => set(patchById(rows, r.id, { [c.key]: v }))}
                        readOnly={readOnly}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <RowActions label={`${r.deptName} ${r.task}`} readOnly={readOnly} onRemove={() => set(removeById(rows, r.id))} onMove={(delta) => set(moveById(rows, r.id, delta))} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
