import type { RenderAuthenticator } from "@nocobase/portal-sdk/auth";
import { Link } from "react-router";

import { AuthLayout } from "@/components/auth/auth-layout";
import { DynamicSignIn } from "@/components/auth/dynamic-sign-in";

type DefaultSignInPageProps = {
  renderAuthenticator?: RenderAuthenticator;
};

export function DefaultSignInPage({
  renderAuthenticator,
}: DefaultSignInPageProps) {
  return (
    <AuthLayout
      title="登录"
      footer={
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/trial" className="font-medium text-primary hover:underline hover:underline-offset-4">
            还没有账号？免费试用
          </Link>
          <Link to="/register" className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4">
            有邀请码？申请加入
          </Link>
        </div>
      }
    >
      <DynamicSignIn renderAuthenticator={renderAuthenticator} />
    </AuthLayout>
  );
}
