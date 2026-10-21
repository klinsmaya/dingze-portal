import { CheckCircle2, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { AuthLayout } from "@/components/auth/auth-layout";
import { InputPassword } from "@/components/auth/input-password";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/dingze/errors";
import { type InviteScope, inviteApi, passwordProblem } from "@/lib/dingze/invite-api";

// 凭邀请码申请加入（审核制）：先核对邀请码，看清是哪家企业、哪个项目，再填自己的信息和密码。
// 提交后不会马上有账号，要等企业管理员或运营审核通过。

const toLogin = (
  <Link to="/login" className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4">
    已有账号？去登录
  </Link>
);

export function InviteRegister() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [scope, setScope] = useState<InviteScope | null>(null);
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [form, setForm] = useState({ nickname: "", username: "", password: "", confirm: "", phone: "", email: "", remark: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ enterprise: string; username: string } | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const check = async (value = code) => {
    if (!value.trim()) return;
    setChecking(true);
    setCodeError(null);
    try {
      setScope(await inviteApi.checkInvite(value.trim()));
    } catch (e) {
      setScope(null);
      setCodeError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  };
  // 从链接进来时自动核对一次。
  useEffect(() => {
    const initial = params.get("code");
    if (initial) void check(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pwProblem = form.password ? passwordProblem(form.password) : null;
  const mismatch = form.confirm && form.confirm !== form.password ? "两次输入的密码不一样" : null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pwProblem || mismatch) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await inviteApi.register({
        code: code.trim(),
        nickname: form.nickname.trim(),
        username: form.username.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        remark: form.remark.trim() || undefined,
      });
      setDone({ enterprise: r.enterprise, username: form.username.trim() });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="申请已提交" description="等待审核通过后就能登录。" footer={toLogin}>
        <Alert>
          <CheckCircle2 />
          <AlertTitle>已提交给 {done.enterprise} 审核</AlertTitle>
          <AlertDescription>
            审核由本企业管理员或平台运营完成。通过后用登录名 <b>{done.username}</b> 和你刚设的密码登录；审核结果出来之前登录会提示“还在审核中”。
          </AlertDescription>
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="凭邀请码加入" description="邀请码由本企业管理员或平台运营发放。提交后需审核，通过才开通账号。" footer={toLogin}>
      <div className="flex flex-col gap-5">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void check();
          }}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="invite-code">邀请码</FieldLabel>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setScope(null);
              }}
              autoComplete="off"
              className="font-mono tracking-widest"
              autoFocus={!code}
              required
            />
          </Field>
          <Button type="submit" variant="outline" disabled={checking || !code.trim()}>
            {checking ? "核对中…" : "核对"}
          </Button>
        </form>
        {codeError ? <p className="text-sm text-destructive">{codeError}</p> : null}

        {scope ? (
          <>
            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
              <Ticket className="mt-0.5 size-4 text-brand" />
              <div>
                <div className="font-medium">加入 {scope.enterprise}</div>
                <div className="text-muted-foreground">
                  {[scope.project && `项目「${scope.project}」`, scope.role, scope.dept].filter(Boolean).join(" · ") || "加入企业，项目由管理员再分派"}
                </div>
              </div>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-5">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="reg-nickname">姓名</FieldLabel>
                  <Input id="reg-nickname" value={form.nickname} onChange={set("nickname")} maxLength={50} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reg-username">登录名</FieldLabel>
                  <Input id="reg-username" value={form.username} onChange={set("username")} autoComplete="username" pattern="[A-Za-z0-9_.@\-]{3,50}" required />
                  <FieldDescription>字母、数字和 _ . @ -，至少 3 位，以后用它登录。</FieldDescription>
                </Field>
                <Field data-invalid={!!pwProblem || undefined}>
                  <FieldLabel htmlFor="reg-password">密码</FieldLabel>
                  <InputPassword id="reg-password" value={form.password} onChange={set("password")} autoComplete="new-password" required />
                  {pwProblem ? <FieldError>密码{pwProblem}</FieldError> : <FieldDescription>至少 8 位，同时包含字母和数字。</FieldDescription>}
                </Field>
                <Field data-invalid={!!mismatch || undefined}>
                  <FieldLabel htmlFor="reg-confirm">再输一次密码</FieldLabel>
                  <InputPassword id="reg-confirm" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
                  {mismatch ? <FieldError>{mismatch}</FieldError> : null}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="reg-phone">手机（选填）</FieldLabel>
                    <Input id="reg-phone" value={form.phone} onChange={set("phone")} inputMode="tel" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reg-email">邮箱（选填）</FieldLabel>
                    <Input id="reg-email" type="email" value={form.email} onChange={set("email")} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="reg-remark">部门 / 岗位（选填，供审核参考）</FieldLabel>
                  <Input id="reg-remark" value={form.remark} onChange={set("remark")} maxLength={100} />
                </Field>
              </FieldGroup>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting || !!pwProblem || !!mismatch}>
                {submitting ? "提交中…" : "提交申请"}
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </AuthLayout>
  );
}
