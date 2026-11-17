import { passwordProblem } from "@dingze/shared";
import { useLogout } from "@refinedev/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { InputPassword } from "@/components/auth/input-password";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ACCOUNT_STATUS_KEY, accountApi } from "@/lib/dingze/account-api";
import { errorMessage } from "@/lib/dingze/errors";

/**
 * 本人改密码：报对原密码，新密码输两遍。改完退出登录，用新密码重新登录
 * （原来的登录凭据在改密码后失效）。初始密码的强制修改和「设置」页用的是同一个表单。
 */
export function ChangePasswordForm({ oldLabel = "原密码" }: { oldLabel?: string }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [again, setAgain] = useState("");
  const { mutate: logout } = useLogout();
  const client = useQueryClient();
  const change = useMutation({ mutationFn: accountApi.changePassword });

  const problem = newPassword ? (passwordProblem(newPassword) ?? (newPassword === oldPassword ? "新密码不能和原密码一样" : null)) : null;
  const mismatch = again && again !== newPassword ? "两次输入的新密码不一样" : null;
  const ready = !!oldPassword && !!newPassword && !!again && !problem && !mismatch;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    change.mutate(
      { oldPassword, newPassword },
      {
        onSuccess: () => {
          // “要先改初始密码”的状态不再作数，重新登录后重新问。
          client.removeQueries({ queryKey: ACCOUNT_STATUS_KEY });
          toast.success("密码已修改，请用新密码重新登录");
          logout({ redirectPath: "/login" });
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pw-old">{oldLabel}</FieldLabel>
          <InputPassword id="pw-old" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field data-invalid={problem ? true : undefined}>
          <FieldLabel htmlFor="pw-new">新密码</FieldLabel>
          <InputPassword id="pw-new" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" aria-invalid={problem ? true : undefined} required />
          <FieldDescription>{problem ?? "8 到 64 位，同时包含字母和数字。"}</FieldDescription>
        </Field>
        <Field data-invalid={mismatch ? true : undefined}>
          <FieldLabel htmlFor="pw-again">再输一遍新密码</FieldLabel>
          <InputPassword id="pw-again" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" aria-invalid={mismatch ? true : undefined} required />
          {mismatch ? <FieldDescription>{mismatch}</FieldDescription> : null}
        </Field>
        <Button type="submit" className="self-start" disabled={!ready || change.isPending}>
          {change.isPending ? "正在修改…" : "修改密码"}
        </Button>
      </FieldGroup>
    </form>
  );
}
