import { MessageSquare } from "lucide-react";

import type { AuthenticatorComponentProps } from "@nocobase/portal-sdk/auth";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resolveTranslatableText } from "@nocobase/portal-sdk/i18n";

import { useDingtalkSignIn } from "./use-dingtalk-sign-in";

function dingtalkLabel(authenticator: AuthenticatorComponentProps["authenticator"]) {
  const resolved = resolveTranslatableText(authenticator.title || authenticator.authTypeTitle || "钉钉");
  return resolved === "Sign in via DingTalk" || resolved === "DingTalk" ? "钉钉" : resolved;
}

export default function DingtalkSignInButton({
  authenticator,
  onSignIn,
}: AuthenticatorComponentProps & { onSignIn?: () => void }) {
  const { signIn, isPending, error } = useDingtalkSignIn(authenticator);
  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>DingTalk sign-in failed</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!onSignIn && isPending}
        onClick={onSignIn ?? signIn}
      >
        <MessageSquare />
        {!onSignIn && isPending ? "Redirecting…" : dingtalkLabel(authenticator)}
      </Button>
    </div>
  );
}
