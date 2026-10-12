"use client";

import { useState } from "react";
import { useLink, useLogin } from "@refinedev/core";
import type { AuthenticatorComponentProps } from "@nocobase/portal-sdk/auth";

import { InputPassword } from "@/components/auth/input-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteApi } from "@/lib/dingze/invite-api";

type LoginVariables = {
  account: string;
  password: string;
  authenticator: string;
};

export function BasicSignInForm({
  authenticator,
}: AuthenticatorComponentProps) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const Link = useLink();
  const { mutate: login, isPending } = useLogin<LoginVariables>();
  const enableResetPassword =
    authenticator.options?.enableResetPassword === true;

  // 凭邀请码申请的人在审核通过前没有账号：登录前先查一下申请状态，告诉他为什么进不去。
  // （登录失败后表单会重新挂载，所以不放在失败回调里。）
  const [registration, setRegistration] = useState<"pending" | "rejected" | null>(null);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const status = await inviteApi
      .registrationStatus(account.trim())
      .then((r) => r.status)
      .catch(() => "none" as const);
    if (status !== "none") {
      setRegistration(status);
      return;
    }
    setRegistration(null);
    login({ account, password, authenticator: authenticator.name });
  };

  return (
    <form onSubmit={handleSignIn} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${authenticator.name}-account`}>用户名或邮箱</Label>
        <Input
          id={`${authenticator.name}-account`}
          type="text"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${authenticator.name}-password`}>密码</Label>
        <InputPassword
          id={`${authenticator.name}-password`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {registration ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm leading-relaxed">
          {registration === "pending"
            ? "你的加入申请还在审核中，审核通过后才能用这个登录名登录。着急的话请联系本企业管理员。"
            : "你的加入申请没有通过审核，请联系发邀请码的人了解原因。"}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "登录中…" : "登录"}
      </Button>

      {/* Accounts are provisioned by 运营管理; self sign-up stays closed in this Portal. */}
      <div className="text-sm text-muted-foreground">
        {enableResetPassword ? (
          <Link
            to={`/forgot-password?name=${encodeURIComponent(
              authenticator.name
            )}`}
            className="transition-colors hover:text-foreground hover:underline hover:underline-offset-4"
          >
            忘记密码？
          </Link>
        ) : (
          <details>
            <summary className="cursor-pointer transition-colors hover:text-foreground">
              忘记密码？
            </summary>
            <p className="mt-2 rounded-md bg-muted px-3 py-2 leading-relaxed">
              账号由平台统一开通，不能自助注册。企业成员请联系本企业管理员；企业管理员和咨询团队请联系平台运营，在“运营管理”里重置密码，新密码会当面或通过安全渠道转交给你。
            </p>
          </details>
        )}
      </div>
    </form>
  );
}

BasicSignInForm.displayName = "BasicSignInForm";
