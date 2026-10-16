import { SERVICE_LABELS } from "@dingze/shared";
import { ArrowRight, FolderKanban, Pencil, Plus, Trash2, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useGetIdentity } from "@refinedev/core";
import { toast } from "sonner";

import { PROJECT_ROLE_LABELS, type ProjectRole } from "@dingze/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/dingze/errors";
import { type EnterpriseDetail, type OpsProject, opsApi } from "@/lib/dingze/ops-api";
import { useOpsMutation } from "@/lib/dingze/ops-queries";
import { flattenOrgUnits, orgUnitPath } from "@/lib/dingze/org-units";
import { type MemberRow, diffMembers, memberWarnings } from "@/lib/dingze/project-members";

import { SCENE_LABELS, SCHEDULE_LABELS } from "./labels";

type ProjectWithMembers = EnterpriseDetail["projects"][number];

const ENTERPRISE_PROJECT_ROLES: ProjectRole[] = ["ent_lead", "dept_head", "member", "readonly"];
const CONSULTANT_PROJECT_ROLES: ProjectRole[] = ["lead_consultant", "co_consultant"];

export function ProjectsTab({ detail, asOps = true }: { detail: EnterpriseDetail; asOps?: boolean }) {
  const [editing, setEditing] = useState<ProjectWithMembers | "new" | null>(null);
  const [staffing, setStaffing] = useState<ProjectWithMembers | null>(null);
  const [creatingOwn, setCreatingOwn] = useState(false);
  const allowSelf = !!detail.enterprise.allowSelfProject;
  const update = useOpsMutation(opsApi.updateEnterprise);

  return (
    <div className="flex flex-col gap-4">
      {asOps ? (
        <label className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
          <Switch
            checked={allowSelf}
            disabled={update.isPending}
            onCheckedChange={(on) =>
              update.mutate(
                { enterpriseId: detail.enterprise.id, allowSelfProject: !!on },
                { onSuccess: () => toast.success(on ? "已允许企业管理员自建项目" : "已关闭企业自建项目"), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
            aria-label="允许企业管理员自建项目"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">允许企业管理员自建项目</span>
            <span className="block text-xs text-muted-foreground">打开后，企业管理员可以在“本企业 › 项目”里自己建项目（企业内训 · 自助），只能分派本企业账号。需要陪跑时由运营改服务方式并分派咨询师。</span>
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          一个项目对应一轮定三责；同一企业可以按年度或专题开多个项目。
          {asOps ? "" : allowSelf ? "新项目是企业内训 · 自助；建好后可以“从已有项目带入”往年的表。" : "自建项目还没开通，需要新项目请联系运营。"}
        </p>
        {asOps ? (
          <Button onClick={() => setEditing("new")}>
            <Plus /> 新建项目
          </Button>
        ) : allowSelf ? (
          <Button onClick={() => setCreatingOwn(true)}>
            <Plus /> 新建项目
          </Button>
        ) : null}
      </div>

      {detail.projects.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle>还没有项目</EmptyTitle>
            <EmptyDescription>新建项目并指定主咨询师、企业项目负责人后，双方就能在“我的项目”里看到它。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        detail.projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardDescription>
                {project.year} 年度 · {SCENE_LABELS[project.scene]} · {SERVICE_LABELS[project.service ?? "guided"]} ·
                重点工作 {project.keyProjectLevel} 级 · 计划{SCHEDULE_LABELS[project.scheduleScale]}
              </CardDescription>
              <CardTitle className="flex items-center gap-2 text-lg text-brand">
                {project.name}
                {project.status === "archived" ? <Badge variant="outline">已归档</Badge> : null}
              </CardTitle>
              <CardAction className="flex flex-wrap gap-1">
                {asOps ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(project)}>
                      <Pencil /> 编辑
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStaffing(project)}>
                      <Users /> 成员
                    </Button>
                  </>
                ) : null}
                <Button variant="outline" size="sm" nativeButton={false} render={<Link to={`/projects/${project.id}/overview`} />}>
                  进入 <ArrowRight />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {memberWarnings(project.members, project.service).map((w) => (
                <p key={w} className="flex items-center gap-1.5 text-xs text-status-stale-foreground">
                  <TriangleAlert className="size-3.5" /> {w}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                {project.members.map((m) => (
                  <Badge key={m.userId} variant="secondary" className="font-normal">
                    {m.user?.nickname || m.user?.username || `#${m.userId}`} · {PROJECT_ROLE_LABELS[m.projectRole]}
                    {m.orgUnitId ? ` · ${orgUnitPath(detail.orgUnits, m.orgUnitId)}` : ""}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {asOps ? (
        <>
          <ProjectDialog target={editing} detail={detail} onClose={() => setEditing(null)} />
          <MembersDialog project={staffing} detail={detail} onClose={() => setStaffing(null)} />
        </>
      ) : (
        <OwnProjectDialog open={creatingOwn} detail={detail} onClose={() => setCreatingOwn(false)} />
      )}
    </div>
  );
}

type ProjectDraft = Pick<OpsProject, "name" | "year" | "scene" | "service" | "primaryExpression" | "keyProjectLevel" | "scheduleScale" | "status">;

function draftFor(target: ProjectWithMembers | "new"): ProjectDraft {
  if (target !== "new") return target;
  const year = new Date().getFullYear();
  return {
    name: `${year} 年度战略落地`,
    year,
    scene: "camp",
    service: "guided",
    primaryExpression: "sixfold",
    keyProjectLevel: 2,
    scheduleScale: "month",
    status: "active",
  };
}

function ProjectDialog({
  target,
  detail,
  onClose,
}: {
  target: ProjectWithMembers | "new" | null;
  detail: EnterpriseDetail;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [shown, setShown] = useState<typeof target>(null);
  if (target !== shown) {
    setShown(target);
    setDraft(target ? draftFor(target) : null);
  }
  const create = useOpsMutation(opsApi.createProject);
  const update = useOpsMutation(opsApi.updateProject);
  const isNew = target === "new";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !target) return;
    const values = { ...draft, name: draft.name.trim() };
    const done = {
      onSuccess: () => {
        toast.success(isNew ? "项目已创建，下一步请设置成员" : "已保存");
        onClose();
      },
      onError: (error: unknown) => toast.error(errorMessage(error)),
    };
    if (target === "new") create.mutate({ enterpriseId: detail.enterprise.id, ...values }, done);
    else update.mutate({ projectId: target.id, ...values }, done);
  };

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => draft && setDraft({ ...draft, [key]: value });

  return (
    <Dialog open={!!target} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? "新建项目" : "编辑项目"}</DialogTitle>
            <DialogDescription>{detail.enterprise.name}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <Field>
                  <FieldLabel htmlFor="project-name">项目名称</FieldLabel>
                  <Input id="project-name" value={draft.name} onChange={(e) => set("name", e.target.value)} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="project-year">年度</FieldLabel>
                  <Input
                    id="project-year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={draft.year}
                    onChange={(e) => set("year", Number(e.target.value))}
                    required
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField id="project-scene" label="场景" value={draft.scene} options={SCENE_LABELS} onChange={(v) => set("scene", v)} />
                <SelectField id="project-service" label="服务方式" value={draft.service ?? "guided"} options={SERVICE_LABELS} onChange={(v) => set("service", v)} />
                <SelectField
                  id="project-level"
                  label="重点工作层级"
                  value={String(draft.keyProjectLevel) as "1" | "2"}
                  options={{ "1": "一级", "2": "两级" }}
                  onChange={(v) => set("keyProjectLevel", Number(v) as 1 | 2)}
                />
                <SelectField
                  id="project-schedule"
                  label="行动计划粒度"
                  value={draft.scheduleScale}
                  options={SCHEDULE_LABELS}
                  onChange={(v) => set("scheduleScale", v)}
                />
              </div>
              {!isNew ? (
                <SelectField
                  id="project-status"
                  label="状态"
                  value={draft.status}
                  options={{ active: "进行中", archived: "已归档" }}
                  onChange={(v) => set("status", v)}
                  description="归档后成员仍可查看，但项目不再出现在待办里。"
                />
              ) : null}
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {isNew ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  description,
}: {
  id: string;
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
  description?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} className="w-full" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {(Object.entries(options) as [T, string][]).map(([k, text]) => (
          <NativeSelectOption key={k} value={k}>
            {text}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

function MembersDialog({
  project,
  detail,
  onClose,
}: {
  project: ProjectWithMembers | null;
  detail: EnterpriseDetail;
  onClose: () => void;
}) {
  const saved: MemberRow[] = (project?.members ?? []).map((m) => ({
    userId: m.userId,
    projectRole: m.projectRole,
    orgUnitId: m.orgUnitId,
  }));
  const [rows, setRows] = useState<MemberRow[]>(saved);
  const [shown, setShown] = useState<ProjectWithMembers | null>(null);
  if (project !== shown) {
    setShown(project);
    setRows(saved);
  }
  const [pending, setPending] = useState(false);
  const setMembers = useOpsMutation(opsApi.setProjectMembers);
  const removeMember = useOpsMutation(opsApi.removeProjectMember);
  const orgNodes = flattenOrgUnits(detail.orgUnits);
  const available = detail.members.filter((m) => m.roles.length > 0 && !rows.some((r) => r.userId === m.id));
  const isConsultantAccount = (userId: number) =>
    detail.members.find((m) => m.id === userId)?.roles.some((r) => r === "dz_consultant" || r === "dz_consult_admin") ?? false;

  const update = (index: number, patch: Partial<MemberRow>) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const addRow = (userId: number) =>
    setRows([
      ...rows,
      { userId, projectRole: isConsultantAccount(userId) ? "co_consultant" : "member", orgUnitId: null },
    ]);

  const save = async () => {
    if (!project) return;
    const { removed, upserts } = diffMembers(saved, rows);
    setPending(true);
    try {
      // Upsert first so a new lead consultant exists before the old one is removed.
      if (upserts.length) await setMembers.mutateAsync({ projectId: project.id, members: upserts });
      for (const userId of removed) await removeMember.mutateAsync({ projectId: project.id, userId });
      toast.success("项目成员已更新");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const nameOf = (userId: number) => {
    const user = detail.members.find((m) => m.id === userId);
    return user ? user.nickname || user.username : `#${userId}`;
  };
  const warnings = memberWarnings(rows, project?.service);

  return (
    <Dialog open={!!project} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>项目成员 · {project?.name}</DialogTitle>
          <DialogDescription>项目角色决定在这个项目里能做什么；只有企业项目负责人可以确认定版。</DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>成员</TableHead>
                <TableHead>项目角色</TableHead>
                <TableHead>所属部门</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const consultant = isConsultantAccount(row.userId);
                return (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{nameOf(row.userId)}</TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={`${nameOf(row.userId)} 的项目角色`}
                        value={row.projectRole}
                        onChange={(e) => update(index, { projectRole: e.target.value as ProjectRole })}
                      >
                        {(consultant ? CONSULTANT_PROJECT_ROLES : ENTERPRISE_PROJECT_ROLES).map((role) => (
                          <NativeSelectOption key={role} value={role}>
                            {PROJECT_ROLE_LABELS[role]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      {consultant ? (
                        <span className="text-xs text-muted-foreground">咨询方</span>
                      ) : (
                        <NativeSelect
                          aria-label={`${nameOf(row.userId)} 的部门`}
                          value={row.orgUnitId ?? ""}
                          onChange={(e) => update(index, { orgUnitId: e.target.value ? Number(e.target.value) : null })}
                        >
                          <NativeSelectOption value="">（未指定）</NativeSelectOption>
                          {orgNodes.map((n) => (
                            <NativeSelectOption key={n.id} value={n.id}>
                              {"　".repeat(n.depth)}
                              {n.name}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`移除 ${nameOf(row.userId)}`}
                        onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="添加成员"
            value=""
            onChange={(e) => e.target.value && addRow(Number(e.target.value))}
            disabled={available.length === 0}
          >
            <NativeSelectOption value="">
              {available.length ? "＋ 从企业空间添加成员…" : "企业空间里的账号都已加入"}
            </NativeSelectOption>
            {available.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.nickname || m.username}（{m.username}）
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="text-xs text-muted-foreground">不在列表里的人，先到“成员”里开通账号或加入企业。</span>
        </div>

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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "保存中…" : "保存成员"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 企业管理员自建项目（运营打开开关后）：企业内训 · 自助；只列本企业账号，只能分派企业侧角色，
 * 默认把自己设为企业项目负责人。建好后直接进项目并打开“从已有项目带入”。
 */
function OwnProjectDialog({ open, detail, onClose }: { open: boolean; detail: EnterpriseDetail; onClose: () => void }) {
  const { data: me } = useGetIdentity<{ id: number }>();
  const navigate = useNavigate();
  const year = new Date().getFullYear() + 1;
  const [name, setName] = useState(`${year} 年度战略落地`);
  const [projectYear, setProjectYear] = useState(year);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(`${year} 年度战略落地`);
      setProjectYear(year);
      setRows(me?.id ? [{ userId: me.id, projectRole: "ent_lead", orgUnitId: null }] : []);
    }
  }
  const create = useOpsMutation(opsApi.createOwnProject);
  const orgNodes = flattenOrgUnits(detail.orgUnits);
  const staff = detail.members.filter((m) => m.roles.some((r) => r === "dz_ent_admin" || r === "dz_ent_member"));
  const available = staff.filter((m) => !rows.some((r) => r.userId === m.id));
  const nameOf = (userId: number) => {
    const user = detail.members.find((m) => m.id === userId);
    return user ? user.nickname || user.username : `#${userId}`;
  };
  const update = (index: number, patch: Partial<MemberRow>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const hasLead = rows.some((r) => r.projectRole === "ent_lead");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      { enterpriseId: detail.enterprise.id, name: name.trim(), year: projectYear, members: rows },
      {
        onSuccess: (project) => {
          toast.success("项目已建好");
          onClose();
          // 自己在项目里就直接进去，打开“从已有项目带入”；否则留在本页。
          if (me?.id && rows.some((r) => r.userId === me.id)) navigate(`/projects/${project.id}/overview${rows.some((r) => r.userId === me.id && r.projectRole === "ent_lead") ? "?import=1" : ""}`);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>{detail.enterprise.name} · 企业内训 · 自助。建好后可以从已有项目带入往年的表。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field>
                <FieldLabel htmlFor="own-project-name">项目名称</FieldLabel>
                <Input id="own-project-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="own-project-year">年度</FieldLabel>
                <Input id="own-project-year" type="number" min={2000} max={2100} value={projectYear} onChange={(e) => setProjectYear(Number(e.target.value))} required />
              </Field>
            </div>
          </FieldGroup>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>成员</TableHead>
                  <TableHead>项目角色</TableHead>
                  <TableHead>所属部门</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{nameOf(row.userId)}</TableCell>
                    <TableCell>
                      <NativeSelect aria-label={`${nameOf(row.userId)} 的项目角色`} value={row.projectRole} onChange={(e) => update(index, { projectRole: e.target.value as ProjectRole })}>
                        {ENTERPRISE_PROJECT_ROLES.map((role) => (
                          <NativeSelectOption key={role} value={role}>
                            {PROJECT_ROLE_LABELS[role]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <NativeSelect aria-label={`${nameOf(row.userId)} 的部门`} value={row.orgUnitId ?? ""} onChange={(e) => update(index, { orgUnitId: e.target.value ? Number(e.target.value) : null })}>
                        <NativeSelectOption value="">（未指定）</NativeSelectOption>
                        {orgNodes.map((n) => (
                          <NativeSelectOption key={n.id} value={n.id}>
                            {"　".repeat(n.depth)}
                            {n.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`移除 ${nameOf(row.userId)}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect aria-label="添加成员" value="" onChange={(e) => e.target.value && setRows([...rows, { userId: Number(e.target.value), projectRole: "member", orgUnitId: null }])} disabled={available.length === 0}>
              <NativeSelectOption value="">{available.length ? "＋ 添加本企业成员…" : "本企业的账号都已加入"}</NativeSelectOption>
              {available.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.nickname || m.username}（{m.username}）
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <span className="text-xs text-muted-foreground">没有账号的人先到“成员”里开通。咨询师由运营分派。</span>
          </div>
          {!hasLead ? (
            <Alert>
              <TriangleAlert />
              <AlertDescription>请指定一位企业项目负责人：确认定版、从已有项目带入都由企业项目负责人操作。</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={create.isPending || !hasLead || !name.trim()}>
              {create.isPending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
