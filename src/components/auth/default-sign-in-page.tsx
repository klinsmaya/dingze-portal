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
      description="使用咨询机构为你开通的账号登录。"
      footer={
        <Link to="/register" className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4">
          有邀请码？申请加入
        </Link>
      }
    >
      <DynamicSignIn renderAuthenticator={renderAuthenticator} />
    </AuthLayout>
  );
}
