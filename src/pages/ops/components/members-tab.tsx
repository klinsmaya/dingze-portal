import { Ban, CirclePlay, KeyRound, ShieldCheck, ShieldOff, TriangleAlert, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PROJECT_ROLE_LABELS } from "@dingze/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/dingze/errors";
import { type EnterpriseDetail, type EnterpriseMember, opsApi } from "@/lib/dingze/ops-api";
import { useDzUsers, useOpsMutation } from "@/lib/dingze/ops-queries";
import { flattenOrgUnits } from "@/lib/dingze/org-units";

import { AccountPasswordDialog, type IssuedPassword } from "./account-password-dialog";
import { BulkAccountsDialog } from "./bulk-accounts-dialog";
import { type IssuedRow, IssuedListDialog } from "./camp-dialogs";
import { ConfirmAction } from "./confirm-action";
import { CreateAccountDialog } from "./create-account-dialog";
import { UserChecklist } from "./user-checklist";

// 成员管理分两组（2026-11-17）：企业成员是本企业自己的账号，咨询师是分派到这家企业的咨询方账号。
// 运营管理员、咨询管理员自动在所有企业里，不列出来。

const displayName = (user: { nickname: string; username: string }) => user.nickname || user.username;

/** 每个人参与了哪些项目、什么角色。 */
function useProjectRoles(detail: EnterpriseDetail) {
  return useMemo(() => {
    const map = new Map<number, string[]>();
    for (const project of detail.projects) {
      for (const m of project.members) {
        const label = m.projectRole === "member" ? project.name : `${project.name} · ${PROJECT_ROLE_LABELS[m.projectRole] ?? m.projectRole}`;
        map.set(m.userId, [...(map.get(m.userId) ?? []), label]);
      }
    }
    return map;
  }, [detail.projects]);
}

