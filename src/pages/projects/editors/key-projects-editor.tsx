import { X } from "lucide-react";
import { useId } from "react";

import {
  type GoalPathSystem,
  type Issue,
  type KeyProject,
  type KeyProjectList,
  emptyKeyProject,
  projectsFromPaths,
} from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: KeyProjectList;
  onChange: (next: KeyProjectList) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S2-03"?: GoalPathSystem };
  keyProjectLevel: 1 | 2;
  people: string[];
};

const TEXT_COLUMNS: { key: keyof KeyProject; label: string; width: string; multiline?: boolean; placeholder?: string }[] = [
  { key: "code", label: "项目编号", width: "min-w-24" },
  { key: "name", label: "项目名称", width: "min-w-44", placeholder: "成果导向命名" },
  { key: "theme", label: "战略关联 / 主题", width: "min-w-36" },
  { key: "objective", label: "项目目标", width: "min-w-48", multiline: true },
];

/** S2-08 (表 3-13): seven columns; source paths are kept for tracing and hidden in exports. */
export function KeyProjectsEditor({ value, onChange, readOnly, issues, upstream, keyProjectLevel, people }: Props) {
  const invalid = errorAnchors(issues);
  const listId = useId();
  const projects = value.projects ?? [];
  const paths = upstream["S2-03"]?.nodes ?? [];
  const proposals = projectsFromPaths(upstream["S2-03"], keyProjectLevel, projects);
  const set = (next: KeyProject[]) => onChange({ projects: next });
  const pathName = (id: string) => paths.find((p) => p.id === id)?.path ?? "（路径已删除）";

  return (
    <section aria-label="关键项目列表" className="flex flex-col gap-4">
      <EditorToolbar
        hint={`抓关键并入立项：本项目按${keyProjectLevel === 1 ? "一" : "二"}级路径立项（运营管理可调整）。经提取、归类、逻辑化、结构化、价值命名五步形成项目。`}
      >
        <ImportButton label={`按${keyProjectLevel === 1 ? "一" : "二"}级路径生成候选项目`} count={proposals.length} readOnly={readOnly} onClick={() => set([...projects, ...proposals])} />
        {!readOnly ? <AddButton label="添加项目" onClick={() => set([...projects, emptyKeyProject({ code: `KP-${String(projects.length + 1).padStart(2, "0")}` })])} /> : null}
      </EditorToolbar>

      <datalist id={listId}>
        {people.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              {TEXT_COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-2 py-2 text-left font-semibold", c.width)}>
                  {c.label}
                </th>
              ))}
              <th className="min-w-32 px-2 py-2 text-left font-semibold">起止时间</th>
              <th className="min-w-44 px-2 py-2 text-left font-semibold">关键节点</th>
              <th className="min-w-28 px-2 py-2 text-left font-semibold">责任人</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={TEXT_COLUMNS.length + 4} className="px-4 py-8 text-center text-muted-foreground">
                  还没有关键项目
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr data-anchor={p.id} key={p.id} className={cn("border-t align-top", invalid.has(p.id) && "bg-destructive/5")}>
                  {TEXT_COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-1">
                      <TextCell
                        label={`${p.name || "项目"} ${c.label}`}
                        placeholder={c.placeholder}
                        multiline={c.multiline}
                        value={p[c.key] as string}
                        onChange={(v) => set(patchById(projects, p.id, { [c.key]: v }))}
                        readOnly={readOnly}
                      />
                      {c.key === "name" ? (
                        <div className="flex flex-wrap items-center gap-1 px-1 pt-1">
                          {(p.sourcePathIds ?? []).map((id) => (
                            <Badge key={id} variant="outline" className="gap-1 font-normal">
                              来源：{pathName(id)}
                              {!readOnly ? (
                                <button type="button" aria-label="移除来源路径" onClick={() => set(patchById(projects, p.id, { sourcePathIds: p.sourcePathIds.filter((x) => x !== id) }))}>
                                  <X className="size-3" />
                                </button>
                              ) : null}
                            </Badge>
                          ))}
                          {!readOnly && paths.length ? (
                            <NativeSelect
                              size="sm"
                              aria-label="添加来源路径"
                              value=""
                              onChange={(e) => e.target.value && set(patchById(projects, p.id, { sourcePathIds: [...(p.sourcePathIds ?? []), e.target.value] }))}
                            >
                              <NativeSelectOption value="">＋ 来源路径</NativeSelectOption>
                              {paths
                                .filter((n) => !(p.sourcePathIds ?? []).includes(n.id))
                                .map((n) => (
                                  <NativeSelectOption key={n.id} value={n.id}>
                                    {"　".repeat(Math.max(0, n.level - 1))}
                                    {n.path}
                                  </NativeSelectOption>
                                ))}
                            </NativeSelect>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <div className="flex flex-col gap-1">
                      <Input aria-label={`${p.name || "项目"} 开始时间`} type="month" value={p.start} readOnly={readOnly} onChange={(e) => set(patchById(projects, p.id, { start: e.target.value }))} />
                      <Input aria-label={`${p.name || "项目"} 结束时间`} type="month" value={p.end} readOnly={readOnly} onChange={(e) => set(patchById(projects, p.id, { end: e.target.value }))} />
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <TextCell label={`${p.name || "项目"} 关键节点`} multiline placeholder="如：3 月立项；6 月首站投运" value={p.milestones} onChange={(milestones) => set(patchById(projects, p.id, { milestones }))} readOnly={readOnly} />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      aria-label={`${p.name || "项目"} 责任人`}
                      list={listId}
                      value={p.owner}
                      readOnly={readOnly}
                      onChange={(e) => set(patchById(projects, p.id, { owner: e.target.value }))}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <RowActions
                      label={p.name || "项目"}
                      readOnly={readOnly}
                      onRemove={() => set(removeById(projects, p.id))}
                      onMove={(delta) => set(moveById(projects, p.id, delta))}
                    />
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
