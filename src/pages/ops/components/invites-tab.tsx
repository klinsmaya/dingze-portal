import { PROJECT_ROLE_LABELS, type ProjectRole } from "@dingze/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Ticket, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/dingze/errors";
import { type Invite, type InviteInput, type Registration, inviteApi, inviteLink } from "@/lib/dingze/invite-api";
import type { EnterpriseDetail } from "@/lib/dingze/ops-api";
import { opsKeys } from "@/lib/dingze/ops-queries";
import { formatTime } from "@/lib/dingze/records";

// 邀请注册（审核制）：发邀请码 → 对方凭码申请 → 这里审核。通过后才开通账号（企业成员），并按码上的
// 项目、角色和部门加入项目。

const ENTERPRISE_ROLES: ProjectRole[] = ["ent_lead", "dept_head", "member", "readonly"];
const invitesKey = (enterpriseId: number) => ["dingze", "ops", "invites", enterpriseId] as const;

export function usePendingRegistrations(enterpriseId: number) {
  const q = useQuery({ queryKey: invitesKey(enterpriseId), queryFn: () => inviteApi.listInvites(enterpriseId) });
  return q.data?.registrations.filter((r) => r.status === "pending").length ?? 0;
}

function useInviteMutation<TVars, TResult>(enterpriseId: number, fn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([client.invalidateQueries({ queryKey: invitesKey(enterpriseId) }), client.invalidateQueries({ queryKey: opsKeys.enterprise(enterpriseId) })]),
  });
}

function scopeText(i: Invite) {
  return [i.projectName && `项目「${i.projectName}」`, i.projectRole && PROJECT_ROLE_LABELS[i.projectRole], i.orgUnitName].filter(Boolean).join(" · ") || "只加入企业";
}

function inviteState(i: Invite): { label: string; muted: boolean } {
  if (i.status === "disabled") return { label: "已停用", muted: true };
  if (i.expiresAt && new Date(i.expiresAt).getTime() < Date.now()) return { label: "已过期", muted: true };
  if (i.used >= i.maxUses) return { label: "名额已满", muted: true };
  return { label: "可用", muted: false };
}

