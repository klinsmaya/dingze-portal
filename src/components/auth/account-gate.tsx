import { useLogout } from "@refinedev/core";
import type { PropsWithChildren } from "react";

import { LoadingState } from "@/components/app-shell/loading-state";
import { BrandWordmark } from "@/components/app-shell/brand";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Button } from "@/components/ui/button";
import { useAccountStatus } from "@/lib/dingze/account-api";

/**
 * 登录后先看账号的情况：停用的账号只告诉他找谁；还在用初始密码（别人开通或重置时发的）的，
 * 先改成自己的密码才能往下用。服务端同样拦着（停用和没改初始密码时，其他接口一律不给用），
 * 所以这里问不到状态时照常放行，不把人挡在外面。
 */
export function AccountGate({ children }: PropsWithChildren) {
  const status = useAccountStatus();
  const { mutate: logout } = useLogout();
  if (status.isLoading) return <LoadingState fullscreen />;
  const account = status.data;
  if (!account?.disabled && !account?.mustChangePassword) return children;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm">
        <BrandWordmark />
        {account.disabled ? (
          <>
            <div>
              <h1 className="font-heading text-xl font-bold text-brand">账号已停用</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                这个账号现在不能使用，已填的内容都还在。企业成员请联系本企业管理员恢复，企业管理员和咨询团队请联系平台运营。
              </p>
            </div>
            <Button variant="outline" className="self-start" onClick={() => logout({ redirectPath: "/login" })}>
              退出登录
            </Button>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-heading text-xl font-bold text-brand">先改一下初始密码</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">你现在用的是开通或重置时发给你的密码，改成只有自己知道的密码再继续。</p>
            </div>
            <ChangePasswordForm oldLabel="现在的密码（发给你的初始密码）" />
            <Button variant="link" className="self-start px-0 text-muted-foreground" onClick={() => logout({ redirectPath: "/login" })}>
              换一个账号登录
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
