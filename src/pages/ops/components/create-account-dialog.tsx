import { defaultJoinProjectIds } from "@dingze/shared";
import { useState } from "react";
import { toast } from "sonner";

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
import { type AccountFields, accountPayload, emptyAccount } from "@/lib/dingze/accounts";
import { errorMessage } from "@/lib/dingze/errors";
import { type CreatedAccount, type OrgUnit, SYSTEM_ROLE_LABELS, type SystemRole, opsApi } from "@/lib/dingze/ops-api";
import { useOpsMutation } from "@/lib/dingze/ops-queries";
import { flattenOrgUnits } from "@/lib/dingze/org-units";

import { ProjectPicker } from "./project-picker";

/** 登录名 / 姓名 / 手机 / 邮箱 — shared by account creation and enterprise provisioning. */
export function AccountFieldsEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: AccountFields;
  onChange: (next: AccountFields) => void;
  idPrefix: string;
}) {
  const set = (key: keyof AccountFields) => (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: event.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-nickname`}>姓名</FieldLabel>
        <Input id={`${idPrefix}-nickname`} value={value.nickname} onChange={set("nickname")} required />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-username`}>登录名</FieldLabel>
        <Input
          id={`${idPrefix}-username`}
          value={value.username}
          onChange={set("username")}
          placeholder="字母、数字或 _ . @ -"
          autoComplete="off"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-phone`}>手机（选填）</FieldLabel>
        <Input id={`${idPrefix}-phone`} value={value.phone} onChange={set("phone")} inputMode="tel" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-email`}>邮箱（选填）</FieldLabel>
        <Input id={`${idPrefix}-email`} type="email" value={value.email} onChange={set("email")} />
      </Field>
    </div>
  );
}

export function CreateAccountDialog({
  open,
  onOpenChange,
  title,
  description,
  roles,
  enterprise,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  roles: SystemRole[];
  /** 在企业里开通：可以顺手归到部门、加进项目（默认本企业所有进行中的项目）。 */
  enterprise?: { id: number; projects: { id: number; name: string; status?: string | null }[]; orgUnits: OrgUnit[] };
  onCreated: (account: CreatedAccount) => void;
}) {
  const [account, setAccount] = useState<AccountFields>(emptyAccount);
  const [role, setRole] = useState<SystemRole>(roles[0]);
  const [orgUnitId, setOrgUnitId] = useState("");
  const [projectIds, setProjectIds] = useState<number[]>(() => defaultJoinProjectIds(enterprise?.projects ?? []));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOrgUnitId("");
      setProjectIds(defaultJoinProjectIds(enterprise?.projects ?? []));
    }
  }
  const create = useOpsMutation(opsApi.createUser);
  const active = (enterprise?.projects ?? []).filter((p) => p.status !== "archived");
  const orgNodes = flattenOrgUnits(enterprise?.orgUnits ?? []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      { ...accountPayload(account), systemRole: role, enterpriseId: enterprise?.id, ...(enterprise ? { projectIds, orgUnitId: orgUnitId ? Number(orgUnitId) : null } : {}) },
      {
        onSuccess: (created) => {
          setAccount(emptyAccount);
          onOpenChange(false);
          onCreated(created);
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <FieldGroup>
            <AccountFieldsEditor value={account} onChange={setAccount} idPrefix="new-account" />
            {roles.length > 1 ? (
              <Field>
                <FieldLabel htmlFor="new-account-role">系统角色</FieldLabel>
                <NativeSelect id="new-account-role" value={role} onChange={(e) => setRole(e.target.value as SystemRole)}>
                  {roles.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {SYSTEM_ROLE_LABELS[r]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            {enterprise && orgNodes.length ? (
              <Field>
                <FieldLabel htmlFor="new-account-dept">所属部门</FieldLabel>
                <NativeSelect id="new-account-dept" value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
                  <NativeSelectOption value="">（未指定）</NativeSelectOption>
                  {orgNodes.map((n) => (
                    <NativeSelectOption key={n.id} value={n.id}>
                      {"　".repeat(n.depth)}
                      {n.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            {enterprise ? <ProjectPicker projects={active} selected={projectIds} onChange={setProjectIds} /> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "开通中…" : "开通账号"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
