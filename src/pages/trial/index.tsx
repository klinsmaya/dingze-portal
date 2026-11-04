import { useLogin } from "@refinedev/core";
import { useState } from "react";
import { Link } from "react-router";

import { AuthLayout } from "@/components/auth/auth-layout";
import { InputPassword } from "@/components/auth/input-password";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/dingze/errors";
import { passwordProblem, trialApi } from "@/lib/dingze/invite-api";

// 免费试用注册：填四项、勾一下，马上开好试用企业和项目，自动登录后进入项目总览。

const toLogin = (
  <Link to="/login" className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4">
    已有账号？去登录
  </Link>
);

export function TrialSignUpPage() {
  const [form, setForm] = useState({ enterpriseName: "", nickname: "", phone: "", password: "", confirm: "", website: "" });
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mutate: login } = useLogin<{ account: string; password: string; redirectTo: string }>();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pwProblem = form.password ? passwordProblem(form.password) : null;
  const mismatch = form.confirm && form.confirm !== form.password ? "两次输入的密码不一样" : null;
  const phoneProblem = form.phone && !/^1\d{10}$/.test(form.phone.trim()) ? "请填写 11 位手机号" : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pwProblem || mismatch || phoneProblem || !agree) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await trialApi.signUp({
        enterpriseName: form.enterpriseName.trim(),
        nickname: form.nickname.trim(),
        phone: form.phone.trim(),
        password: form.password,
        agree,
        website: form.website || undefined,
      });
      login(
        { account: r.username, password: form.password, redirectTo: `/projects/${r.projectId}/overview` },
        { onError: () => setError("账号已开好，但自动登录没成功。请用手机号和刚设的密码登录。") },
      );
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="免费试用" description="填好下面几项就能开始，不用等审核。" footer={toLogin}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="trial-enterprise">企业名称</FieldLabel>
            <Input id="trial-enterprise" value={form.enterpriseName} onChange={set("enterpriseName")} minLength={2} maxLength={60} autoFocus required />
          </Field>
          <Field>
            <FieldLabel htmlFor="trial-nickname">你的姓名</FieldLabel>
            <Input id="trial-nickname" value={form.nickname} onChange={set("nickname")} maxLength={50} required />
          </Field>
          <Field data-invalid={!!phoneProblem || undefined}>
            <FieldLabel htmlFor="trial-phone">手机号</FieldLabel>
            <Input id="trial-phone" value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" maxLength={11} required />
            {phoneProblem ? <FieldError>{phoneProblem}</FieldError> : <FieldDescription>以后用手机号登录。</FieldDescription>}
          </Field>
          <Field data-invalid={!!pwProblem || undefined}>
            <FieldLabel htmlFor="trial-password">密码</FieldLabel>
            <InputPassword id="trial-password" value={form.password} onChange={set("password")} autoComplete="new-password" required />
            {pwProblem ? <FieldError>密码{pwProblem}</FieldError> : <FieldDescription>至少 8 位，字母和数字都要有。</FieldDescription>}
          </Field>
          <Field data-invalid={!!mismatch || undefined}>
            <FieldLabel htmlFor="trial-confirm">再输一次密码</FieldLabel>
            <InputPassword id="trial-confirm" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required />
            {mismatch ? <FieldError>{mismatch}</FieldError> : null}
          </Field>
          {/* 蜜罐：人看不到也不会填。 */}
          <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <label className="flex items-start gap-2 text-sm leading-relaxed">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
            <span className="text-muted-foreground">
              我知道这是试用版：请用脱敏资料；资料和对话会发给数字咨询师背后的大模型服务处理。
            </span>
          </label>
        </FieldGroup>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={submitting || !agree || !!pwProblem || !!mismatch || !!phoneProblem}>
          {submitting ? "正在开通…" : "开始试用"}
        </Button>
      </form>
    </AuthLayout>
  );
}
