import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type AccountFields, accountPayload, emptyAccount } from "@/lib/dingze/accounts";
import { errorMessage } from "@/lib/dingze/errors";
import { type DzUser, opsApi } from "@/lib/dingze/ops-api";
import { useDzUsers, useEnterprises, useOpsMutation } from "@/lib/dingze/ops-queries";

import { AccountPasswordDialog, type IssuedPassword } from "./components/account-password-dialog";
import { AccountFieldsEditor } from "./components/create-account-dialog";
import { UserChecklist } from "./components/user-checklist";
import { EnterpriseStatusBadge, SIZE_LABELS } from "./components/labels";
import { OpsPageHeader } from "./components/page-header";

export default function EnterprisesPage() {
  const enterprises = useEnterprises();
  const [provisioning, setProvisioning] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <OpsPageHeader
        title="企业与开通"
        description="一家企业对应一个独立空间，企业之间的数据互不可见。"
        actions={
          <Button onClick={() => setProvisioning(true)}>
            <Plus /> 开通企业
          </Button>
        }
      />

      {enterprises.error ? (
        <Alert variant="destructive">
          <AlertTitle>企业列表加载失败</AlertTitle>
          <AlertDescription>{errorMessage(enterprises.error)}</AlertDescription>
        </Alert>
      ) : enterprises.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !enterprises.data?.length ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>还没有开通企业</EmptyTitle>
            <EmptyDescription>开通企业会建立它的独立空间，并可同时开通企业管理员账号。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企业</TableHead>
                <TableHead className="hidden md:table-cell">规模</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="hidden sm:table-cell">项目</TableHead>
                <TableHead className="hidden lg:table-cell">开通时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enterprises.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.shortName}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{SIZE_LABELS[e.size]}</TableCell>
                  <TableCell>
                    <EnterpriseStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline">{e.projects?.length ?? 0} 个</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {new Date(e.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" nativeButton={false} render={<Link to={`/ops/enterprises/${e.id}`} />}>
                      管理
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProvisionDialog
        open={provisioning}
        onOpenChange={setProvisioning}
        onProvisioned={(enterpriseId, admin) => {
          const path = `/ops/enterprises/${enterpriseId}`;
          if (admin) {
            setIssued(admin);
            setNextPath(path);
          } else {
            navigate(path);
          }
        }}
      />
      <AccountPasswordDialog
        issued={issued}
        onClose={() => {
          setIssued(null);
          if (nextPath) navigate(nextPath);
          setNextPath(null);
        }}
      />
    </div>
  );
}

function ProvisionDialog({
  open,
  onOpenChange,
  onProvisioned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvisioned: (enterpriseId: number, admin: IssuedPassword | null) => void;
}) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [size, setSize] = useState<"sme" | "large">("sme");
  const [consultantIds, setConsultantIds] = useState<number[]>([]);
  const [withAdmin, setWithAdmin] = useState(true);
  const [admin, setAdmin] = useState<AccountFields>(emptyAccount);
  const consultants = useDzUsers(undefined, undefined, open);
  const provision = useOpsMutation(opsApi.provisionEnterprise);
  const team: DzUser[] = (consultants.data ?? []).filter((u) =>
    u.roles.some((r) => r === "dz_consultant" || r === "dz_consult_admin")
  );

  const reset = () => {
    setName("");
    setShortName("");
    setSize("sme");
    setConsultantIds([]);
    setWithAdmin(true);
    setAdmin(emptyAccount);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    provision.mutate(
      {
        name: name.trim(),
        shortName: shortName.trim(),
        size,
        consultantIds,
        admin: withAdmin ? accountPayload(admin) : undefined,
      },
      {
        onSuccess: (result) => {
          toast.success(`已开通 ${result.enterprise.shortName}`);
          reset();
          onOpenChange(false);
          onProvisioned(
            result.enterprise.id,
            result.admin
              ? {
                  username: result.admin.user.username,
                  nickname: result.admin.user.nickname,
                  password: result.admin.initialPassword,
                  reason: "created",
                }
              : null
          );
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>开通企业</DialogTitle>
            <DialogDescription>建立企业的独立空间和档案；你和选中的咨询师会自动加入这个空间。</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field>
                <FieldLabel htmlFor="ent-name">企业全称</FieldLabel>
                <Input id="ent-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="ent-short">简称</FieldLabel>
                <Input id="ent-short" value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={20} required />
              </Field>
            </div>
            <FieldSet>
              <FieldLegend variant="label">企业规模</FieldLegend>
              <FieldDescription>用于分类统计；所有项目都以战略简约六分法为必做表，战略屋为可选表达。</FieldDescription>
              <RadioGroup value={size} onValueChange={(v) => setSize(v as "sme" | "large")} className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="sme" /> 中小企业
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="large" /> 大型企业
                </label>
              </RadioGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">咨询师</FieldLegend>
              <FieldDescription>选中的咨询师会加入这家企业的空间；具体项目里的主咨询师在“项目”中指定。</FieldDescription>
              {consultants.isLoading ? (
                <Skeleton className="h-24" />
              ) : (
                <UserChecklist users={team} selected={consultantIds} onChange={setConsultantIds} emptyText="还没有咨询师账号，可先到“咨询团队”开通" />
              )}
            </FieldSet>
            <FieldSet>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <FieldLegend variant="label">同时开通企业管理员</FieldLegend>
                  <FieldDescription>企业管理员负责维护本企业的成员和组织部门。</FieldDescription>
                </div>
                <Switch checked={withAdmin} onCheckedChange={setWithAdmin} aria-label="同时开通企业管理员" />
              </div>
              {withAdmin ? <AccountFieldsEditor value={admin} onChange={setAdmin} idPrefix="ent-admin" /> : null}
            </FieldSet>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={provision.isPending}>
              {provision.isPending ? "开通中…" : "开通"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
