import { KeyRound, UserMinus, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PROJECT_ROLE_LABELS } from "@dingze/shared";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/dingze/errors";
import { type DzUser, type EnterpriseDetail, SYSTEM_ROLE_LABELS, opsApi } from "@/lib/dingze/ops-api";
import { useDzUsers, useOpsMutation } from "@/lib/dingze/ops-queries";

import { AccountPasswordDialog, type IssuedPassword } from "./account-password-dialog";
import { ConfirmAction } from "./confirm-action";
import { CreateAccountDialog } from "./create-account-dialog";
import { UserChecklist } from "./user-checklist";

/** Accounts in the enterprise's space: enterprise people, its consultants and ops. */
export function MembersTab({ detail, asOps }: { detail: EnterpriseDetail; asOps: boolean }) {
  const enterpriseId = detail.enterprise.id;
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const reset = useOpsMutation(opsApi.resetPassword);
  const remove = useOpsMutation(opsApi.removeEnterpriseMember);

  const projectRoles = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const project of detail.projects) {
      for (const m of project.members) {
        const label = `${project.name} · ${PROJECT_ROLE_LABELS[m.projectRole] ?? m.projectRole}`;
        map.set(m.userId, [...(map.get(m.userId) ?? []), label]);
      }
    }
    return map;
  }, [detail.projects]);

  const canReset = (user: DzUser) =>
    asOps || user.roles.every((r) => r === "dz_ent_member");

  const resetPassword = (user: DzUser) =>
    reset.mutateAsync(
      { userId: user.id, enterpriseId },
      {
        onSuccess: (result) =>
          setIssued({ username: user.username, nickname: user.nickname, password: result.initialPassword, reason: "reset" }),
        onError: (error) => toast.error(errorMessage(error)),
      }
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <Users className="mr-1 inline size-4 align-text-bottom" />
          {detail.members.length} 个账号可以进入这家企业的空间；进入具体项目还需要在项目成员里添加。
        </p>
        <div className="flex gap-2">
          {asOps ? (
            <Button variant="outline" onClick={() => setAdding(true)}>
              加入已有账号
            </Button>
          ) : null}
          <Button onClick={() => setCreating(true)}>
            <UserPlus /> 开通成员账号
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>系统角色</TableHead>
              <TableHead className="hidden md:table-cell">参与项目</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.members.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.nickname || user.username}</div>
                  <div className="text-xs text-muted-foreground">{user.username}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length ? (
                      user.roles.map((r) => (
                        <Badge key={r} variant="outline">
                          {SYSTEM_ROLE_LABELS[r]}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">系统账号</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {projectRoles.get(user.id)?.join("；") ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {user.roles.length && canReset(user) ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="sm">
                            <KeyRound /> 重置密码
                          </Button>
                        }
                        title={`重置 ${user.nickname || user.username} 的密码？`}
                        description="原密码立即失效，新密码只显示一次。"
                        confirmLabel="重置"
                        onConfirm={() => resetPassword(user)}
                      />
                    ) : null}
                    {asOps ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <UserMinus /> 移出
                          </Button>
                        }
                        title={`把 ${user.nickname || user.username} 移出这家企业？`}
                        description="移出后该账号看不到这家企业的任何数据。仍是项目成员的账号需要先从项目中移除。"
                        confirmLabel="移出"
                        destructive
                        onConfirm={() =>
                          remove.mutateAsync(
                            { enterpriseId, userId: user.id },
                            {
                              onSuccess: () => toast.success("已移出"),
                              onError: (error) => toast.error(errorMessage(error)),
                            }
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
        title={`为 ${detail.enterprise.shortName} 开通成员账号`}
        description="账号会直接加入本企业空间。"
        roles={asOps ? ["dz_ent_member", "dz_ent_admin"] : ["dz_ent_member"]}
        enterpriseId={enterpriseId}
        onCreated={(account) =>
          setIssued({
            username: account.user.username,
            nickname: account.user.nickname,
            password: account.initialPassword,
            reason: "created",
          })
        }
      />
      {asOps ? (
        <AddExistingDialog open={adding} onOpenChange={setAdding} detail={detail} />
      ) : null}
      <AccountPasswordDialog issued={issued} onClose={() => setIssued(null)} />
    </div>
  );
}

function AddExistingDialog({
  open,
  onOpenChange,
  detail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: EnterpriseDetail;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const users = useDzUsers(undefined, undefined, open);
  const add = useOpsMutation(opsApi.addEnterpriseMembers);
  const inSpace = new Set(detail.members.map((m) => m.id));
  const candidates = (users.data ?? []).filter((u) => !inSpace.has(u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>加入已有账号</DialogTitle>
          <DialogDescription>常用于把咨询师、运营管理员加入这家企业的空间。</DialogDescription>
        </DialogHeader>
        <UserChecklist users={candidates} selected={selected} onChange={setSelected} />
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
                    toast.success(`已加入 ${selected.length} 个账号`);
                    setSelected([]);
                    onOpenChange(false);
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                }
              )
            }
          >
            加入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