export function InvitesTab({ detail, asOps }: { detail: EnterpriseDetail; asOps: boolean }) {
  const enterpriseId = detail.enterprise.id;
  const data = useQuery({ queryKey: invitesKey(enterpriseId), queryFn: () => inviteApi.listInvites(enterpriseId) });
  const save = useInviteMutation(enterpriseId, inviteApi.saveInvite);
  const review = useInviteMutation(enterpriseId, inviteApi.reviewRegistration);
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<Registration | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (data.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (data.error) return <p className="text-sm text-destructive">{errorMessage(data.error)}</p>;
  const invites = data.data?.invites ?? [];
  const registrations = data.data?.registrations ?? [];
  const pending = registrations.filter((r) => r.status === "pending");
  const reviewed = registrations.filter((r) => r.status !== "pending");
  const inviteOf = (r: Registration) => invites.find((i) => i.id === r.inviteId);

  const copy = async (i: Invite) => {
    try {
      await navigator.clipboard.writeText(`邀请你加入「${detail.enterprise.shortName}」：${inviteLink(i.code)}\n邀请码：${i.code}`);
      toast.success("已复制邀请链接和邀请码");
    } catch {
      toast.error("复制失败，请手动复制邀请码");
    }
  };
  const approve = (r: Registration) =>
    review.mutate(
      { enterpriseId, id: r.id, approve: true },
      { onSuccess: () => toast.success(`已通过：${r.nickname} 现在可以用自己设的密码登录`), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold">待审核的申请 {pending.length ? <Badge>{pending.length}</Badge> : null}</h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">没有待审核的申请。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请人</TableHead>
                  <TableHead>自述</TableHead>
                  <TableHead>邀请码 · 加入到</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead className="text-right">审核</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => {
                  const inv = inviteOf(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.nickname}</div>
                        <div className="text-xs text-muted-foreground">{[r.username, r.phone, r.email].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.remark || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <span className="font-mono">{inv?.code}</span>
                        <div className="text-muted-foreground">{inv ? scopeText(inv) : ""}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatTime(r.createdAt)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" disabled={review.isPending} onClick={() => approve(r)} aria-label={`通过 ${r.nickname}`}>
                          <Check /> 通过
                        </Button>{" "}
                        <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => setRejecting(r)} aria-label={`不通过 ${r.nickname}`}>
                          <X /> 不通过
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-semibold">邀请码</h2>
            <p className="text-xs text-muted-foreground">把链接发给要加入的人；对方自己设密码提交申请，审核通过才开通账号。被拒的申请不占名额。</p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> 新建邀请码
          </Button>
        </div>
        {invites.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">还没有邀请码。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邀请码</TableHead>
                  <TableHead>加入到</TableHead>
                  <TableHead>名额</TableHead>
                  <TableHead>有效期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => {
                  const state = inviteState(i);
                  return (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="font-mono font-medium tracking-wider">{i.code}</div>
                        <div className="text-xs text-muted-foreground">{[i.note, i.createdBy && `${i.createdBy} 发`].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell className="text-sm">{scopeText(i)}</TableCell>
                      <TableCell className="tabular-nums">
                        {i.used} / {i.maxUses}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.expiresAt ? formatTime(i.expiresAt).slice(0, 10) : "不限"}</TableCell>
                      <TableCell>
                        <Badge variant={state.muted ? "outline" : "secondary"}>{state.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {i.status === "active" ? (
                          <Button size="sm" variant="outline" onClick={() => copy(i)} aria-label={`复制邀请链接 ${i.code}`}>
                            <Copy /> 复制链接
                          </Button>
                        ) : null}{" "}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={save.isPending}
                          onClick={() =>
                            save.mutate(
                              { enterpriseId, id: i.id, projectId: i.projectId, projectRole: i.projectRole, orgUnitId: i.orgUnitId, maxUses: i.maxUses, expiresAt: i.expiresAt, note: i.note ?? undefined, status: i.status === "active" ? "disabled" : "active" },
                              { onSuccess: () => toast.success(i.status === "active" ? "已停用，这个码不能再用来申请" : "已重新启用"), onError: (e) => toast.error(errorMessage(e)) },
                            )
                          }
                        >
                          {i.status === "active" ? "停用" : "启用"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {reviewed.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-base font-semibold">审核记录</h2>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {(showAll ? reviewed : reviewed.slice(0, 5)).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <Badge variant={r.status === "approved" ? "secondary" : "outline"}>{r.status === "approved" ? "已通过" : "未通过"}</Badge>
                <span className="font-medium">{r.nickname}</span>
                <span className="text-muted-foreground">{r.username}</span>
                {r.reason ? <span className="text-muted-foreground">原因：{r.reason}</span> : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {r.reviewedBy} · {formatTime(r.reviewedAt)}
                </span>
              </li>
            ))}
          </ul>
          {reviewed.length > 5 && !showAll ? (
            <Button size="sm" variant="ghost" className="self-start" onClick={() => setShowAll(true)}>
              显示全部 {reviewed.length} 条
            </Button>
          ) : null}
        </section>
      ) : null}

      {creating ? <InviteDialog detail={detail} asOps={asOps} onClose={() => setCreating(false)} onCreated={copy} save={save.mutateAsync} /> : null}
      <RejectDialog
        registration={rejecting}
        pending={review.isPending}
        onClose={() => setRejecting(null)}
        onReject={(reason) =>
          rejecting &&
          review.mutate(
            { enterpriseId, id: rejecting.id, approve: false, reason },
            {
              onSuccess: () => {
                toast.success("已标为不通过");
                setRejecting(null);
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />
    </div>
  );
}

function InviteDialog({
  detail,
  asOps,
  onClose,
  onCreated,
  save,
}: {
  detail: EnterpriseDetail;
  asOps: boolean;
  onClose: () => void;
  onCreated: (invite: Invite) => void;
  save: (values: InviteInput) => Promise<Invite>;
}) {
  const projects = detail.projects.filter((p) => p.status !== "archived");
  const [projectId, setProjectId] = useState(projects.length === 1 ? String(projects[0].id) : "");
  const [role, setRole] = useState<ProjectRole>("member");
  const [orgUnitId, setOrgUnitId] = useState("");
  const [maxUses, setMaxUses] = useState("20");
  const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const roles = ENTERPRISE_ROLES.filter((r) => asOps || r !== "ent_lead");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const invite = await save({
        enterpriseId: detail.enterprise.id,
        projectId: projectId ? Number(projectId) : null,
        projectRole: projectId ? role : null,
        orgUnitId: orgUnitId ? Number(orgUnitId) : null,
        maxUses: Number(maxUses) || 20,
        // 到期日当天整天有效。
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        note: note.trim() || undefined,
      });
      onClose();
      onCreated({ ...invite, used: 0, projectName: null, orgUnitName: null, createdBy: null } as Invite);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="size-4" /> 新建邀请码
            </DialogTitle>
            <DialogDescription>凭码申请的人审核通过后成为「{detail.enterprise.shortName}」的企业成员，并按下面的设置加入项目。建好后会自动复制邀请链接。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inv-project">加入项目</FieldLabel>
              <NativeSelect id="inv-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <NativeSelectOption value="">不加入项目（以后再分派）</NativeSelectOption>
                {projects.map((p) => (
                  <NativeSelectOption key={p.id} value={String(p.id)}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {projectId ? (
              <Field>
                <FieldLabel htmlFor="inv-role">项目角色</FieldLabel>
                <NativeSelect id="inv-role" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
                  {roles.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {PROJECT_ROLE_LABELS[r]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {!asOps ? <FieldDescription>企业项目负责人由运营指定，不能用邀请码发。</FieldDescription> : null}
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="inv-dept">所属部门</FieldLabel>
              <NativeSelect id="inv-dept" value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
                <NativeSelectOption value="">不指定</NativeSelectOption>
                {detail.orgUnits.map((u) => (
                  <NativeSelectOption key={u.id} value={String(u.id)}>
                    {u.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="inv-max">名额</FieldLabel>
                <Input id="inv-max" type="number" min={1} max={500} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="inv-expires">有效到</FieldLabel>
                <Input id="inv-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="inv-note">备注</FieldLabel>
              <Input id="inv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：储能事业部新同事" maxLength={100} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={busy}>
              生成邀请码
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ registration, pending, onClose, onReject }: { registration: Registration | null; pending: boolean; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={!!registration}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>不通过：{registration?.nickname}</DialogTitle>
          <DialogDescription>原因会记入审核记录；申请人登录时会看到“没有通过审核”。</DialogDescription>
        </DialogHeader>
        <Textarea aria-label="不通过的原因" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：不是本企业员工" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || pending} onClick={() => onReject(reason.trim())}>
            不通过
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
