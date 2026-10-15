import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { type ProjectSummary, transitionArtifact } from "@/lib/dingze/api";
import { errorMessage } from "@/lib/dingze/errors";
import type { ImpactRow } from "@/lib/dingze/impact";
import { workspacePath } from "@/lib/dingze/progress";
import { cn } from "@/lib/utils";

/** 影响清单的表格：直接下游在前，更下游的标明经由哪张表。 */
export function ImpactTable({
  project,
  rows,
  picked,
  onPick,
  onOpen,
}: {
  project: ProjectSummary;
  rows: ImpactRow[];
  /** Locked, stale direct downstream that may be reopened together. */
  picked?: Set<string>;
  onPick?: (code: string, on: boolean) => void;
  onOpen?: () => void;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">没有已开始的下游表，不影响其他表。</p>;
  return (
    <ul className="flex flex-col divide-y rounded-lg border text-sm">
      {rows.map((r) => {
        const pickable = !!onPick && r.depth === 1 && r.status === "locked" && r.stale;
        return (
          <li key={r.code} className={cn("flex items-center gap-2 px-3 py-2", r.depth === 2 && "pl-8 text-muted-foreground")}>
            {onPick ? (
              <Checkbox disabled={!pickable} checked={pickable && !!picked?.has(r.code)} onCheckedChange={(v) => onPick(r.code, !!v)} aria-label={`一起解锁重开 ${r.name}`} />
            ) : null}
            <Link to={workspacePath(project.id, r.code)} onClick={onOpen} className="min-w-0 flex-1 truncate hover:underline">
              <span className="font-medium text-foreground">{r.name}</span> <span className="text-xs text-muted-foreground">{r.specId}</span>
              {r.via ? <span className="ml-1 text-xs">（经由{r.via}）</span> : null}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">{r.statusLabel}</span>
            {r.stale ? <span className="shrink-0 rounded bg-status-stale px-1.5 text-[11px] text-status-stale-foreground">待核对</span> : r.depth === 2 ? <span className="shrink-0 text-[11px]">上一层完成后提示</span> : <span className="shrink-0 text-[11px] text-[color:var(--dz-ok)]">已核对</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** 影响清单：这张表的下游现在各是什么状态；已定版且待核对的可以勾选后一起解锁重开。 */
export function ImpactDialog({
  project,
  title,
  rows,
  open,
  onClose,
  canReopen,
}: {
  project: ProjectSummary;
  title: string;
  rows: ImpactRow[];
  open: boolean;
  onClose: () => void;
  /** Enterprise lead / lead consultant (自助：企业项目负责人) may reopen the locked downstream together. */
  canReopen: boolean;
}) {
  const client = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const waiting = rows.filter((r) => r.stale).length;
  const reopenTogether = async () => {
    setBusy(true);
    const done: string[] = [];
    try {
      for (const code of picked) {
        await transitionArtifact(project.spaceName, { projectId: project.id, code, action: "reopen", reason: reason.trim() });
        done.push(code);
      }
      toast.success(`已解锁重开 ${done.length} 张表`);
      setPicked(new Set());
      onClose();
    } catch (error) {
      toast.error(`${done.length ? `已重开 ${done.length} 张，` : ""}${errorMessage(error)}`);
    } finally {
      setBusy(false);
      await client.invalidateQueries({ queryKey: ["dingze"] });
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>影响清单 · {title}</DialogTitle>
          <DialogDescription>
            {waiting ? `有 ${waiting} 张下游表待核对。` : "下游表都已核对。"}打开每张表，看“上游改了什么”，跟着改好后点“已核对”；已定版的表不受影响就点“已核对，保持定版”，要改就解锁重开。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto">
          <ImpactTable
            project={project}
            rows={rows}
            picked={picked}
            onPick={canReopen ? (code, on) => setPicked((s) => { const n = new Set(s); if (on) n.add(code); else n.delete(code); return n; }) : undefined}
            onOpen={onClose}
          />
        </div>
        {canReopen && picked.size ? (
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`一起解锁重开 ${picked.size} 张表的原因（必填，记入审计并通知项目成员和咨询师）`} className="min-h-14" />
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {canReopen && picked.size ? (
            <Button disabled={busy || !reason.trim()} onClick={() => void reopenTogether()}>
              一起解锁重开 {picked.size} 张
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
