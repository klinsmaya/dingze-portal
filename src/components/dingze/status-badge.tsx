import { STATUS_LABELS, type ArtifactStatus } from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Status is told apart by color, dot shape and text, never by hue alone.
const STATUS_STYLES: Record<ArtifactStatus, { badge: string; dot: string }> = {
  not_started: { badge: "border-input bg-card text-muted-foreground", dot: "rounded-full border-2 border-muted-foreground bg-card" },
  in_progress: { badge: "bg-status-progress text-status-progress-foreground", dot: "rounded-full bg-status-progress-foreground" },
  step_done: { badge: "bg-status-done text-status-done-foreground", dot: "rounded-full bg-status-done-foreground" },
  in_review: { badge: "bg-status-review text-status-review-foreground", dot: "rounded-[2px] bg-status-review-foreground" },
  pending_confirm: { badge: "bg-status-confirm text-status-confirm-foreground", dot: "rounded-[2px] bg-status-confirm-foreground" },
  locked: { badge: "bg-status-locked text-status-locked-foreground", dot: "rounded-full bg-gold" },
  archived: { badge: "bg-muted text-muted-foreground", dot: "rounded-full bg-muted-foreground" },
};

export function StatusDot({ status, className }: { status: ArtifactStatus; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0", STATUS_STYLES[status].dot, className)} />;
}

export function StatusBadge({
  status,
  stale,
  className,
}: {
  status: ArtifactStatus;
  stale?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <Badge className={cn("gap-1.5 font-semibold", STATUS_STYLES[status].badge)}>
        <StatusDot status={status} />
        {STATUS_LABELS[status]}
      </Badge>
      {stale ? (
        <Badge className="gap-1.5 border-destructive/30 bg-status-stale font-semibold text-status-stale-foreground">
          <span aria-hidden className="inline-block size-2 rounded-[2px] bg-destructive" />
          上游已变更
        </Badge>
      ) : null}
    </span>
  );
}

export function LockedStepBadge() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      待解锁
    </Badge>
  );
}