/** 企业成员：本企业的账号。开通、批量开通、设部门、重置密码、停用 / 恢复；运营还能设企业管理员。 */
export function StaffTab({ detail, asOps, open }: { detail: EnterpriseDetail; asOps: boolean; open?: "create" | "bulk" | null }) {
  const enterpriseId = detail.enterprise.id;
  const [creating, setCreating] = useState(open === "create");
  const [bulk, setBulk] = useState(open === "bulk");
  const [issuedList, setIssuedList] = useState<IssuedRow[] | null>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const reset = useOpsMutation(opsApi.resetPassword);
  const setDepartment = useOpsMutation(opsApi.setMemberDepartment);
  const setAdmin = useOpsMutation(opsApi.setEnterpriseAdmin);
  const setDisabled = useOpsMutation(opsApi.setAccountDisabled);
  const projectRoles = useProjectRoles(detail);
  const orgNodes = flattenOrgUnits(detail.orgUnits);
  const staff = detail.members.filter((m) => m.kind === "enterprise");
  const isAdmin = (user: EnterpriseMember) => user.roles.includes("dz_ent_admin");
  const activeAdmins = staff.filter((m) => isAdmin(m) && !m.disabled).length;
  // 企业管理员只能动企业成员的账号；运营都能动。
  const canManage = (user: EnterpriseMember) => asOps || !isAdmin(user);
  const fail = (error: unknown) => toast.error(errorMessage(error));

  return (
    <div className="flex flex-col gap-4">
      {activeAdmins === 0 ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>这家企业没有能用的企业管理员：没人能管成员、邀请和项目成员。{asOps ? "请开通一位，或把一位企业成员设为企业管理员。" : ""}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{staff.length} 个账号。本企业的账号能看到本企业的所有项目；要填表还得是项目成员。</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulk(true)}>
            <UsersRound /> 批量开通
          </Button>
          <Button onClick={() => setCreating(true)}>
            <UserPlus /> 添加成员
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>所属部门</TableHead>
              <TableHead className="hidden md:table-cell">参与项目</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((user) => (
              <TableRow key={user.id} className={user.disabled ? "text-muted-foreground" : undefined}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">
                    {displayName(user)}
                    {isAdmin(user) ? <Badge variant="secondary">企业管理员</Badge> : null}
                    {user.disabled ? <Badge variant="outline">已停用</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{user.username}</div>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={`${displayName(user)} 所属部门`}
                    value={user.orgUnitId ?? ""}
                    disabled={setDepartment.isPending || orgNodes.length === 0}
                    onChange={(e) =>
                      setDepartment.mutate(
                        { enterpriseId, userId: user.id, orgUnitId: e.target.value ? Number(e.target.value) : null },
                        { onSuccess: () => toast.success(`${displayName(user)} 的部门已更新`), onError: fail },
                      )
                    }
                  >
                    <NativeSelectOption value="">{orgNodes.length ? "（未指定）" : "还没有部门"}</NativeSelectOption>
                    {orgNodes.map((n) => (
                      <NativeSelectOption key={n.id} value={n.id}>
                        {"　".repeat(n.depth)}
                        {n.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{projectRoles.get(user.id)?.join("；") ?? "未加入项目（只读查看）"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {canManage(user) ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="sm">
                            <KeyRound /> 重置密码
                          </Button>
                        }
                        title={`重置 ${displayName(user)} 的密码？`}
                        description="原密码立即失效，新密码只显示一次；本人下次登录要先改密码。"
                        confirmLabel="重置"
                        onConfirm={() =>
                          reset.mutateAsync(
                            { userId: user.id, enterpriseId },
                            { onSuccess: (result) => setIssued({ username: user.username, nickname: user.nickname, password: result.initialPassword, reason: "reset" }), onError: fail },
                          )
                        }
                      />
                    ) : null}
                    {asOps ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="sm">
                            {isAdmin(user) ? <ShieldOff /> : <ShieldCheck />} {isAdmin(user) ? "取消管理员" : "设为管理员"}
                          </Button>
                        }
                        title={isAdmin(user) ? `取消 ${displayName(user)} 的企业管理员？` : `把 ${displayName(user)} 设为企业管理员？`}
                        description={isAdmin(user) ? "取消后他是普通的企业成员；在项目里的角色不变。" : "企业管理员能管本企业的成员、邀请和项目成员，可以新建项目。"}
                        confirmLabel={isAdmin(user) ? "取消管理员" : "设为管理员"}
                        onConfirm={() =>
                          setAdmin.mutateAsync(
                            { enterpriseId, userId: user.id, admin: !isAdmin(user) },
                            { onSuccess: () => toast.success(isAdmin(user) ? "已取消企业管理员" : "已设为企业管理员"), onError: fail },
                          )
                        }
                      />
                    ) : null}
                    {canManage(user) ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="sm" className={user.disabled ? undefined : "text-destructive"}>
                            {user.disabled ? <CirclePlay /> : <Ban />} {user.disabled ? "恢复" : "停用"}
                          </Button>
                        }
                        title={user.disabled ? `恢复 ${displayName(user)} 的账号？` : `停用 ${displayName(user)} 的账号？`}
                        description={user.disabled ? "恢复后可以照常登录，原来的项目成员身份都还在。" : "停用后不能登录；账号、已填的内容和项目成员身份都保留，随时可以恢复。"}
                        confirmLabel={user.disabled ? "恢复" : "停用"}
                        destructive={!user.disabled}
                        onConfirm={() =>
                          setDisabled.mutateAsync(
                            { enterpriseId, userId: user.id, disabled: !user.disabled },
                            { onSuccess: () => toast.success(user.disabled ? "已恢复" : "已停用"), onError: fail },
                          )
                        }
                      />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateAccountDialog
        open={creating}
        onOpenChange={setCreating}
        title={`为 ${detail.enterprise.shortName} 添加成员`}
        roles={asOps ? ["dz_ent_member", "dz_ent_admin"] : ["dz_ent_member"]}
        enterprise={{ id: enterpriseId, projects: detail.projects, orgUnits: detail.orgUnits }}
        onCreated={(account) => setIssued({ username: account.user.username, nickname: account.user.nickname, password: account.initialPassword, reason: "created" })}
      />
      <BulkAccountsDialog open={bulk} onClose={() => setBulk(false)} enterpriseId={enterpriseId} projects={detail.projects} onIssued={setIssuedList} />
      <IssuedListDialog title="批量开通结果" rows={issuedList} onClose={() => setIssuedList(null)} />
      <AccountPasswordDialog issued={issued} onClose={() => setIssued(null)} />
    </div>
  );
}

/** 咨询师：分派到这家企业的咨询方账号。分派和取消分派只有运营能做；进哪个项目在项目“成员”里定。 */
export function ConsultantsTab({ detail, asOps }: { detail: EnterpriseDetail; asOps: boolean }) {
  const enterpriseId = detail.enterprise.id;
  const [adding, setAdding] = useState(false);
  const remove = useOpsMutation(opsApi.removeEnterpriseMember);
  const projectRoles = useProjectRoles(detail);
  const consultants = detail.members.filter((m) => m.kind === "consulting");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {consultants.length} 位咨询师分派到这家企业。{asOps ? "进哪个项目在项目的“成员”里定。" : "咨询师由咨询机构的运营分派。"}
        </p>
        {asOps ? (
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> 分派咨询师
          </Button>
        ) : null}
      </div>

      {consultants.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">还没有咨询师。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>参与项目</TableHead>
                {asOps ? <TableHead className="text-right">操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultants.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      {displayName(user)}
                      {user.disabled ? <Badge variant="outline">已停用</Badge> : null}
                    </div>
                    {asOps ? <div className="text-xs text-muted-foreground">{user.username}</div> : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{projectRoles.get(user.id)?.join("；") ?? "还没进项目"}</TableCell>
                  {asOps ? (
                    <TableCell className="text-right">
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <UserMinus /> 取消分派
                          </Button>
                        }
                        title={`取消 ${displayName(user)} 在这家企业的分派？`}
                        description="同时把他移出本企业的各个项目，之后看不到这家企业的任何数据；他的账号和批注、修订记录都保留。"
                        confirmLabel="取消分派"
                        destructive
                        onConfirm={() =>
                          remove.mutateAsync({ enterpriseId, userId: user.id }, { onSuccess: () => toast.success("已取消分派"), onError: (error) => toast.error(errorMessage(error)) })
                        }
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {asOps ? <AssignConsultantsDialog open={adding} onOpenChange={setAdding} detail={detail} /> : null}
    </div>
  );
}

function AssignConsultantsDialog({ open, onOpenChange, detail }: { open: boolean; onOpenChange: (open: boolean) => void; detail: EnterpriseDetail }) {
  const [selected, setSelected] = useState<number[]>([]);
  const users = useDzUsers("dz_consultant", undefined, open);
  const add = useOpsMutation(opsApi.addEnterpriseMembers);
  const inEnterprise = new Set(detail.members.map((m) => m.id));
  const candidates = (users.data ?? []).filter((u) => !inEnterprise.has(u.id) && !u.disabled);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>分派咨询师</DialogTitle>
          <DialogDescription>只列咨询方的账号。企业自己的人请在“企业成员”里添加。</DialogDescription>
        </DialogHeader>
        <UserChecklist users={candidates} selected={selected} onChange={setSelected} emptyText="咨询师都已经分派到这家企业；新的咨询师到“咨询团队”开通" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!selected.length || add.isPending}
            onClick={() =>
              add.mutate(
                { enterpriseId: detail.enterprise.id, userIds: selected },
                {
                  onSuccess: () => {
                    toast.success(`已分派 ${selected.length} 位咨询师`);
                    setSelected([]);
                    onOpenChange(false);
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            分派
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
