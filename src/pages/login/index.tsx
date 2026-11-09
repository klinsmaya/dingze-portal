import { useState } from "react";
import { Link } from "react-router";

import { AuthLayout } from "@/components/auth/auth-layout";
import { DynamicSignIn } from "@/components/auth/dynamic-sign-in";
import { cn } from "@/lib/utils";

type Side = "enterprise" | "consultant";
const KEY = "dingze:login-side";
const SIDES: { key: Side; label: string }[] = [
  { key: "enterprise", label: "企业" },
  { key: "consultant", label: "咨询师" },
];

const stored = (): Side => {
  try {
    return localStorage.getItem(KEY) === "consultant" ? "consultant" : "enterprise";
  } catch {
    return "enterprise";
  }
};

/** 登录页：企业和咨询师两个页签（会议纪要 2026-11）。账号一样登录，只有企业这边有免费试用和邀请码注册。 */
export const Login = () => {
  const [side, setSide] = useState<Side>(stored);
  const pick = (next: Side) => {
    setSide(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // 记不住也不影响登录
    }
  };
  return (
    <AuthLayout
      title="登录"
      description={side === "enterprise" ? "用手机号或开通的账号登录。" : "用运营开通的账号登录。"}
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
      <DynamicSignIn />
    </AuthLayout>
  );
};
