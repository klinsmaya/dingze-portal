import { useState } from "react";
import { toast } from "sonner";

import {
  type Actor,
  type ArtifactStatus,
  type LifecycleAction,
  canPerform,
  validationApplies,
} from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ArtifactDetail, ProjectSummary } from "@/lib/dingze/api";
import { errorMessage } from "@/lib/dingze/errors";
import { useRecordDissent, useTransitionArtifact } from "@/lib/dingze/queries";

type Transition = Exclude<LifecycleAction, "save">;

type ActionSpec = {
  action: Transition;
  label: string;
  from: ArtifactStatus[];
  variant?: "default" | "outline" | "destructive";
  reason?: { title: string; description: string };
};

const ACTIONS: ActionSpec[] = [
  { action: "stepDone", label: "本步完成", from: ["in_progress"] },
  { action: "submitReview", label: "提交复核", from: ["step_done"] },
  { action: "approve", label: "复核通过，提交企业确认", from: ["in_review"] },
  {
    action: "returnToEdit",
    label: "退回修改",
    from: ["in_review", "pending_confirm"],
    variant: "outline",
    reason: { title: "退回修改", description: "写清楚需要改什么，退回后成果回到“进行中”。" },
  },
  { action: "confirm", label: "确认定版", from: ["pending_confirm"] },
  {
    action: "reopen",
    label: "解锁重开",
    from: ["locked"],
    variant: "outline",
    reason: { title: "解锁重开", description: "保留原定版版本；重开后引用它的下游成果会标“上游已变更”。" },
  },
];

type Props = {
  project: ProjectSummary;
  code: string;
  title: string;
  detail: ArtifactDetail;
  actor: Actor;
  dirty: boolean;
  blocking: number;
};

export function ArtifactActions({ project, code, title, detail, actor, dirty, blocking }: Props) {
  const status = detail.artifact?.status ?? "not_started";
  const transition = useTransitionArtifact(project, code);
  const [reasonFor, setReasonFor] = useState<ActionSpec | null>(null);
  const [confirming, setConfirming] = useState(false);

  const visible = ACTIONS.filter((a) => a.from.includes(status) && canPerform(a.action, actor));
  if (visible.length === 0) return null;

  const run = (spec: ActionSpec, reason?: string) =>
    transition.mutate(
      { action: spec.action, reason },
      {
        onSuccess: (result) => {
          toast.success(`${spec.label}：已完成`);
          if (result.stale.length) toast.info(`已提示下游成果：${result.stale.join("、")}`);
          setReasonFor(null);
          setConfirming(false);
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((spec) => {
        const needsCleanDraft = spec.action === "stepDone" || spec.action === "approve" || spec.action === "confirm" || spec.action === "forceLock";
        const disabledReason = dirty && needsCleanDraft
          ? "请先保存修改"
          : blocking > 0 && needsCleanDraft && validationApplies(spec.action, !!detail.artifact?.exception)
            ? `还有 ${blocking} 处未通过校验`
            : undefined;
        return (
          <Button
            key={spec.action}
            variant={spec.variant ?? "default"}
            disabled={transition.isPending || !!disabledReason}
            title={disabledReason}
            onClick={() => {
              if (spec.reason) setReasonFor(spec);
              else if (spec.action === "confirm") setConfirming(true);
              else run(spec);
            }}
          >
            {spec.label}
          </Button>
        );
      })}

      <ReasonDialog spec={reasonFor} pending={transition.isPending} onClose={() => setReasonFor(null)} onSubmit={run} />
      <ConfirmDialog
        open={confirming}
        title={title}
        detail={detail}
        project={project}
        code={code}
        pending={transition.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() => run(ACTIONS.find((a) => a.action === "confirm")!)}
      />
    </div>
  );
}

function ReasonDialog({
  spec,
  pending,
  onClose,
  onSubmit,
}: {
  spec: ActionSpec | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (spec: ActionSpec, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!spec} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{spec?.reason?.title}</DialogTitle>
          <DialogDescription>{spec?.reason?.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transition-reason">原因（必填，随审计记录保存）</Label>
          <Textarea id="transition-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button disabled={!reason.trim() || pending} onClick={() => spec && onSubmit(spec, reason.trim())}>
            {spec?.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  title,
  detail,
  project,
  code,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  detail: ArtifactDetail;
  project: ProjectSummary;
  code: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const rev = detail.artifact?.currentRev;
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-brand">确认并定版《{title}》</DialogTitle>
          <DialogDescription>
            定版后这份成果成为正式输入，供后续成果引用。版本：v{rev}。之后如需修改，要由咨询师解锁重开。
          </DialogDescription>
        </DialogHeader>
        <DissentList detail={detail} project={project} code={code} />
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" />
          <span>我代表企业确认此版本，并知晓定版后修改需要解锁重开</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button disabled={!acknowledged || pending} onClick={onConfirm} className="bg-brand text-brand-foreground hover:bg-brand/90">
            确认定版
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** “反对但承诺执行”: dissent is recorded with the version, never as a vote. */
export function DissentList({ detail, project, code }: { detail: ArtifactDetail; project: ProjectSummary; code: string }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const record = useRecordDissent(project, code);
  const canRecord = detail.projectRole === "ent_lead" || detail.projectRole === "dept_head" || detail.projectRole === "member";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-book-border bg-book p-3 text-sm text-book-foreground">
      <div className="font-semibold">团队异议（反对但承诺执行）· {detail.dissents.length} 条</div>
      {detail.dissents.map((d) => (
        <p key={d.id}>
          <span className="font-semibold">{d.createdBy?.nickname ?? "成员"}：</span>
          {d.content}
        </p>
      ))}
      {canRecord && detail.artifact?.currentRev ? (
        open ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="dissent" className="text-book-foreground">我的异议</Label>
            <Textarea id="dissent" value={draft} onChange={(e) => setDraft(e.target.value)} className="bg-card" />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!draft.trim() || record.isPending}
                onClick={() =>
                  record.mutate(draft.trim(), {
                    onSuccess: () => {
                      setDraft("");
                      setOpen(false);
                      toast.success("异议已记录");
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                记录
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="link" className="self-start px-0 text-book-foreground" onClick={() => setOpen(true)}>
            我也要记录一条异议
          </Button>
        )
      ) : null}
    </div>
  );
}
