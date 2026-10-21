import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectSummary } from "@/lib/dingze/api";
import { describeChanges } from "@/lib/dingze/confirm-summary";
import { errorMessage } from "@/lib/dingze/errors";
import { formatTime } from "@/lib/dingze/records";
import { useAcknowledgeUpstream, useUpstreamChanges } from "@/lib/dingze/queries";
import { workspacePath } from "@/lib/dingze/progress";

import { pathNamer } from "./edit-session";

const KIND = { added: "新增", removed: "删除", changed: "改为" } as const;

/**
 * 上游已变更 → 上游改了什么（客户反馈 2026-10-15：各工具产出要连贯）。不再“保存一次就消失”：
 * 看过改动、本表跟着调整（或确认不受影响）后点“已核对”。
 */
export function UpstreamChangesDialog({
  project,
  code,
  open,
  onClose,
  locked,
  canAcknowledge,
}: {
  project: ProjectSummary;
  code: string;
  open: boolean;
  onClose: () => void;
  locked: boolean;
  /** Who may clear it: editors for a draft; the enterprise lead or lead consultant for a locked table. */
  canAcknowledge: boolean;
}) {
  const changes = useUpstreamChanges(project, code, open);
  const ack = useAcknowledgeUpstream(project, code);
  const [note, setNote] = useState("");
  const list = changes.data?.changes ?? [];
  const reopened = list.filter((c) => c.reopened);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>上游改了什么</DialogTitle>
          <DialogDescription>
            {locked
              ? "这张表已定版。看完上游的改动：要跟着改就“解锁重开”；不受影响就点“已核对，保持定版”。下载的始终是定版内容。"
              : "看完上游的改动，把本表需要跟着改的地方改好（校验条里能一键“按上游更新”的先点），保存后点“已核对”。"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto text-sm">
          {changes.isLoading ? <Skeleton className="h-24" /> : null}
          {changes.error ? <p className="text-destructive">{errorMessage(changes.error)}</p> : null}
          {!changes.isLoading && !list.length ? <p className="text-muted-foreground">{changes.data?.staleReason ?? "上游表有新版本"}。没有找到可对比的内容差异，请打开上游表核对。</p> : null}
          {list.map((c) => {
            const diff = c.from && c.to ? describeChanges(c.from.payload, c.to.payload, pathNamer(c.to.payload)) : null;
            return (
              <section key={c.code} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link to={workspacePath(project.id, c.code)} onClick={onClose} className="font-semibold text-primary hover:underline">
                    {c.specId} {c.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.from ? `v${c.from.rev}` : "（之前没有）"} → {c.to ? `v${c.to.rev}（${formatTime(c.to.at)}）` : "（还没有可读的版本）"}
                  </span>
                  {c.reopened ? <span className="rounded bg-status-stale px-1.5 text-xs text-status-stale-foreground">已解锁重开，正在修改</span> : null}
                </div>
                {diff ? (
                  diff.total ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {diff.changes.map((d, i) => (
                        <li key={i} className="text-xs">
                          <span className="font-medium">{d.where}</span>：{d.kind === "added" ? `新增 ${d.after}` : d.kind === "removed" ? `删除 ${d.before}` : `${d.before} ${KIND.changed} ${d.after}`}
                        </li>
                      ))}
                      {diff.total > diff.changes.length ? <li className="text-xs text-muted-foreground">……另有 {diff.total - diff.changes.length} 处，打开上游表的“修改”看全部</li> : null}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">内容没有变化（只是重新完成或定版）。</p>
                  )
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">没有可对比的旧版本，请打开上游表核对。</p>
                )}
              </section>
            );
          })}
        </div>
        {canAcknowledge ? (
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="说明一下核对结果（选填，会记在审计里），如：已按新路径调整承接部门" className="min-h-14" />
        ) : (
          <p className="text-xs text-muted-foreground">{locked ? "由企业项目负责人或主咨询师确认是否受影响。" : "由能修改这张表的人核对。"}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {canAcknowledge ? (
            <span title={reopened.length ? `${reopened.map((r) => r.name).join("、")}正在修改，等它重新完成后再核对` : undefined}>
              <Button
                disabled={ack.isPending || reopened.length > 0}
                onClick={() =>
                  ack.mutate(note.trim() || undefined, {
                    onSuccess: () => {
                      toast.success("已核对，上游变更提示已消除");
                      onClose();
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                {locked ? "已核对，保持定版" : "已核对"}
              </Button>
            </span>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
