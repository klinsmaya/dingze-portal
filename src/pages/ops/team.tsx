import { KeyRound, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCanAccess } from "@nocobase/portal-sdk/acl";
import { errorMessage } from "@/lib/dingze/errors";
import { type DzUser, SYSTEM_ROLE_LABELS, type SystemRole, opsApi } from "@/lib/dingze/ops-api";
import { useDzUsers, useOpsMutation } from "@/lib/dingze/ops-queries";

import { AccountPasswordDialog, type IssuedPassword } from "./components/account-password-dialog";
import { ConfirmAction } from "./components/confirm-action";
import { CreateAccountDialog } from "./components/create-account-dialog";
import { OpsPageHeader } from "./components/page-header";

const TEAM_ROLES: SystemRole[] = ["dz_consultant", "dz_consult_admin", "dz_ops"];

export default function TeamPage() {
  const [filter, setFilter] = useState<SystemRole | "all">("all");
  const users = useDzUsers();
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const reset = useOpsMutation(opsApi.resetPassword);
  const isConsultAdmin = useCanAccess({ roles: { anyOf: ["dz_consult_admin"] } });

  const team = (users.data ?? []).filter((u) =>
    u.roles.some((r) => (filter === "all" ? TEAM_ROLES.includes(r) : r === filter))
  );
  const creatableRoles: SystemRole[] = isConsultAdmin ? TEAM_ROLES : ["dz_consultant"];

  const resetPassword = (user: DzUser) =>
    reset.mutateAsync(
      { userId: user.id },
      {
        onSuccess: (result) =>
          setIssued({ username: user.username, nickname: user.nickname, password: result.initialPassword, reason: "reset" }),
        onError: (error) => toast.error(errorMessage(error)),
      }
    );

  return (
    <div className="flex flex-col gap-6">
      <OpsPageHeader
        title="咨询团队"
        description="咨询师、咨询管理员和运营管理员。咨询师需要加入企业空间、再加入项目，才能看到企业数据。"
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus /> 开通账号
          </Button>
        }
      />

      <ToggleGroup
        value={[filter]}
        onValueChange={(value) => setFilter((value[0] as SystemRole | "all" | undefined) ?? "all")}
        variant="outline"
        className="self-start"
      >
        <ToggleGroupItem value="all">全部</ToggleGroupItem>
        {TEAM_ROLES.map((r) => (
          <ToggleGroupItem key={r} value={r}>
            {SYSTEM_ROLE_LABELS[r]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {users.error ? (
        <Alert variant="destructive">
          <AlertTitle>账号加载失败</AlertTitle>
          <AlertDescription>{errorMessage(users.error)}</AlertDescription>
        </Alert>
      ) : users.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>系统角色</TableHead>
                <TableHead className="hidden md:table-cell">联系方式</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    暂无账号
                  </TableCell>
                </TableRow>
              ) : (
                team.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.nickname || user.username}</div>
                      <div className="text-xs text-muted-foreground">{user.username}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((r) => (
                          <Badge key={r} variant="outline">
                            {SYSTEM_ROLE_LABELS[r]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {[user.phone, user.email].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateAccountDialog
        open={creating}
        onOpenChange={setCreating}
        title="开通咨询团队账号"
        description={isConsultAdmin ? "咨询管理员可以开通全部三类账号。" : "运营管理员可以开通咨询师账号。"}
        roles={creatableRoles}
        onCreated={(account) =>
          setIssued({
            username: account.user.username,
            nickname: account.user.nickname,
            password: account.initialPassword,
            reason: "created",
          })
        }
      />
      <AccountPasswordDialog issued={issued} onClose={() => setIssued(null)} />
    </div>
  );
}
