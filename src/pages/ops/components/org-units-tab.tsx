import { ClipboardPaste, Network, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/dingze/errors";
import { type EnterpriseDetail, type OrgUnit, opsApi } from "@/lib/dingze/ops-api";
import { type OrgNode, flattenOrgUnits, parseOrgTable } from "@/lib/dingze/org-units";
import { useOpsMutation } from "@/lib/dingze/ops-queries";

import { ConfirmAction } from "./confirm-action";
import { ORG_KIND_LABELS } from "./labels";

type Draft = { id?: number; name: string; kind: OrgUnit["kind"]; parentId: number | null; headId: number | null; headName: string; duty: string };

export function OrgUnitsTab({ detail }: { detail: EnterpriseDetail }) {
  const enterpriseId = detail.enterprise.id;
  const nodes = useMemo(() => flattenOrgUnits(detail.orgUnits), [detail.orgUnits]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const remove = useOpsMutation(opsApi.deleteOrgUnit);
  const memberName = (id: number | null) => {
    const user = detail.members.find((m) => m.id === id);
    return user ? user.nickname || user.username : null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          部门用于成员归属、责任分工、部门承接与计分卡；可按“公司 › 部门 › 团队”分层。职责会在责任分工矩阵里作参考；已定版的部门表在组织变更后会提示主咨询师判断是否重开。
        </p>
        <span className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <ClipboardPaste /> 从 Excel 粘贴
          </Button>
          <Button onClick={() => setDraft({ name: "", kind: "department", parentId: null, headId: null, headName: "", duty: "" })}>
            <Plus /> 新增部门
          </Button>
        </span>
      </div>

      {nodes.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Network />
            </EmptyMedia>
            <EmptyTitle>还没有组织部门</EmptyTitle>
            <EmptyDescription>定目标责阶段的部门承接需要先建好部门。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {nodes.map((node) => (
            <li key={node.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
              <span style={{ paddingLeft: `${node.depth * 1.5}rem` }} className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  {node.depth > 0 ? <span className="text-muted-foreground">└</span> : null}
                  <span className="truncate font-medium">{node.name}</span>
                  <Badge variant="outline" className="shrink-0">
                    {ORG_KIND_LABELS[node.kind] ?? node.kind}
                  </Badge>
                  {memberName(node.headId) || node.headName ? (
                    <span className="truncate text-xs text-muted-foreground">
                      负责人：{memberName(node.headId) ?? `${node.headName}（无账号）`}
                    </span>
                  ) : null}
                </span>
                {node.duty ? <span className="line-clamp-2 text-xs text-muted-foreground">职责：{node.duty}</span> : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft({ name: "", kind: "team", parentId: node.id, headId: null, headName: "", duty: "" })}
              >
                <Plus /> 下级
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`编辑 ${node.name}`}
                onClick={() => setDraft({ id: node.id, name: node.name, kind: node.kind, parentId: node.parentId, headId: node.headId, headName: node.headName ?? "", duty: node.duty ?? "" })}
              >
                <Pencil />
              </Button>
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`删除 ${node.name}`} className="text-destructive">
                    <Trash2 />
                  </Button>
                }
                title={`删除“${node.name}”？`}
                description="有下级部门或仍有项目成员归属的部门不能删除。"
                confirmLabel="删除"
                destructive
                onConfirm={() =>
                  remove.mutateAsync(
                    { enterpriseId, id: node.id },
                    { onSuccess: () => toast.success("已删除"), onError: (error) => toast.error(errorMessage(error)) }
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      <MemberDepartments detail={detail} nodes={nodes} />

      <OrgUnitDialog draft={draft} onClose={() => setDraft(null)} detail={detail} nodes={nodes} />
      <OrgImportDialog open={importing} onClose={() => setImporting(false)} detail={detail} />
    </div>
  );
}

function OrgUnitDialog({
  draft,
  onClose,
  detail,
  nodes,
}: {
  draft: Draft | null;
  onClose: () => void;
  detail: EnterpriseDetail;
  nodes: OrgNode[];
}) {
  const [value, setValue] = useState<Draft | null>(draft);
  const [shown, setShown] = useState<Draft | null>(draft);
  if (draft !== shown) {
    setShown(draft);
    setValue(draft);
  }
  const save = useOpsMutation(opsApi.saveOrgUnit);
  const enterprisePeople = detail.members.filter((m) => m.roles.some((r) => r === "dz_ent_admin" || r === "dz_ent_member"));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value) return;
    save.mutate(
      { enterpriseId: detail.enterprise.id, ...value, name: value.name.trim(), headName: value.headId ? null : value.headName.trim() || null, duty: value.duty.trim() || null },
      {
        onSuccess: () => {
          toast.success(value.id ? "已保存" : "已新增");
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );
  };

  return (
    <Dialog open={!!draft} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{value?.id ? "编辑部门" : "新增部门"}</DialogTitle>
            <DialogDescription>{detail.enterprise.shortName}</DialogDescription>
          </DialogHeader>
          {value ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="org-name">名称</FieldLabel>
                <Input id="org-name" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="org-kind">类型</FieldLabel>
                  <NativeSelect
                    id="org-kind"
                    className="w-full"
                    value={value.kind}
                    onChange={(e) => setValue({ ...value, kind: e.target.value as OrgUnit["kind"] })}
                  >
                    {Object.entries(ORG_KIND_LABELS).map(([k, label]) => (
                      <NativeSelectOption key={k} value={k}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="org-parent">上级</FieldLabel>
                  <NativeSelect
                    id="org-parent"
                    className="w-full"
                    value={value.parentId ?? ""}
                    onChange={(e) => setValue({ ...value, parentId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <NativeSelectOption value="">（无）</NativeSelectOption>
                    {nodes
                      .filter((n) => n.id !== value.id)
                      .map((n) => (
                        <NativeSelectOption key={n.id} value={n.id}>
                          {"　".repeat(n.depth)}
                          {n.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="org-head">负责人</FieldLabel>
                <NativeSelect
                  id="org-head"
                  className="w-full"
                  value={value.headId ?? ""}
                  onChange={(e) => setValue({ ...value, headId: e.target.value ? Number(e.target.value) : null })}
                >
                  <NativeSelectOption value="">（没有账号 / 暂不指定）</NativeSelectOption>
                  {enterprisePeople.map((m) => (
                    <NativeSelectOption key={m.id} value={m.id}>
                      {m.nickname || m.username}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {!value.headId ? (
                <Field>
                  <FieldLabel htmlFor="org-head-name">负责人姓名（没有账号时填写）</FieldLabel>
                  <Input id="org-head-name" value={value.headName} placeholder="如“赵部长”" onChange={(e) => setValue({ ...value, headName: e.target.value })} />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="org-duty">职责</FieldLabel>
                <Textarea
                  id="org-duty"
                  value={value.duty}
                  placeholder="这个部门主要负责什么，如“工商业与居民用户开发、客户服务、价格管理”"
                  className="min-h-20"
                  onChange={(e) => setValue({ ...value, duty: e.target.value })}
                />
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={save.isPending}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 成员所属部门：企业管理员（或运营）设置，一次对本企业所有项目生效。 */
function MemberDepartments({ detail, nodes }: { detail: EnterpriseDetail; nodes: OrgNode[] }) {
  const set = useOpsMutation(opsApi.setMemberDepartment);
  const people = detail.members.filter((m) => m.roles.some((r) => r === "dz_ent_admin" || r === "dz_ent_member"));
  const current = (userId: number) => {
    const rows = detail.projects.flatMap((p) => p.members.filter((m) => m.userId === userId));
    return { inProject: rows.length > 0, orgUnitId: rows.find((m) => m.orgUnitId)?.orgUnitId ?? null, mixed: new Set(rows.map((m) => m.orgUnitId ?? 0)).size > 1 };
  };
  if (!people.length) return null;
  return (
    <section aria-labelledby="member-depts" className="flex flex-col gap-2">
      <h3 id="member-depts" className="font-semibold">
        成员所属部门
      </h3>
      <p className="text-xs text-muted-foreground">设置后对本企业所有项目生效；项目里的“组织与职责”、项目启动检查都按这里显示。</p>
      <ul className="overflow-hidden rounded-xl border bg-card">
        {people.map((m) => {
          const c = current(m.id);
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm last:border-b-0">
              <span className="min-w-28 font-medium">{m.nickname || m.username}</span>
              {c.inProject ? (
                <NativeSelect
                  size="sm"
                  aria-label={`${m.nickname || m.username} 所属部门`}
                  value={c.orgUnitId ?? ""}
                  disabled={set.isPending}
                  onChange={(e) =>
                    set.mutate(
                      { enterpriseId: detail.enterprise.id, userId: m.id, orgUnitId: e.target.value ? Number(e.target.value) : null },
                      { onSuccess: (r) => toast.success(`已更新 ${r.updated} 个项目里的所属部门`), onError: (error) => toast.error(errorMessage(error)) },
                    )
                  }
                >
                  <NativeSelectOption value="">（未归部门）</NativeSelectOption>
                  {nodes.map((n) => (
                    <NativeSelectOption key={n.id} value={n.id}>
                      {"　".repeat(n.depth)}
                      {n.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                <span className="text-xs text-muted-foreground">还没加入项目，加入后再设置</span>
              )}
              {c.mixed ? <span className="text-xs text-[color:var(--dz-warn)]">各项目里不一致，重新选一次即统一</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 从 Excel 粘贴组织表：先预览，再按名称新增或更新（同名部门更新职责和负责人）。 */
function OrgImportDialog({ open, onClose, detail }: { open: boolean; onClose: () => void; detail: EnterpriseDetail }) {
  const [text, setText] = useState("");
  const importRows = useOpsMutation(opsApi.importOrgUnits);
  const { rows, problems } = parseOrgTable(text);
  const existing = new Map(detail.orgUnits.map((u) => [u.name, u]));
  const people = detail.members.filter((m) => m.roles.some((r) => r === "dz_ent_admin" || r === "dz_ent_member"));
  const personId = (name: string) => people.find((p) => p.nickname === name || p.username === name)?.id ?? null;
  const run = () =>
    importRows.mutate(
      { enterpriseId: detail.enterprise.id, rows },
      {
        onSuccess: (r) => {
          toast.success(`已导入：新增 ${r.created} 个、更新 ${r.updated} 个${r.changes ? "；已定版的部门表会提示主咨询师" : ""}`);
          setText("");
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>从 Excel 粘贴组织表</DialogTitle>
          <DialogDescription>每行一个部门，列依次是：名称、上级、类型（公司 / 部门 / 团队）、负责人、职责；后几列可以空。同名部门会更新上级、负责人和职责。负责人和企业账号同名时自动关联，否则记为“无账号”姓名。</DialogDescription>
        </DialogHeader>
        <Textarea autoFocus aria-label="组织表内容" className="min-h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"市场营销部\t\t部门\t赵部长\t工商业与居民用户开发、客户服务\n大客户组\t市场营销部\t团队\t\t重点工业用户维护"} />
        {rows.length ? (
          <ul className="max-h-48 overflow-y-auto rounded-lg border text-xs">
            {rows.map((r) => (
              <li key={r.name} className="flex gap-2 border-b px-3 py-1.5 last:border-b-0">
                <Badge variant={existing.has(r.name) ? "secondary" : "default"}>{existing.has(r.name) ? "更新" : "新增"}</Badge>
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">
                  {[r.parent && `上级 ${r.parent}`, ORG_KIND_LABELS[r.kind], r.head && `负责人 ${r.head}${personId(r.head) ? "" : "（无账号）"}`].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {problems.length ? <p className="text-xs text-[color:var(--dz-warn)]">{problems.join("；")}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!rows.length || importRows.isPending} onClick={run}>
            导入 {rows.length || ""} 个部门
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
