import {
  type Issue,
  type ProjectCharterSet,
  RESOURCE_CATEGORIES,
  type ResourceCategory,
  type ResourceMatch,
  type ResourceRow,
  resourceRow,
  resourceRowsFromCharters,
} from "@dingze/shared";

import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: ResourceMatch;
  onChange: (next: ResourceMatch) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S3-02"?: ProjectCharterSet };
};

const COLUMNS: { key: "need" | "stock" | "gap" | "approach" | "owner"; label: string; width: string }[] = [
  { key: "need", label: "需求", width: "min-w-28" },
  { key: "stock", label: "存量", width: "min-w-24" },
  { key: "gap", label: "缺口", width: "min-w-20" },
  { key: "approach", label: "补齐方式", width: "min-w-32" },
  { key: "owner", label: "责任人", width: "min-w-20" },
];

/** S3-06 (表 4-8): need → stock → gap, in four categories per project; “无” declares a category not needed. */
export function ResourceMatchEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const rows = value.rows ?? [];
  const charters = upstream["S3-02"]?.charters ?? [];
  const seed = resourceRowsFromCharters(upstream["S3-02"], rows);
  const set = (next: ResourceRow[]) => onChange({ rows: next });
  const groups = [...charters.map((c) => ({ id: c.id as string | null, name: `${c.code} ${c.name}` })), { id: null, name: "未关联项目" }];

  return (
    <section aria-label="项目资源匹配表" className="flex flex-col gap-4">
      <EditorToolbar hint="资源分财务、人、信息化、物料四类；外部人员计入人，外部服务费计入财务。某类不需要就勾“无”。重大缺口必须写明补齐方式和责任人。">
        <ImportButton label="按任务书带入资源需求" count={seed.length} readOnly={readOnly} onClick={() => set([...rows, ...seed])} />
      </EditorToolbar>
      {groups.map((g) => {
        const own = rows.filter((r) => (r.charterId ?? null) === g.id);
        if (g.id === null && own.length === 0) return null;
        return (
          <div key={g.id ?? "none"} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between bg-muted px-3 py-2">
              <span className="font-semibold text-brand">{g.name}</span>
              {!readOnly ? <AddButton label="资源" onClick={() => set([...rows, resourceRow({ charterId: g.id })])} /> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="min-w-24 px-2 py-2 text-left font-semibold">类别</th>
                    <th className="w-12 px-2 py-2 text-left font-semibold">无</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                        {c.label}
                      </th>
                    ))}
                    <th className="w-12 px-2 py-2 text-left font-semibold">重大</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {own.map((r) => (
                    <tr data-anchor={r.id} key={r.id} className={cn("border-t align-top", invalid.has(r.id) && "bg-destructive/5", r.none && "text-muted-foreground")}>
                      <td className="px-1 py-1">
                        <NativeSelect size="sm" aria-label="资源类别" value={r.category} disabled={readOnly} onChange={(e) => set(patchById(rows, r.id, { category: e.target.value as ResourceCategory }))}>
                          {RESOURCE_CATEGORIES.map((c) => (
                            <NativeSelectOption key={c.key} value={c.key}>
                              {c.label.split("（")[0]}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </td>
                      <td className="px-2 py-2">
                        <Checkbox aria-label="该类不需要" checked={r.none} disabled={readOnly} onCheckedChange={(v) => set(patchById(rows, r.id, { none: v === true }))} />
                      </td>
                      {COLUMNS.map((c) => (
                        <td key={c.key} className="px-1 py-1">
                          <TextCell label={c.label} value={r[c.key]} onChange={(v) => set(patchById(rows, r.id, { [c.key]: v }))} readOnly={readOnly || r.none} />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        <Checkbox aria-label="重大缺口" checked={r.major} disabled={readOnly || r.none} onCheckedChange={(v) => set(patchById(rows, r.id, { major: v === true }))} />
                      </td>
                      <td className="px-1 py-1">
                        <RowActions label="资源" readOnly={readOnly} onRemove={() => set(removeById(rows, r.id))} onMove={(delta) => set(moveById(rows, r.id, delta))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}
