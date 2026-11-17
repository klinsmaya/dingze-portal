import { PROJECT_ROLE_LABELS, type ProjectRole, memberChangeBlocked } from "@dingze/shared";
import { TriangleAlert, UserMinus } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/dingze/errors";
import { type ProjectMembers, opsApi } from "@/lib/dingze/ops-api";
import { useOpsMutation, useProjectMembers } from "@/lib/dingze/ops-queries";
import { memberWarnings } from "@/lib/dingze/project-members";

import { ConfirmAction } from "../../ops/components/confirm-action";

const TIER_NOTES = {
  ops: "你可以加减项目成员、更换企业项目负责人、分派咨询师。",
  entAdmin: "你可以加减项目成员、更换企业项目负责人；咨询师由运营分派。",
  lead: "你可以把本企业的成员加进项目或移出项目；更换负责人请找企业管理员。",
} as const;

const ENTERPRISE_ROLES: ProjectRole[] = ["ent_lead", "member"];

/**
 * 项目成员：运营、本企业管理员、企业项目负责人三级都从这里管（各级能动什么由服务端定，这里照着显示）。
 * 每一处改动马上生效，不用再点保存。运营的「项目与分派」和项目总览用的是同一个弹窗。
 */
export function ProjectMembersDialog({ projectId, onClose }: { projectId: number | null; onClose: () => void }) {
  const query = useProjectMembers(projectId ?? undefined);
  const data = projectId ? query.data : undefined;
  return (
    <Dialog open={!!projectId} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>项目成员{data ? ` · ${data.projectName}` : ""}</DialogTitle>
          {data?.tier ? <DialogDescription>{TIER_NOTES[data.tier]}</DialogDescription> : null}
        </DialogHeader>
        {query.error ? (
          <p className="text-sm text-destructive">{errorMessage(query.error)}</p>
        ) : data ? (
          <MembersBody data={data} />
        ) : (
          <Skeleton className="h-48 rounded-lg" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MembersBody({ data }: { data: ProjectMembers }) {
  const setMembers = useOpsMutation(opsApi.setProjectMembers);
  const removeMember = useOpsMutation(opsApi.removeProjectMember);
  const busy = setMembers.isPending || removeMember.isPending;
  const { tier, projectId } = data;
  const deptName = (id: number | null) => data.orgUnits.find((u) => u.id === id)?.name ?? "—";
  const fail = (error: unknown) => toast.error(errorMessage(error));

  const setRole = (userId: number, projectRole: ProjectRole, done: string) =>
    setMembers.mutate({ projectId, members: [{ userId, projectRole }] }, { onSuccess: () => toast.success(done), onError: fail });

  const staff = data.candidates.filter((c) => c.kind === "enterprise");
  const consultants = data.candidates.filter((c) => c.kind === "consulting");
  const canAssignConsultant = data.assignable.includes("consultant");
  const warnings = memberWarnings(data.members, data.service);
  // 企业侧成员在前（负责人最前），咨询师在后。
  const order: ProjectRole[] = ["ent_lead", "member", "consultant"];
  const rows = [...data.members].sort((a, b) => order.indexOf(a.projectRole) - order.indexOf(b.projectRole));

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>成员</TableHead>
              <TableHead>项目角色</TableHead>
              <TableHead className="hidden sm:table-cell">所属部门</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  项目里还没有成员
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((m) => {
              const enterpriseSide = m.projectRole !== "consultant";
              // 这一行能改成哪些角色：企业侧的人只在负责人和项目成员之间换。
              const options = enterpriseSide ? ENTERPRISE_ROLES.filter((r) => r === m.projectRole || !memberChangeBlocked(tier, m.projectRole, r)) : [];
              const canRemove = !memberChangeBlocked(tier, m.projectRole, null);
              return (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="font-medium">{m.nickname}</div>
                    <div className="text-xs text-muted-foreground">{m.username}</div>
                  </TableCell>
                  <TableCell>
                    {options.length > 1 ? (
                      <NativeSelect
                        aria-label={`${m.nickname} 的项目角色`}
                        value={m.projectRole}
                        disabled={busy}
                        onChange={(e) => setRole(m.userId, e.target.value as ProjectRole, `${m.nickname} 已改为${PROJECT_ROLE_LABELS[e.target.value as ProjectRole]}`)}
                      >
                        {options.map((role) => (
                          <NativeSelectOption key={role} value={role}>
                            {PROJECT_ROLE_LABELS[role]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : (
                      <span className="text-sm">{PROJECT_ROLE_LABELS[m.projectRole]}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{enterpriseSide ? deptName(m.orgUnitId) : "咨询方"}</TableCell>
                  <TableCell>
                    {canRemove ? (
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`把 ${m.nickname} 移出项目`} disabled={busy}>
                            <UserMinus />
                          </Button>
                        }
                        title={`把 ${m.nickname} 移出这个项目？`}
                        description={enterpriseSide ? "移出后仍能只读查看本企业的项目，不能再填写；账号和已填的内容都保留。" : "移出后这位咨询师看不到这个项目。"}
                        confirmLabel="移出"
                        destructive
                        onConfirm={() => removeMember.mutateAsync({ projectId, userId: m.userId }, { onSuccess: () => toast.success(`已把 ${m.nickname} 移出项目`), onError: fail })}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {tier ? (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="添加项目成员"
            value=""
            disabled={busy || staff.length === 0}
            onChange={(e) => {
              const user = staff.find((c) => c.id === Number(e.target.value));
              if (user) setRole(user.id, "member", `已把 ${user.nickname} 加进项目`);
            }}
          >
            <NativeSelectOption value="">{staff.length ? "＋ 添加项目成员…" : "本企业的账号都已在项目里"}</NativeSelectOption>
            {staff.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.nickname}（{c.username}）
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {canAssignConsultant ? (
            <NativeSelect
              aria-label="分派咨询师"
              value=""
              disabled={busy || consultants.length === 0}
              onChange={(e) => {
                const user = consultants.find((c) => c.id === Number(e.target.value));
                if (user) setRole(user.id, "consultant", `已分派咨询师 ${user.nickname}`);
              }}
            >
              <NativeSelectOption value="">{consultants.length ? "＋ 分派咨询师…" : "没有可分派的咨询师"}</NativeSelectOption>
              {consultants.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.nickname}（{c.username}）
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : null}
        </div>
      ) : null}

      {tier ? (
        <p className="text-xs text-muted-foreground">
          {tier === "lead" ? (
            "这里只能选本企业已有的账号。还没有账号的同事，请企业管理员先添加或发邀请码。"
          ) : (
            <>
              这里只能选本企业已有的账号。还没有账号的同事，先去
              <Link className="mx-1 underline underline-offset-4" to={tier === "ops" ? `/ops/enterprises/${data.enterpriseId}?tab=staff` : "/enterprise/members?open=create"}>
                添加成员
              </Link>
              或
              <Link className="mx-1 underline underline-offset-4" to={tier === "ops" ? `/ops/enterprises/${data.enterpriseId}?tab=invites` : "/enterprise/invites"}>
                发邀请码
              </Link>
              。
            </>
          )}
        </p>
      ) : null}

      {warnings.length ? (
        <Alert>
          <TriangleAlert />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
