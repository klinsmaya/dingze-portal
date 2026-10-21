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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type AccountFields, accountPayload, emptyAccount } from "@/lib/dingze/accounts";
import { errorMessage } from "@/lib/dingze/errors";
import { type CreatedAccount, SYSTEM_ROLE_LABELS, type SystemRole, opsApi } from "@/lib/dingze/ops-api";
import { useOpsMutation } from "@/lib/dingze/ops-queries";

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
  enterpriseId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  roles: SystemRole[];
  enterpriseId?: number;
  onCreated: (account: CreatedAccount) => void;
}) {
  const [account, setAccount] = useState<AccountFields>(emptyAccount);
  const [role, setRole] = useState<SystemRole>(roles[0]);
  const create = useOpsMutation(opsApi.createUser);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      { ...accountPayload(account), systemRole: role, enterpriseId },
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
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
                <FieldDescription>系统角色决定能进入哪些菜单；项目里的权限在项目成员中设置。</FieldDescription>
              </Field>
            ) : null}
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
