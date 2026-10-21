import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type IssuedPassword = { username: string; nickname?: string; password: string; reason: "created" | "reset" };

/** Shows a generated initial password once; the server never returns it again. */
export function AccountPasswordDialog({ issued, onClose }: { issued: IssuedPassword | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = issued ? `登录名：${issued.username}\n初始密码：${issued.password}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog
      open={!!issued}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            {issued?.reason === "reset" ? "密码已重置" : "账号已开通"}
            {issued?.nickname ? ` · ${issued.nickname}` : ""}
          </DialogTitle>
          <DialogDescription>请通过安全渠道发给本人，并提醒首次登录后修改密码。</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[5rem_1fr] gap-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
          <dt className="text-muted-foreground">登录名</dt>
          <dd className="font-mono">{issued?.username}</dd>
          <dt className="text-muted-foreground">初始密码</dt>
          <dd className="font-mono text-base font-semibold tracking-wider">{issued?.password}</dd>
        </dl>
        <Alert>
          <AlertDescription>关闭后无法再次查看这个密码；忘记了只能重新重置。</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "已复制" : "复制登录信息"}
          </Button>
          <Button onClick={onClose}>我已记下</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
