"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useForgotPassword, useLink } from "@refinedev/core";
import { useSearchParams } from "react-router";

import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const Link = useLink();
  const [searchParams] = useSearchParams();
  const { mutate: forgotPassword, isPending } = useForgotPassword();

  const handleForgotPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    forgotPassword({
      email,
      authenticator: searchParams.get("name") ?? undefined,
    });
  };

  return (
    <AuthLayout
      title="找回密码"
      description="输入账号绑定的邮箱，我们会发送重置链接。"
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          返回登录
        </Link>
      }
    >
      <form onSubmit={handleForgotPassword} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "发送中…" : "发送重置链接"}
        </Button>
      </form>
    </AuthLayout>
  );
};

ForgotPasswordForm.displayName = "ForgotPasswordForm";
