import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ImportSource } from "@/components/dingze/import-source";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/dingze/errors";
import { MEMBER_TEMPLATE, parseMemberTable } from "@/lib/dingze/member-import";
import { opsApi } from "@/lib/dingze/ops-api";
import { opsKeys } from "@/lib/dingze/ops-queries";

import type { IssuedRow } from "./camp-dialogs";

/**
 * 批量开通成员账号：粘贴或上传名单，先预览，再逐个开通为企业成员。一行失败不影响其他行；
 * 结果（含只显示一次的初始密码）交给账号清单弹窗。
 */
export function BulkAccountsDialog({
  open,
  onClose,
  enterpriseId,
  taken,
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  enterpriseId: number;
  /** 本企业已有的登录名。 */
  taken: string[];
  onIssued: (rows: IssuedRow[]) => void;
}) {
  const client = useQueryClient();
  const [text, setText] = useState("");
  // 开通到第几个；null 表示没在开通。
  const [progress, setProgress] = useState<number | null>(null);
  const { rows, problems } = parseMemberTable(text, taken);
  const busy = progress !== null;

  const run = async () => {
    const results: IssuedRow[] = [];
    for (const [i, row] of rows.entries()) {
      setProgress(i + 1);
      try {
        const created = await opsApi.createUser({ ...row, systemRole: "dz_ent_member", enterpriseId });
        results.push({ label: row.nickname, username: created.user.username, password: created.initialPassword, ok: true });
      } catch (error) {
        results.push({ label: row.nickname, username: row.username, ok: false, error: errorMessage(error) });
      }
    }
    await client.invalidateQueries({ queryKey: opsKeys.all });
    setProgress(null);
    setText("");
    onClose();
    onIssued(results);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量开通成员账号</DialogTitle>
          <DialogDescription>列依次是：姓名、登录名、手机、邮箱。</DialogDescription>
        </DialogHeader>
        <ImportSource template={MEMBER_TEMPLATE} onText={setText} />
        <Textarea
          autoFocus
          aria-label="成员名单"
          className="min-h-32 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"赵部长\thc_zhao\t13800000002\t\n李专员\thc_li\t\tli@example.com"}
          disabled={busy}
        />
        {rows.length ? (
          <ul className="max-h-40 overflow-y-auto rounded-lg border text-xs">
            {rows.map((r) => (
              <li key={r.username} className="flex gap-2 border-b px-3 py-1.5 last:border-b-0">
                <span className="font-medium">{r.nickname}</span>
                <span className="text-muted-foreground">{[r.username, r.phone, r.email].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {problems.length ? <p className="text-xs text-[color:var(--dz-warn)]">{problems.join("；")}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button disabled={!rows.length || busy} onClick={run}>
            {busy ? `开通中 ${progress} / ${rows.length}…` : `开通 ${rows.length || ""} 个账号`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
