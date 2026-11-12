import { useLogout } from "@refinedev/core";
import { type PropsWithChildren, useEffect, useState } from "react";

import { LoadingState } from "@/components/app-shell/loading-state";
import { clearLoginAttempt, loginSideMismatch, readLoginAttempt, rememberLoginMismatch } from "@/lib/dingze/login-side";
import { useSystemRoles } from "@/lib/dingze/system-roles";

/**
 * 登录身份校验（测试反馈 6）：刚在登录页选了「企业」或「咨询师」登录进来时，对一下账号的实际身份；
 * 对不上就退出登录、回到登录页并提示该用哪个页签。其他时候（刷新、免登录进入）不做任何事。
 */
export function LoginSideGuard({ children }: PropsWithChildren) {
  const [chosen, setChosen] = useState(() => readLoginAttempt());
  const { roles, isLoading } = useSystemRoles();
  const { mutate: logout } = useLogout();
  const mismatch = chosen && !isLoading ? loginSideMismatch(chosen, roles) : null;
  const settled = !!chosen && !isLoading;

  useEffect(() => {
    if (!settled) return;
    clearLoginAttempt();
    if (!mismatch) {
      setChosen(null);
      return;
    }
    rememberLoginMismatch(mismatch);
    logout({ redirectPath: "/login" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, mismatch]);

  if (chosen) return <LoadingState fullscreen />;
  return children;
}
