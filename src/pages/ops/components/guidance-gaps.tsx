import { Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ARTIFACTS, GAP_CATEGORIES, GAP_STATUSES, type GapStatus, canMoveGap } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorMessage } from "@/lib/dingze/errors";
import { type GuidanceGap, useGuidanceGaps, useReviewGuidanceGap } from "@/lib/dingze/guidance-api";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<GapStatus, string> = {
  open: "border-gold text-brand",
  accepted: "border-brand text-brand",
  rejected: "text-muted-foreground",
  shipped: "border-status-done-foreground text-status-done-foreground",
};

const MOVE_LABELS: Record<GapStatus, string> = { open: "退回待评审", accepted: "采纳", rejected: "不采纳", shipped: "标记已发布" };

function ReviewDialog({ gap, to, onClose }: { gap: GuidanceGap; to: GapStatus; onClose: () => void }) {
  const [note, setNote] = useState(gap.reviewNote);
  const [version, setVersion] = useState(gap.shippedVersion);
  const review = useReviewGuidanceGap();
  const needsNote = to === "rejected";
  const needsVersion = to === "shipped";
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{MOVE_LABELS[to]}</DialogTitle>
          <DialogDescription className="line-clamp-3">{gap.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gap-review-note">评审意见{needsNote ? "（必填）" : ""}</Label>
            <Textarea id="gap-review-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={needsNote ? "说明不采纳的理由，会通知记录人。" : "如何修改规则、由谁修改。"} />
          </div>
          {needsVersion ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gap-version">发布版本（必填）</Label>
              <Input id="gap-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="如 0.13.0" />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={review.isPending || (needsNote && !note.trim()) || (needsVersion && !version.trim())}
            onClick={() =>
              review.mutate(
                { id: gap.id, status: to, reviewNote: note.trim(), shippedVersion: version.trim() },
                {
                  onSuccess: () => {
                    toast.success(`已${MOVE_LABELS[to]}，已通知记录人`);
                    onClose();
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                }
              )
            }
          >
            {MOVE_LABELS[to]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GapCard({ gap, onMove }: { gap: GuidanceGap; onMove: (to: GapStatus) => void }) {
  const def = ARTIFACTS.find((a) => a.code === gap.code);
  const moves = (["accepted", "rejected", "shipped", "open"] as const).filter((to) => canMoveGap(gap.status, to));
  return (
    <li className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={cn("font-normal", STATUS_TONE[gap.status])}>
          {GAP_STATUSES[gap.status]}
        </Badge>
        <Badge variant="secondary" className="font-normal">
          {GAP_CATEGORIES[gap.category] ?? gap.category}
        </Badge>
        <span className="font-mono">{gap.code}</span>
        <span>{def?.name}</span>
        <span>·</span>
        <span>
          {gap.author || "—"} 记录于 {formatTime(gap.at)}
        </span>
        {gap.project ? <span>· {gap.project.enterprise} / {gap.project.name}</span> : null}
        {gap.pluginVersion ? <span>· 规则包 {gap.pluginVersion}</span> : null}
      </div>
      <p className="text-sm whitespace-pre-wrap">{gap.description}</p>
      {gap.expected ? (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">
          <span className="font-medium text-foreground">期望：</span>
          {gap.expected}
        </p>
      ) : null}
      {gap.excerpt ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">对话摘录</summary>
          <p className="mt-1 rounded-md bg-muted px-3 py-2 whitespace-pre-wrap">{gap.excerpt}</p>
        </details>
      ) : null}
      {gap.reviewNote || gap.shippedVersion ? (
        <p className="rounded-md border-l-2 border-gold bg-muted/50 px-3 py-1.5 text-xs">
          {gap.reviewer || "评审"}（{formatTime(gap.reviewedAt)}）：{gap.reviewNote || "—"}
          {gap.status === "shipped" && gap.shippedVersion ? `｜已随插件 ${gap.shippedVersion} 发布` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {moves.map((to) => (
          <Button key={to} size="sm" variant={to === "accepted" || to === "shipped" ? "default" : "outline"} onClick={() => onMove(to)}>
            {MOVE_LABELS[to]}
          </Button>
        ))}
      </div>
    </li>
  );
}

/** 引导缺口评审: what consultants recorded, reviewed into the next rule-pack release. */
export function GuidanceGapsSection() {
  const gaps = useGuidanceGaps();
  const [status, setStatus] = useState<GapStatus | "all">("open");
  const [moving, setMoving] = useState<{ gap: GuidanceGap; to: GapStatus } | null>(null);
  const all = gaps.data ?? [];
  const shown = status === "all" ? all : all.filter((g) => g.status === status);

  if (gaps.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>引导缺口加载失败</AlertTitle>
        <AlertDescription>{errorMessage(gaps.error)}</AlertDescription>
      </Alert>
    );
  }
  if (gaps.isLoading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        咨询师在工作台右侧“记录引导缺口”。采纳后由方法论负责人改写 Skill 规则并随新版插件发布，再标记“已发布”；每次评审都会通知记录人。
      </p>
      <ToggleGroup value={[status]} onValueChange={(v) => v[0] && setStatus(v[0] as GapStatus | "all")} variant="outline" size="sm" className="flex-wrap">
        {(["open", "accepted", "shipped", "rejected"] as const).map((s) => (
          <ToggleGroupItem key={s} value={s}>
            {GAP_STATUSES[s]} {all.filter((g) => g.status === s).length}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="all">全部 {all.length}</ToggleGroupItem>
      </ToggleGroup>
      {shown.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Flag />
            </EmptyMedia>
            <EmptyTitle>{status === "open" ? "没有待评审的缺口" : "这里还没有记录"}</EmptyTitle>
            <EmptyDescription>咨询师记录的引导缺口会出现在这里。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {shown.map((gap) => (
            <GapCard key={gap.id} gap={gap} onMove={(to) => setMoving({ gap, to })} />
          ))}
        </ul>
      )}
      {moving ? <ReviewDialog key={`${moving.gap.id}-${moving.to}`} gap={moving.gap} to={moving.to} onClose={() => setMoving(null)} /> : null}
    </div>
  );
}
