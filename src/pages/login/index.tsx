import { useEffect, useState } from "react";
import { Link } from "react-router";

import { AuthLayout } from "@/components/auth/auth-layout";
import { DynamicSignIn } from "@/components/auth/dynamic-sign-in";
import { LOGIN_SIDE_LABELS, type LoginSide, clearLoginAttempt, clearLoginMismatch, markLoginAttempt, readLoginMismatch, storeLoginSide, storedLoginSide } from "@/lib/dingze/login-side";
import { cn } from "@/lib/utils";

const SIDES: { key: LoginSide; label: string }[] = [
  { key: "enterprise", label: LOGIN_SIDE_LABELS.enterprise },
  { key: "consultant", label: LOGIN_SIDE_LABELS.consultant },
];

/**
 * 登录页：企业和咨询师两个页签（会议纪要 2026-11）。只有企业这边有免费试用和邀请码注册。
 * 所选身份和账号实际身份对不上时登录会被拦下（测试反馈 6）：回到这里，切到对的页签并说明原因。
 */
export const Login = () => {
  // 刚被拦下来的账号属于哪一边；有的话直接切到那个页签。
  const [blocked, setBlocked] = useState<LoginSide | null>(readLoginMismatch);
  useEffect(clearLoginMismatch, []);
  const [side, setSide] = useState<LoginSide>(() => blocked ?? storedLoginSide());
  const pick = (next: LoginSide) => {
    setSide(next);
    setBlocked(null);
    clearLoginAttempt();
    storeLoginSide(next);
  };
  return (
    <AuthLayout
      title="登录"
      footer={
        side === "enterprise" ? (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/trial" className="font-medium text-primary hover:underline hover:underline-offset-4">
              还没有账号？免费试用
            </Link>
            <Link to="/register" className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4">
              有邀请码？申请加入
            </Link>
          </div>
        ) : null
      }
    >
      <div role="tablist" aria-label="登录身份" className="mb-6 flex rounded-lg bg-muted p-1">
        {SIDES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={side === s.key}
            onClick={() => pick(s.key)}
            className={cn("min-h-9 flex-1 rounded-md text-sm", side === s.key ? "bg-background font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {s.label}
          </button>
        ))}
      </div>
      {blocked ? (
        <p role="alert" className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm leading-relaxed">
          这个账号是{blocked === "consultant" ? "咨询团队" : "企业"}账号，不能从「{LOGIN_SIDE_LABELS[blocked === "consultant" ? "enterprise" : "consultant"]}」登录。已切到「
          {LOGIN_SIDE_LABELS[blocked]}」，请重新登录。
        </p>
      ) : null}
      {/* 提交登录表单时记下这次选的身份，登录成功后据此校验（第三方登录按钮不经过这里，不校验）。 */}
      <div
        onSubmitCapture={() => {
          storeLoginSide(side);
          markLoginAttempt(side);
        }}
      >
        <DynamicSignIn />
      </div>
    </AuthLayout>
  );
};
