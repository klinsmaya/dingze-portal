import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  type Actor,
  type ArtifactStatus,
  type LifecycleAction,
  type SelfReviewAnswer,
  canPerform,
  missingSelfReview,
  selfReviewChecklist,
  validationApplies,
} from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

import { confirmSummary } from "@/lib/dingze/confirm-summary";

import { askCoach } from "./coach-panel";
import { pathNamer } from "./edit-session";

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
  { action: "selfReview", label: "自查复核", from: ["step_done"] },
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
    reason: { title: "解锁重开", description: "保留原定版版本；重开后引用它的下游成果会标“上游已变更”。原因会记入审计。" },
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
  /** Validation suggestions still open (自查复核 asks about each). */
  warnings?: string[];
  /** Unresolved comment threads, shown before 确认定版. */
  openComments?: number;
};

export function ArtifactActions({ project, code, title, detail, actor, dirty, blocking, warnings = [], openComments = 0 }: Props) {
  const [selfReviewing, setSelfReviewing] = useState(false);
  const status = detail.artifact?.status ?? "not_started";
  const transition = useTransitionArtifact(project, code);
  const [reasonFor, setReasonFor] = useState<ActionSpec | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [introFor, setIntroFor] = useState<ActionSpec | null>(null);

  const visible = ACTIONS.filter((a) => a.from.includes(status) && canPerform(a.action, actor));
  if (visible.length === 0) return null;

  const run = (spec: ActionSpec, reason?: string, answers?: SelfReviewAnswer[]) =>
    transition.mutate(
      { action: spec.action, reason, answers },
      {
        onSuccess: (result) => {
          toast.success(`${spec.label}：已完成`);
          if (result.stale.length) toast.info(`已提示下游成果：${result.stale.join("、")}`);
          setReasonFor(null);
          setConfirming(false);
          setSelfReviewing(false);
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );

  const disabledReasonOf = (spec: ActionSpec) => {
    const needsCleanDraft = spec.action === "stepDone" || spec.action === "approve" || spec.action === "selfReview" || spec.action === "confirm" || spec.action === "forceLock";
    return dirty && needsCleanDraft
      ? "请先保存修改"
      : blocking > 0 && needsCleanDraft && validationApplies(spec.action, !!detail.artifact?.exception)
        ? `还有 ${blocking} 处未通过校验`
        : undefined;
  };
  const trigger = (spec: ActionSpec) => {
    if (spec.action === "selfReview") setSelfReviewing(true);
    else if (spec.reason) setReasonFor(spec);
    else if (spec.action === "confirm") setConfirming(true);
    else if (spec.action === "stepDone" && !flowIntroSeen()) setIntroFor(spec);
    else run(spec);
  };
  // One clear next action (design 10 header); the rest under “⋯”.
  const primary = visible.find((a) => !a.variant || a.variant === "default") ?? visible[0];
  const rest = visible.filter((a) => a !== primary);
  const primaryReason = disabledReasonOf(primary);

  return (
    <div className="flex items-center gap-1">
      <Button disabled={transition.isPending || !!primaryReason} title={primaryReason} onClick={() => trigger(primary)} size="sm">
        {primary.label}
      </Button>
      {rest.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="更多流转操作" />}>
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {rest.map((spec) => {
              const reason = disabledReasonOf(spec);
              return (
                <DropdownMenuItem key={spec.action} disabled={transition.isPending || !!reason} onClick={() => trigger(spec)} title={reason}>
                  {spec.label}
                  {reason ? <span className="ml-auto text-[11px] text-muted-foreground">{reason}</span> : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <FlowIntroDialog
        open={!!introFor}
        pending={transition.isPending}
        onClose={() => setIntroFor(null)}
        onContinue={() => {
          markFlowIntroSeen();
          if (introFor) run(introFor);
          setIntroFor(null);
        }}
      />
      <SelfReviewDialog
        open={selfReviewing}
        code={code}
        title={title}
        warnings={warnings}
        pending={transition.isPending}
        onClose={() => setSelfReviewing(false)}
        onSubmit={(answers) => run(ACTIONS.find((a) => a.action === "selfReview")!, undefined, answers)}
      />
      <ReasonDialog spec={reasonFor} pending={transition.isPending} onClose={() => setReasonFor(null)} onSubmit={run} />
      <ConfirmDialog
        open={confirming}
        title={title}
        warnings={warnings}
        openComments={openComments}
        reopener={actor.service === "self" ? "企业项目负责人" : "主咨询师"}
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

const INTRO_KEY = "dingze:flow-intro-seen";

function flowIntroSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function markFlowIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Private mode: the explanation simply shows again next time.
  }
}

const FLOW = [
  ["本步完成", "你这边填完了。表格仍可修改，下一步把它提交给顾问。"],
  ["顾问复核", "顾问看过后，要么通过，要么写明原因退回给你改。"],
  ["企业定版", "顾问通过后，由企业项目负责人确认定版。"],
  ["锁定", "定版后只读，作为后面各表的依据；要改只能请主咨询师解锁重开。"],
] as const;

/** First “本步完成”: explain what happens after it, once per browser (usability #7). */
function FlowIntroDialog({ open, pending, onClose, onContinue }: { open: boolean; pending: boolean; onClose: () => void; onContinue: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>点了“本步完成”之后会怎样？</DialogTitle>
          <DialogDescription>每张表都走这四步，你随时能在表头看到它走到哪了。</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-2.5">
          {FLOW.map(([name, text], i) => (
            <li key={name} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">{i + 1}</span>
              <span>
                <span className="font-semibold">{name}</span>
                <span className="text-muted-foreground"> — {text}</span>
              </span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            再改改
          </Button>
          <Button disabled={pending} onClick={onContinue}>
            知道了，本步完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  warnings,
  openComments,
  reopener,
  detail,
  project,
  code,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  warnings: string[];
  openComments: number;
  /** Who may reopen it later: 主咨询师, or the enterprise lead on a self-service project. */
  reopener: string;
  detail: ArtifactDetail;
  project: ProjectSummary;
  code: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const rev = detail.artifact?.currentRev;
  const current = detail.artifact?.currentVersion?.payload;
  const locked = detail.artifact?.lockedVersion;
  const summary = open ? confirmSummary(code, current, locked ? { rev: locked.rev, payload: locked.payload } : null, pathNamer(current)) : null;
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-brand">确认并定版《{title}》</DialogTitle>
          <DialogDescription>
            定版后这份成果成为正式输入，供后续成果引用。版本：v{rev}。之后如需修改，要由{reopener}解锁重开。
          </DialogDescription>
        </DialogHeader>
        {summary ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-semibold">
              {summary.firstLock ? "首次定版" : `与上一定版 v${summary.lockedRev} 相比：${summary.total ? `改了 ${summary.total} 处` : "没有改动"}`}
            </div>
            {summary.changes.length ? (
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
                {summary.changes.map((c, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{c.where}：</span>
                    {c.kind === "added" ? `新增 ${c.after}` : c.kind === "removed" ? `删除 ${c.before}` : `${c.before} → ${c.after}`}
                  </li>
                ))}
                {summary.total > summary.changes.length ? <li className="text-muted-foreground">……另有 {summary.total - summary.changes.length} 处，在“修改”里看全部</li> : null}
              </ul>
            ) : null}
            {warnings.length || openComments ? (
              <div className="text-xs text-[color:var(--dz-warn)]">
                {[warnings.length && `还有 ${warnings.length} 条校验建议没处理`, openComments && `${openComments} 条批注未解决`].filter(Boolean).join("；")}——不挡定版，但请确认可以接受。
              </div>
            ) : null}
            {summary.downstream.length ? (
              <div className="text-xs text-muted-foreground">定版后，这些表以它为依据：{summary.downstream.join("、")}</div>
            ) : null}
          </div>
        ) : null}
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

const KIND_TITLE = { gate: "书中定版门禁", pitfall: "常见的坑", warning: "还没处理的校验建议" } as const;

/**
 * 自查复核（自助项目）：企业项目负责人逐条对照；每条要么确认“没问题”，要么写下为什么保持现状。
 * 服务端会按同一份清单重新核对，漏一条都过不去。
 */
function SelfReviewDialog({
  open,
  code,
  title,
  warnings,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  code: string;
  title: string;
  warnings: string[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (answers: SelfReviewAnswer[]) => void;
}) {
  const items = selfReviewChecklist(code, warnings);
  const [answers, setAnswers] = useState<Record<string, SelfReviewAnswer>>({});
  const list = items.map((i) => answers[i.key] ?? { key: i.key, ok: false, note: "" });
  const missing = missingSelfReview(items, list);
  const set = (key: string, patch: Partial<SelfReviewAnswer>) => setAnswers((a) => ({ ...a, [key]: { ...(a[key] ?? { key, ok: false, note: "" }), ...patch } }));
  const askAi = () => {
    onClose();
    askCoach(`请按书中定版门禁逐条帮我自查《${title}》，每条说“通过”或“待改”并给理由：\n${items.map((i, n) => `${n + 1}. ${i.text}`).join("\n")}`);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>自查复核：《{title}》</DialogTitle>
          <DialogDescription>
            这个项目是自助方式，没有人工咨询师复核。请逐条对照：没问题就勾上；不打算改的写一句理由。全部处理完才能进入待定版，记录会留在审计里。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {(["gate", "pitfall", "warning"] as const).map((kind) => {
            const group = items.filter((i) => i.kind === kind);
            if (!group.length) return null;
            return (
              <section key={kind} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{KIND_TITLE[kind]}</h3>
                {group.map((item) => {
                  const a = answers[item.key];
                  return (
                    <div key={item.key} className="flex flex-col gap-1.5 rounded-lg border p-2.5">
                      <Label className="flex items-start gap-2 font-normal">
                        <Checkbox checked={!!a?.ok} onCheckedChange={(v) => set(item.key, { ok: !!v })} aria-label={`已对照：${item.text}`} />
                        <span className="text-sm leading-snug">{item.text}</span>
                      </Label>
                      {!a?.ok ? (
                        <Textarea
                          aria-label={`保持现状的理由：${item.text}`}
                          placeholder="没问题就勾上；不打算改的，写一句为什么"
                          className="min-h-12 text-sm"
                          value={a?.note ?? ""}
                          onChange={(e) => set(item.key, { note: e.target.value })}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={askAi}>
            请数字咨询师逐条看
          </Button>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{missing.length ? `还有 ${missing.length} 条未处理` : "都处理完了"}</span>
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button disabled={pending || missing.length > 0} onClick={() => onSubmit(list)}>
              完成自查，进入待定版
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
