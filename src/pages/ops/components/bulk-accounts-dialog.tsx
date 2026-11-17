import { defaultJoinProjectIds } from "@dingze/shared";
import { useState } from "react";
import { toast } from "sonner";

import { ImportSource } from "@/components/dingze/import-source";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/dingze/errors";
import { MEMBER_TEMPLATE, parseMemberTable } from "@/lib/dingze/member-import";
import { opsApi } from "@/lib/dingze/ops-api";
import { useOpsMutation } from "@/lib/dingze/ops-queries";

import type { IssuedRow } from "./camp-dialogs";
import { ProjectPicker } from "./project-picker";

/**
 * 批量开通成员账号：粘贴或上传名单，先预览，再一次开通为企业成员，并加进选中的项目（默认本企业所有
 * 进行中的项目）。企业里的“批量开通”和训练营的“批量发账号”是同一个弹窗；一行失败不影响其他行，
 * 结果（含只显示一次的初始密码）交给账号清单弹窗。
 */
export function BulkAccountsDialog({
  open,
  onClose,
  enterpriseId,
  projects,
  title = "批量开通成员账号",
  onIssued,
}: {
  open: boolean;
  onClose: () => void;
  enterpriseId: number;
  /** 可以加入的项目（本企业的；已归档的不会列出来）。 */
  projects: { id: number; name: string; status?: string | null }[];
  title?: string;
  onIssued: (rows: IssuedRow[]) => void;
}) {
  const active = projects.filter((p) => p.status !== "archived");
  const [text, setText] = useState("");
  const [projectIds, setProjectIds] = useState<number[]>(() => defaultJoinProjectIds(projects));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setProjectIds(defaultJoinProjectIds(projects));
  }
  const create = useOpsMutation(opsApi.createUsers);
  const { rows, problems } = parseMemberTable(text);
  const busy = create.isPending;

  const run = () =>
    create.mutate(
      { enterpriseId, projectIds, rows },
      {
        onSuccess: ({ results }) => {
          setText("");
          onClose();
          onIssued(
            results.map((r) => ({
              label: r.nickname,
              username: r.username,
              password: r.initialPassword,
              note: r.existed ? (projectIds.length ? "已有账号，已加入项目" : "已有账号") : undefined,
              ok: r.ok,
              error: r.error,
            })),
          );
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>列依次是：姓名、登录名、手机、邮箱、部门。</DialogDescription>
        </DialogHeader>
        <ImportSource template={MEMBER_TEMPLATE} onText={setText} />
        <Textarea
          autoFocus
          aria-label="成员名单"
          className="min-h-32 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"赵部长\thc_zhao\t13800000002\t\t市场营销部\n李专员\thc_li\t\tli@example.com\t"}
          disabled={busy}
        />
        {rows.length ? (
          <ul className="max-h-40 overflow-y-auto rounded-lg border text-xs">
            {rows.map((r) => (
              <li key={r.username} className="flex gap-2 border-b px-3 py-1.5 last:border-b-0">
                <span className="font-medium">{r.nickname}</span>
                <span className="text-muted-foreground">{[r.username, r.phone, r.email, r.dept].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {problems.length ? <p className="text-xs text-[color:var(--dz-warn)]">{problems.join("；")}</p> : null}
        <ProjectPicker projects={active} selected={projectIds} onChange={setProjectIds} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button disabled={!rows.length || busy} onClick={run}>
            {busy ? "开通中…" : `开通 ${rows.length || ""} 个账号`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
