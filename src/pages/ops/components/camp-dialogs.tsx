import { ARTIFACTS, PROJECT_ROLE_LABELS } from "@dingze/shared";
import { Download, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ImportSource } from "@/components/dingze/import-source";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ACCOUNT_TEMPLATE, ENTERPRISE_TEMPLATE, downloadCsv, parseAccountTable, parseEnterpriseTable } from "@/lib/dingze/camp-import";
import { errorMessage } from "@/lib/dingze/errors";
import { type Camp, type CampProject, type CampStatus, opsApi } from "@/lib/dingze/ops-api";
import { useDzUsers, useEnterprises, useOpsMutation } from "@/lib/dingze/ops-queries";

import { CAMP_STATUS_LABELS } from "./labels";
import { UserChecklist } from "./user-checklist";

// 训练营批次的弹窗：建 / 改批次、批量加企业、编入已有项目、批量发账号，以及一次性的账号清单。

const FOCUS_CHOICES = ARTIFACTS.filter((a) => a.priority === "P0");

export function CampFormDialog({ open, onClose, camp, onSaved }: { open: boolean; onClose: () => void; camp?: Camp; onSaved?: (camp: Camp) => void }) {
  const [form, setForm] = useState(() => ({
    name: camp?.name ?? "",
    startDate: camp?.startDate ?? "",
    endDate: camp?.endDate ?? "",
    location: camp?.location ?? "",
    status: (camp?.status ?? "planning") as CampStatus,
    focusCodes: camp?.focusCodes ?? [],
    note: camp?.note ?? "",
  }));
  const save = useOpsMutation(opsApi.saveCamp);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate(
      { ...(camp ? { id: camp.id } : {}), ...form },
      {
        onSuccess: (saved) => {
          toast.success(camp ? "批次已保存" : `已建批次「${saved.name}」`);
          onClose();
          onSaved?.(saved);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{camp ? "编辑批次" : "新建训练营批次"}</DialogTitle>
            <DialogDescription>批次只在运营侧使用：企业看到的界面和企业内训一样。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="camp-name">批次名称</FieldLabel>
              <Input id="camp-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例如：2027 春季第 1 期" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="camp-start">开营日期</FieldLabel>
                <Input id="camp-start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="camp-end">结营日期</FieldLabel>
                <Input id="camp-end" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="camp-status">状态</FieldLabel>
                <NativeSelect id="camp-status" value={form.status} onChange={(e) => set("status", e.target.value as CampStatus)}>
                  {Object.entries(CAMP_STATUS_LABELS).map(([k, v]) => (
                    <NativeSelectOption key={k} value={k}>
                      {v}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="camp-location">地点</FieldLabel>
              <Input id="camp-location" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">今日目标表</FieldLegend>
              <FieldDescription>现场看板按这几张表看各企业做到哪一步；每天开课前换成当天要完成的表，最多 8 张。</FieldDescription>
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {FOCUS_CHOICES.map((a) => (
                  <label key={a.code} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={form.focusCodes.includes(a.code)}
                      onCheckedChange={(checked) =>
                        set("focusCodes", checked ? [...form.focusCodes, a.code].slice(0, 8) : form.focusCodes.filter((c) => c !== a.code))
                      }
                    />
                    <span className="text-xs text-muted-foreground">{a.specId}</span>
                    <span className="truncate">{a.plain}</span>
                  </label>
                ))}
              </div>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="camp-note">备注</FieldLabel>
              <Textarea id="camp-note" value={form.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </FieldGroup>
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

export type IssuedRow = { label: string; username?: string; password?: string | null; note?: string; ok: boolean; error?: string };

/** 批量开通的结果。初始密码只在这里出现一次，可以下载成清单。 */
export function IssuedListDialog({ title, rows, onClose }: { title: string; rows: IssuedRow[] | null; onClose: () => void }) {
  const issued = (rows ?? []).filter((r) => r.ok && r.password);
  return (
    <Dialog open={!!rows} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> {title}
          </DialogTitle>
          <DialogDescription>
            成功 {(rows ?? []).filter((r) => r.ok).length} 条，失败 {(rows ?? []).filter((r) => !r.ok).length} 条。初始密码只显示这一次，请下载清单后通过安全渠道发给本人。
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>对象</TableHead>
              <TableHead>登录名</TableHead>
              <TableHead>初始密码 / 结果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="font-mono text-xs">{r.username ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {!r.ok ? (
                    <span className="text-destructive">{r.error}</span>
                  ) : r.password ? (
                    <span className="font-mono">{r.password}</span>
                  ) : (
                    <span className="text-muted-foreground">{r.note ?? "已有账号，已加入项目"}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={!issued.length}
            onClick={() => downloadCsv(`账号清单-${new Date().toISOString().slice(0, 10)}.csv`, [["对象", "登录名", "初始密码"], ...issued.map((r) => [r.label, r.username, r.password])])}
          >
            <Download /> 下载账号清单
          </Button>
          <Button onClick={onClose}>我已保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampEnrollDialog({ open, onClose, camp, onIssued }: { open: boolean; onClose: () => void; camp: Camp; onIssued: (rows: IssuedRow[]) => void }) {
  const [text, setText] = useState("");
  const [projectName, setProjectName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [lead, setLead] = useState("");
  const [cos, setCos] = useState<number[]>([]);
  const users = useDzUsers(undefined, undefined, open);
  const consultants = (users.data ?? []).filter((u) => u.roles.some((r) => r === "dz_consultant" || r === "dz_consult_admin"));
  const enroll = useOpsMutation(opsApi.campEnroll);
  const { rows, problems } = parseEnterpriseTable(text);
  const run = () =>
    enroll.mutate(
      { campId: camp.id, year: Number(year) || undefined, projectName: projectName.trim() || undefined, leadConsultantId: lead ? Number(lead) : undefined, coConsultantIds: cos, rows },
      {
        onSuccess: ({ results }) => {
          setText("");
          onClose();
          onIssued(results.map((r) => ({ label: r.enterprise, username: r.username, password: r.initialPassword, ok: r.ok, error: r.error })));
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量加企业</DialogTitle>
          <DialogDescription>每家企业会建立独立空间、开通企业管理员（同时是企业项目负责人），并建好本期训练营项目；下面选的咨询师加入每个项目。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field>
            <FieldLabel htmlFor="enroll-project">项目名称</FieldLabel>
            <Input id="enroll-project" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={`${year} 年度战略落地`} />
          </Field>
          <Field>
            <FieldLabel htmlFor="enroll-year">年度</FieldLabel>
            <Input id="enroll-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="enroll-lead">主咨询师</FieldLabel>
          <NativeSelect id="enroll-lead" value={lead} onChange={(e) => setLead(e.target.value)}>
            <NativeSelectOption value="">暂不指定</NativeSelectOption>
            {consultants.map((u) => (
              <NativeSelectOption key={u.id} value={String(u.id)}>
                {u.nickname || u.username}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <FieldSet>
          <FieldLegend variant="label">协作咨询师</FieldLegend>
          <UserChecklist users={consultants.filter((u) => String(u.id) !== lead)} selected={cos} onChange={setCos} emptyText="没有其他咨询师" />
        </FieldSet>
        <ImportSource template={ENTERPRISE_TEMPLATE} onText={setText} />
        <Textarea aria-label="企业名单" className="min-h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"企业全称\t简称\t规模\t管理员姓名\t管理员登录名\t管理员手机"} />
        {rows.length ? (
          <ul className="max-h-40 overflow-y-auto rounded-lg border text-xs">
            {rows.map((r) => (
              <li key={r.adminUsername} className="flex gap-2 border-b px-3 py-1.5 last:border-b-0">
                <span className="font-medium">{r.shortName}</span>
                <span className="text-muted-foreground">
                  {r.name} · {r.size === "large" ? "大型企业" : "中小企业"} · 管理员 {r.adminNickname}（{r.adminUsername}）
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
          <Button disabled={!rows.length || enroll.isPending} onClick={run}>
            {enroll.isPending ? "开通中…" : `开通 ${rows.length || ""} 家企业`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 把已经开通的企业项目编入本批次。 */
export function CampAttachDialog({ open, onClose, camp }: { open: boolean; onClose: () => void; camp: Camp }) {
  const enterprises = useEnterprises();
  const [selected, setSelected] = useState<number[]>([]);
  const attach = useOpsMutation(opsApi.campAttach);
  const choices = (enterprises.data ?? []).flatMap((e) =>
    (e.projects ?? []).filter((p) => (p as { campId?: number | null }).campId !== camp.id && p.status !== "archived").map((p) => ({ ...p, enterprise: e.shortName || e.name })),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>编入已有项目</DialogTitle>
          <DialogDescription>编入后项目场景改为训练营，原来的数据和成员不变。</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 overflow-y-auto rounded-lg border">
          {choices.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">没有可编入的项目</li>
          ) : (
            choices.map((p) => (
              <li key={p.id} className="border-b last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={(c) => setSelected(c ? [...selected, p.id] : selected.filter((x) => x !== p.id))} />
                  <span className="font-medium">{p.enterprise}</span>
                  <span className="text-muted-foreground">{p.name}</span>
                  {(p as { campId?: number | null }).campId ? <Badge variant="outline">已在其他批次</Badge> : null}
                </label>
              </li>
            ))
          )}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!selected.length || attach.isPending}
            onClick={() =>
              attach.mutate(
                { campId: camp.id, projectIds: selected },
                {
                  onSuccess: (r) => {
                    toast.success(`已编入 ${r.updated} 个项目`);
                    setSelected([]);
                    onClose();
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            编入 {selected.length || ""} 个项目
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampAccountsDialog({ project, onClose, onIssued }: { project: CampProject | null; onClose: () => void; onIssued: (rows: IssuedRow[]) => void }) {
  const [text, setText] = useState("");
  const accounts = useOpsMutation(opsApi.campAccounts);
  const { rows, problems } = parseAccountTable(text);
  return (
    <Dialog open={!!project} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量发账号 · {project?.enterprise.shortName}</DialogTitle>
          <DialogDescription>新账号开为这家企业的企业成员，并按表里的角色和部门加入「{project?.name}」；登录名已存在的只加入项目。</DialogDescription>
        </DialogHeader>
        <ImportSource template={ACCOUNT_TEMPLATE} onText={setText} />
        <Textarea aria-label="成员名单" className="min-h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"姓名\t登录名\t手机\t邮箱\t项目角色\t部门"} />
        {rows.length ? (
          <ul className="max-h-40 overflow-y-auto rounded-lg border text-xs">
            {rows.map((r) => (
              <li key={r.username} className="flex gap-2 border-b px-3 py-1.5 last:border-b-0">
                <span className="font-medium">{r.nickname}</span>
                <span className="text-muted-foreground">
                  {r.username} · {PROJECT_ROLE_LABELS[r.role]}
                  {r.dept ? ` · ${r.dept}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {problems.length ? <p className="text-xs text-[color:var(--dz-warn)]">{problems.join("；")}</p> : null}
        {rows.some((r) => r.dept) ? (
          <Alert>
            <AlertDescription>部门要和企业组织表里的名称一致；对不上的那一行会失败，其他行照常开通。</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!project || !rows.length || accounts.isPending}
            onClick={() =>
              project &&
              accounts.mutate(
                { projectId: project.id, rows },
                {
                  onSuccess: ({ results }) => {
                    setText("");
                    onClose();
                    onIssued(
                      results.map((r) => ({
                        label: `${r.nickname}${r.role ? ` · ${PROJECT_ROLE_LABELS[r.role]}` : ""}`,
                        username: r.username,
                        password: r.initialPassword,
                        ok: r.ok,
                        error: r.error,
                      })),
                    );
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            {accounts.isPending ? "开通中…" : `开通 ${rows.length || ""} 个账号`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
