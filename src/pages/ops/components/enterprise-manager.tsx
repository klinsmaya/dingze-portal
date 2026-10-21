import { Ban, CirclePlay, Pencil } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/dingze/errors";
import { type Enterprise, opsApi } from "@/lib/dingze/ops-api";
import { useEnterpriseDetail, useOpsMutation } from "@/lib/dingze/ops-queries";

import { ConfirmAction } from "./confirm-action";
import { EnterpriseStatusBadge, SIZE_LABELS } from "./labels";
import { InvitesTab, usePendingRegistrations } from "./invites-tab";
import { MembersTab } from "./members-tab";
import { OrgUnitsTab } from "./org-units-tab";
import { OpsPageHeader } from "./page-header";
import { ProjectsTab } from "./projects-tab";

/**
 * One enterprise's administration. Ops (and consulting admins) see projects and can
 * suspend the enterprise; an enterprise admin maintains only its members and departments.
 */
export function EnterpriseManager({ enterpriseId, asOps }: { enterpriseId: number; asOps: boolean }) {
  const detail = useEnterpriseDetail(enterpriseId);
  const [editing, setEditing] = useState(false);
  const update = useOpsMutation(opsApi.updateEnterprise);
  const pendingRegistrations = usePendingRegistrations(enterpriseId);
  const [params, setParams] = useSearchParams();
  const defaultTab = asOps ? "projects" : "members";
  const tabs = ["projects", "members", "org", "invites"];
  const tab = tabs.includes(params.get("tab") ?? "") ? (params.get("tab") as string) : defaultTab;

  if (detail.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (detail.error || !detail.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>企业加载失败</AlertTitle>
        <AlertDescription>{errorMessage(detail.error)}</AlertDescription>
      </Alert>
    );
  }
  const { enterprise } = detail.data;
  const suspended = enterprise.status === "suspended";

  return (
    <div className="flex flex-col gap-6">
      <OpsPageHeader
        eyebrow={asOps ? "运营管理 › 企业与开通" : "本企业"}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {enterprise.name}
            <EnterpriseStatusBadge status={enterprise.status} />
          </span>
        }
        description={`${enterprise.shortName} · ${SIZE_LABELS[enterprise.size]} · 开通于 ${new Date(enterprise.createdAt).toLocaleDateString("zh-CN")}`}
        actions={
          asOps ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> 编辑档案
              </Button>
              <ConfirmAction
                trigger={
                  <Button variant={suspended ? "default" : "outline"} className={suspended ? "" : "text-destructive"}>
                    {suspended ? <CirclePlay /> : <Ban />} {suspended ? "恢复使用" : "停用企业"}
                  </Button>
                }
                title={suspended ? `恢复 ${enterprise.shortName}？` : `停用 ${enterprise.shortName}？`}
                description={
                  suspended
                    ? "企业成员可以重新进入项目。"
                    : "停用后企业成员无法进入任何项目，数据完整保留；运营和咨询管理员仍可查看。"
                }
                confirmLabel={suspended ? "恢复" : "停用"}
                destructive={!suspended}
                onConfirm={() =>
                  update.mutateAsync(
                    { enterpriseId, status: suspended ? "active" : "suspended" },
                    {
                      onSuccess: () => toast.success(suspended ? "已恢复" : "已停用"),
                      onError: (error) => toast.error(errorMessage(error)),
                    }
                  )
                }
              />
            </>
          ) : null
        }
      />

      {suspended ? (
        <Alert variant="destructive">
          <AlertTitle>企业已停用</AlertTitle>
          <AlertDescription>企业成员目前无法进入项目。</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setParams(v === defaultTab ? {} : { tab: String(v) }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="projects">{asOps ? "项目与分派" : "项目"}</TabsTrigger>
          <TabsTrigger value="members">成员</TabsTrigger>
          <TabsTrigger value="org">组织部门</TabsTrigger>
          <TabsTrigger value="invites">
            邀请注册
            {pendingRegistrations ? <Badge className="ml-1 h-4 px-1.5 text-[10px]">{pendingRegistrations}</Badge> : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="pt-4">
          <ProjectsTab detail={detail.data} asOps={asOps} />
        </TabsContent>
        <TabsContent value="members" className="pt-4">
          <MembersTab detail={detail.data} asOps={asOps} />
        </TabsContent>
        <TabsContent value="org" className="pt-4">
          <OrgUnitsTab detail={detail.data} />
        </TabsContent>
        <TabsContent value="invites" className="pt-4">
          <InvitesTab detail={detail.data} asOps={asOps} />
        </TabsContent>
      </Tabs>

      {asOps ? <EditEnterpriseDialog enterprise={enterprise} open={editing} onOpenChange={setEditing} /> : null}
    </div>
  );
}

function EditEnterpriseDialog({
  enterprise,
  open,
  onOpenChange,
}: {
  enterprise: Enterprise;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState({ name: enterprise.name, shortName: enterprise.shortName, size: enterprise.size });
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValues({ name: enterprise.name, shortName: enterprise.shortName, size: enterprise.size });
  }
  const update = useOpsMutation(opsApi.updateEnterprise);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    update.mutate(
      { enterpriseId: enterprise.id, name: values.name.trim(), shortName: values.shortName.trim(), size: values.size },
      {
        onSuccess: () => {
          toast.success("已保存");
          onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>编辑企业档案</DialogTitle>
            <DialogDescription>维护企业名称、简称与规模。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-ent-name">企业全称</FieldLabel>
              <Input id="edit-ent-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-ent-short">简称</FieldLabel>
                <Input
                  id="edit-ent-short"
                  value={values.shortName}
                  maxLength={20}
                  onChange={(e) => setValues({ ...values, shortName: e.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-ent-size">规模</FieldLabel>
                <NativeSelect
                  id="edit-ent-size"
                  className="w-full"
                  value={values.size}
                  onChange={(e) => setValues({ ...values, size: e.target.value as Enterprise["size"] })}
                >
                  <NativeSelectOption value="sme">中小企业</NativeSelectOption>
                  <NativeSelectOption value="large">大型企业</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={update.isPending}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
