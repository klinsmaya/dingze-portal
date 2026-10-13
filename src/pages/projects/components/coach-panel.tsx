import { Check, CircleCheck, Ellipsis, Eye, FolderOpen, History, Paperclip, MessageSquarePlus, MessageSquareText, PencilLine, Sparkles, TriangleAlert } from "lucide-react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import {
  AIChatWindow,
  AIToolRendererProvider,
  type AIToolRendererMap,
  type AIToolRendererProps,
} from "@/extensions/nocobase-ai/components";
import {
  AIChatProvider,
  useAI,
  useAIChatBase,
  useAIChatController,
  useAIChatMessages,
  useAIPageContextScope,
} from "@/extensions/nocobase-ai/providers";
import { INCOMPLETE_ROW_MESSAGE, type StageKey, bookNote, diffPayloads, getArtifactDef, isArtifactCode } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MATERIAL_ACCEPT } from "@/lib/dingze/extract-text";
import { useMaterials } from "@/lib/dingze/materials-api";
import { type ChangeOp, OP_LABELS, type ProposedChange, applyChanges, describeValue } from "@/lib/dingze/changes";
import { COACH_BY_STAGE, PROPOSE_TOOL } from "@/lib/dingze/coach";
import { cn } from "@/lib/utils";
import { RegionErrorBoundary } from "@/components/dingze/region-error-boundary";
import { getAt, preview } from "@/lib/dingze/edit-log";

import { useProjectContext } from "../project-context";
import { type EditSession, useEditSession } from "./edit-session";
import { useMaterialUpload } from "./material-shared";

const SAY = "dz:coach-say";

/** Put a first sentence into the digital consultant's composer and send it. */
export function askCoach(text: string, send = true) {
  if (send) lastSendAt = Date.now();
  window.dispatchEvent(new CustomEvent(SAY, { detail: { text, send } }));
}

/** When the user last sent something here: a change card arriving after that previews right away. */
let lastSendAt = 0;

type ProposalArgs = { summary?: string; changes?: ProposedChange[] };

function readProposal(part: AIToolRendererProps["part"]): {
  toolId?: string;
  args: ProposalArgs;
} {
  const input =
    (part as { input?: { toolId?: string; args?: ProposalArgs } }).input ?? {};
  return { toolId: input.toolId, args: input.args ?? {} };
}

/**
 * NocoBase streams the tool result back as the bare `content` string, with the
 * frontend tool's `status` (or a rejection) kept on the call's provider metadata.
 */
function readOutcome(part: AIToolRendererProps["part"]) {
  const { state, output, errorText } = part as {
    state?: string;
    output?: unknown;
    errorText?: string;
  };
  const meta = (
    part as { callProviderMetadata?: { nocobase?: Record<string, unknown> } }
  ).callProviderMetadata?.nocobase;
  const result =
    output && typeof output === "object"
      ? (output as { status?: string; content?: string })
      : undefined;
  const message =
    typeof output === "string" ? output : (result?.content ?? errorText);
  const status = String(result?.status ?? meta?.status ?? "").toLowerCase();
  const invoke = String(meta?.invokeStatus ?? "").toLowerCase();
  const ok =
    state === "output-available" &&
    status !== "error" &&
    !invoke.startsWith("reject");
  return { ok, message };
}

/**
 * The suggestion card for `dingzeProposeChanges`: dashed amber while waiting, and the
 * change is only written after the user presses “确认写入”.
 */
function SuggestionCard({
  part,
  disabled,
  onApprove,
  onReject,
  onRevise,
}: AIToolRendererProps) {
  const { args } = readProposal(part);
  const state = (part as { state?: string }).state;
  // A card arriving within minutes of the user's message is live; replayed history does not preview.
  const live = useRef<boolean | null>(null);
  if (live.current === null) live.current = state === "input-streaming" || Date.now() - lastSendAt < 5 * 60_000;
  // 不采纳 takes effect on the click: the card closes and its preview goes away at once, without
  // waiting for the conversation to come back (验收 D02).
  const [rejected, setRejected] = useState(false);
  const decided =
    rejected ||
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied";
  const changes = args.changes ?? [];
  const reject: typeof onReject = (reason) => {
    setRejected(true);
    return onReject(reason);
  };

  if (decided) {
    const outcome = readOutcome(part);
    const ok = !rejected && outcome.ok;
    const message = rejected && !outcome.message ? "表里没有任何改动。" : outcome.message;
    return (
      <div className="rounded-xl border bg-card p-3 text-sm">
        <div
          className={
            ok
              ? "text-xs font-bold text-status-done-foreground"
              : "text-xs font-bold text-muted-foreground"
          }
        >
          {ok ? "已写入草稿" : "未采纳"}
        </div>
        <div className={ok ? "" : "text-muted-foreground line-through"}>
          {args.summary ?? changes.map((c) => c.label ?? c.path).join("、")}
        </div>
        {message ? (
          <div className="mt-1 text-xs text-muted-foreground">{message}</div>
        ) : null}
      </div>
    );
  }

  return (
    <RegionErrorBoundary
      title="这条修改建议显示不了"
      description="建议的内容不完整，表里没有任何改动。可以不采纳，再让数字咨询师重出。"
      action={disabled ? undefined : { label: "不采纳", onClick: () => reject("建议内容不完整，用户不采纳") }}
      resetKeys={[JSON.stringify(args)]}
    >
      <PendingCard args={args} live={live.current} disabled={disabled} onApprove={onApprove} onReject={reject} onRevise={onRevise} />
    </RegionErrorBoundary>
  );
}

type CardRow = { no: number | null; op: ChangeOp; name: string; before?: string; after?: string; parts?: { no: number; title: string; amount: string; note?: string }[] };

/** One numbered item per thing the card adds or changes, with the anchor it previews at. */
function cardRows(session: EditSession, changes: ProposedChange[]) {
  const rows: CardRow[] = [];
  const items: { anchor: string; no: number }[] = [];
  let no = 0;
  let prev: unknown = session.draft;
  for (const change of changes) {
    const op = change.op ?? "set";
    const cur = applyChanges(prev, [change]);
    const name = change.label ?? session.nameOf(change.path) ?? change.path;
    const before = getAt(prev, change.path);
    if (op === "split") {
      const added = diffPayloads(prev, cur).filter((d) => d.kind === "added").map((d) => d.path);
      const anchors = [change.path, ...added];
      const parts = (Array.isArray(change.value) ? (change.value as Record<string, unknown>[]) : []).map((p, i): { no: number; title: string; amount: string; note?: string } => {
        const n = ++no;
        if (anchors[i]) items.push({ anchor: anchors[i], no: n });
        const fields = Object.entries(p).filter(([k, v]) => k !== "id" && typeof v === "string" && v) as [string, string][];
        const amount = String(p.value ?? p.amount ?? "");
        return { no: n, title: fields.filter(([k]) => k !== "value" && k !== "metric").map(([, v]) => v)[0] ?? describeValue(p), amount };
      });
      const kids = Array.isArray((cur as { nodes?: { parentId?: string }[] }).nodes) ? (cur as { nodes: { parentId?: string }[] }).nodes.filter((n) => n.parentId === change.path.split(".").pop()).length : 0;
      if (parts[0] && kids) parts[0].note = `原来的 ${kids} 条下级跟到这条`;
      const item = (before ?? {}) as { value?: unknown; unit?: unknown };
      rows.push({ no: null, op, name, before: [name, item.value, item.unit && !String(item.value ?? "").includes(String(item.unit)) ? item.unit : ""].filter(Boolean).join(" "), parts });
    } else if (op === "remove") {
      rows.push({ no: null, op, name, before: name || preview(before, 60) });
    } else if (op === "move") {
      const target = (change.value ?? {}) as { parentId?: string | null };
      const n = ++no;
      items.push({ anchor: change.path, no: n });
      rows.push({ no: n, op, name, after: target.parentId ? `移到「${session.nameOf(`${change.path.split(".").slice(0, -1).join(".")}.${target.parentId}`)}」下` : "移到第一级" });
    } else {
      const n = ++no;
      items.push({ anchor: change.path.replace(/\.\+$/, ""), no: n });
      const append = change.path.endsWith(".+");
      const had = before !== undefined && before !== null && before !== "" && !(Array.isArray(before) && before.length === 0);
      rows.push({ no: n, op, name: `${append ? "新增 · " : ""}${name}`, before: !append && had ? preview(before, 80) : undefined, after: describeValue(change.value) || preview(change.value, 120) });
    }
    prev = cur;
  }
  return { rows, items, next: prev };
}

/**
 * 修改卡 (design 10 画面 6): what changes (拆分 / 修改 / 删除 / 移动, numbered like the amber preview on
 * the canvas), whether the sums still add up, and the comment it will be attached to. Nothing is
 * written until 确认修改.
 */
function PendingCard({
  args,
  live,
  disabled,
  onApprove,
  onReject,
  onRevise,
}: {
  args: ProposalArgs;
  /** Arrived in this session (not replayed history): preview on the canvas right away. */
  live: boolean;
  disabled?: boolean;
  onApprove: AIToolRendererProps["onApprove"];
  onReject: AIToolRendererProps["onReject"];
  onRevise: AIToolRendererProps["onRevise"];
}) {
  const session = useEditSession();
  const changes = useMemo(() => args.changes ?? [], [args.changes]);
  const built = useMemo(() => {
    if (!session) return null;
    try {
      const rows = cardRows(session, changes);
      // A suggestion with an incomplete row must not reach the preview, where editors would trip on it.
      if (session.validate(rows.next).some((i) => i.message === INCOMPLETE_ROW_MESSAGE)) throw new Error("建议里有一条内容不完整");
      return { ...rows, invalid: null as string | null };
    } catch (error) {
      return { rows: [] as CardRow[], items: [], next: session.draft, invalid: error instanceof Error ? error.message : "路径无效" };
    }
  }, [session, changes]);
  const [previewing, setPreviewing] = useState(live);
  // One decision per card: a fast double click must not send both 确认 and 不采纳.
  const [decided, setDecided] = useState(false);
  const decide = (fn: () => void) => () => {
    if (decided) return;
    setDecided(true);
    fn();
  };
  const key = JSON.stringify(built?.items ?? []);
  useEffect(() => {
    if (!session || !built || built.invalid) return;
    if (previewing) session.setPreviewDraft({ payload: built.next, items: built.items });
    else session.setPreview(built.items.map((i) => i.anchor));
    return () => {
      session.setPreviewDraft(null);
      session.setPreview([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, previewing]);

  const impact = useMemo(() => {
    if (!session || !built || built.invalid) return null;
    const errors = (payload: unknown) => session.validate(payload).filter((i) => i.level === "error");
    const before = errors(session.draft);
    const after = errors(built.next);
    return {
      before: before.length,
      after: after.length,
      fixed: before.filter((b) => !after.some((a) => a.message === b.message)),
      added: after.filter((a) => !before.some((b) => b.message === a.message)),
    };
  }, [session, built]);
  // 合计核对: the sums this change touches, before → after (路径 下级合计).
  const checks = useMemo(() => {
    const fn = session?.chrome.current?.checks;
    if (!fn || !built || built.invalid) return [];
    try {
      const was = new Map(fn(session!.draft).map((c) => [c.id, c]));
      const touched = new Set(built.items.map((i) => i.anchor.split(".").pop()));
      return fn(built.next)
        .filter((c) => touched.has(c.id) || was.get(c.id)?.text !== c.text)
        .map((c) => ({ ...c, same: was.get(c.id)?.text === c.text }));
    } catch {
      return [];
    }
  }, [session, built]);
  const comment = session?.activeComment ? session.commentInfo(session.activeComment) : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed p-3 text-sm" style={{ borderColor: "var(--dz-ai)", background: "var(--dz-ai-soft)" }}>
      <div className="flex items-center justify-between gap-2 text-xs font-bold" style={{ color: "var(--dz-ai)" }}>
        <span className="flex items-center gap-1">
          <Sparkles className="size-3.5" /> 修改建议{args.summary ? ` · ${args.summary}` : ""}
        </span>
        <span className="shrink-0">待你确认</span>
      </div>
      {built?.invalid ? <p className="text-xs text-destructive">这条建议对不上表里的位置（{built.invalid}），请让数字咨询师重出。</p> : null}
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {built?.rows.map((row, i) => (
          <li key={i} className="flex flex-col gap-1 px-2.5 py-2">
            <div className="flex items-start gap-1.5">
              {row.op !== "set" ? (
                <span className="shrink-0 rounded border px-1 text-[10px] font-semibold" style={{ color: "var(--dz-ai)", borderColor: "var(--dz-ai)" }}>
                  {OP_LABELS[row.op]}
                </span>
              ) : null}
              {row.no ? <NoBadge no={row.no} /> : null}
              <span className={cn("min-w-0 flex-1 text-xs", row.op === "split" || row.op === "remove" ? "text-destructive line-through" : "text-muted-foreground")}>
                {row.op === "split" || row.op === "remove" ? row.before || row.name : row.name}
              </span>
            </div>
            {row.op === "set" || row.op === "move" ? (
              <div className="ml-6">
                {row.before ? <div className="text-xs text-muted-foreground line-through">{row.before}</div> : null}
                <div className="font-semibold">{row.after}</div>
              </div>
            ) : null}
            {row.parts?.map((p) => (
              <div key={p.no} className="flex items-start gap-1.5">
                <NoBadge no={p.no} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 font-medium">{p.title}</span>
                    <b className="shrink-0 tabular-nums" style={{ color: "var(--dz-ai)" }}>
                      {p.amount}
                    </b>
                  </div>
                  {p.note ? <div className="text-[11px] text-muted-foreground">{p.note}</div> : null}
                </div>
              </div>
            ))}
          </li>
        ))}
      </ul>
      {checks.length || impact ? (
        <div className="flex flex-col gap-1 text-xs">
          {checks.map((c) => (
            <span key={c.id} className="flex items-center gap-1 font-medium" style={{ color: c.ok === false ? "var(--dz-warn)" : "var(--dz-ok)" }}>
              {c.ok === false ? <TriangleAlert className="size-3.5" /> : <CircleCheck className="size-3.5" />}
              {c.label ? `${c.label}：` : ""}
              {c.text}
              {c.same ? " 不变" : ""}
            </span>
          ))}
          {impact && (impact.before || impact.after) ? (
            <span className="text-muted-foreground">
              必须改的问题 {impact.before} → {impact.after}
              {impact.fixed.length ? <span className="text-status-done-foreground">，解决：{impact.fixed.slice(0, 2).map((x) => x.message).join("；")}</span> : null}
              {impact.added.length ? <span className="text-destructive">，新增：{impact.added.slice(0, 2).map((x) => x.message).join("；")}</span> : null}
            </span>
          ) : null}
        </div>
      ) : null}
      {comment ? (
        <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <MessageSquareText className="mt-px size-3 shrink-0" style={{ color: "var(--dz-comment)" }} />
          确认后，这次修改会附在批注 {circledNo(comment.no)} 下，由{comment.author}决定是否解决
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={disabled || decided || !!built?.invalid} onClick={decide(() => onApprove())}>
          <Check /> 确认修改
        </Button>
        <Button size="sm" variant="outline" disabled={disabled || decided} onClick={decide(() => onRevise())}>
          <PencilLine /> 改一下
        </Button>
        <Button size="sm" variant="ghost" disabled={disabled || decided} onClick={decide(() => onReject("用户不采纳这条建议"))}>
          不采纳
        </Button>
        {built && !built.invalid && built.items.length ? (
          <Button size="xs" variant="ghost" className="ml-auto" aria-pressed={previewing} onClick={() => setPreviewing((v) => !v)}>
            <Eye /> {previewing ? "收起预览" : "在图里预览"}
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">确认后写入草稿、记入“修改”，可撤销；保存后生效。</p>
    </div>
  );
}

const circledNo = (n: number) => (n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : String(n));

function NoBadge({ no }: { no: number }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: "var(--dz-ai)" }}>
      {no}
    </span>
  );
}

function ProposalRenderer(props: AIToolRendererProps) {
  const { toolId } = readProposal(props.part);
  if (toolId?.endsWith(`:${PROPOSE_TOOL}`))
    return <SuggestionCard {...props} />;
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      页面工具 {toolId ?? ""}
    </div>
  );
}

const RENDERERS: AIToolRendererMap = {
  executeFrontendTool: {
    component: ProposalRenderer,
    handlesApproval: true,
    standalone: true,
  },
};

/**
 * Typed messages only carry context explicitly attached to the composer, and that is
 * cleared after every send; keep the open artifact attached so the consultant always
 * reads the live draft (the user can still remove the chip for one message).
 */
function AttachPageContext() {
  const pageContext = useAIPageContextScope();
  const { workContext, addWorkContext } = useAIChatBase();
  const empty = workContext.length === 0;
  useEffect(() => {
    if (empty) pageContext.forEach(addWorkContext);
  }, [empty, pageContext, addWorkContext]);
  return null;
}

/** Receives askCoach() calls: fills the composer and sends once the draft is in place. */
function CoachBridge() {
  const { draft, setDraft, send, focusComposer } = useAIChatBase();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    const onSay = (event: Event) => {
      const { text, send: now } = (event as CustomEvent<{ text: string; send: boolean }>).detail;
      setDraft(text);
      if (now) setPending(text);
      else focusComposer();
    };
    window.addEventListener(SAY, onSay);
    return () => window.removeEventListener(SAY, onSay);
  }, [setDraft, focusComposer]);
  useEffect(() => {
    if (pending !== null && draft === pending) {
      setPending(null);
      void send();
    }
  }, [pending, draft, send]);
  return null;
}

/** Cold start: three first sentences a newcomer can click (design 10 / usability #6). */
function StarterPrompts({ host }: { host: RefObject<HTMLDivElement | null> }) {
  const { messages } = useAIChatMessages();
  const { messagesLoading } = useAIChatBase();
  const session = useEditSession();
  // Sit in the empty message area, just above the composer (which keeps its own height).
  const [bottom, setBottom] = useState(140);
  useEffect(() => {
    const composer = host.current?.querySelector<HTMLElement>(".ai-chat-window > div > :last-child");
    if (!composer) return;
    const measure = () => setBottom(composer.offsetHeight + 12);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(composer);
    return () => observer.disconnect();
  }, [host, messages.length]);
  if (messages.length || messagesLoading) return null;
  const cell = session?.focusAnchor ? session.nameOf(session.focusAnchor) : null;
  // Each table opens with its own point (验收意见 E D07): what it is, this step, and the book's gate.
  const def = session && isArtifactCode(session.code) ? getArtifactDef(session.code) : null;
  const note = session ? bookNote(session.code) : null;
  const prompts: [string, string][] = [
    ["帮我看这张表缺什么", "帮我看看这张表现在缺什么、哪里不符合书里的要求，按先后告诉我先补哪几格。"],
    [cell ? `解释「${cell.length > 10 ? `${cell.slice(0, 10)}…` : cell}」这一格` : "解释这一格", cell ? `「${cell}」这一格应该填什么？请用大白话解释，再举一个同类企业的例子。` : "我不太懂这张表，请用大白话解释每一栏该填什么，各举一个例子。"],
    ["建议怎么填", "结合我们企业的资料，建议这张表怎么填；先给思路，我同意后再出修改卡。"],
  ];
  return (
    <div className="absolute inset-x-3 z-10 flex flex-col gap-1.5 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur" style={{ bottom }} aria-label="可以这样开始">
      {def ? (
        <div className="text-xs">
          <span className="font-semibold text-brand">《{def.plain}》</span>
          <span className="text-muted-foreground">
            {" "}
            · {def.task} / {def.step}
          </span>
          {note?.gate ? <div className="mt-0.5 text-muted-foreground">完成检查：{note.gate}</div> : null}
        </div>
      ) : null}
      <span className="text-xs text-muted-foreground">第一次用？点一句开始：</span>
      {prompts.map(([label, text]) => (
        <Button key={label} variant="outline" size="sm" className="justify-start whitespace-normal text-left" onClick={() => askCoach(text)}>
          {label}
        </Button>
      ))}
    </div>
  );
}

/** 新对话 / 历史对话 (the chat header row is hidden under the panel tabs). */
/** 资料进对话：上传的文件存进项目资料库（数字咨询师才能检索），并在输入框写好“请参考《…》”（不自动发送）。 */
const citeMaterials = (list: { id: number; title: string }[]) =>
  list.length && askCoach(`请参考资料${list.map((m) => `《${m.title}》（资料编号 ${m.id}）`).join("、")}，结合当前这张表，告诉我哪些内容能用上。`, false);

function useAttachMaterials() {
  const upload = useMaterialUpload();
  const file = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={file}
      type="file"
      multiple
      accept={MATERIAL_ACCEPT}
      className="hidden"
      aria-label="上传资料"
      onChange={async (e) => {
        const added = await upload(e.target.files);
        citeMaterials(added);
        if (file.current) file.current.value = "";
      }}
    />
  );
  return { input, open: () => file.current?.click() };
}

function ChatMenu({ onUpload }: { onUpload: () => void }) {
  const { startNewConversation, setConversationListOpen } = useAIChatBase();
  const { project } = useProjectContext();
  const materials = useMaterials(project);
  const cite = citeMaterials;
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="absolute top-1.5 right-1.5 z-20" aria-label="对话菜单" />}>
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onClick={() => startNewConversation()}>
          <MessageSquarePlus /> 新对话
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setConversationListOpen(true)}>
          <History /> 历史对话
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onUpload}>
          <Paperclip /> 上传资料…
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderOpen /> 引用资料
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 min-w-56 overflow-y-auto">
            {(materials.data ?? []).length ? (
              (materials.data ?? []).map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => cite([m])}>
                  <span className="truncate">{m.title}</span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>还没有资料</DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}

/** Right column of the workspace: the stage's digital consultant, scoped to this page. */
export function CoachPanel({
  stage,
  chatId,
}: {
  stage: StageKey;
  chatId: string;
}) {
  const ai = useAI();
  const controller = useAIChatController();
  const host = useRef<HTMLDivElement>(null);
  const attach = useAttachMaterials();
  const employee = COACH_BY_STAGE[stage];
  const available = useMemo(
    () => ai.employees.some((e) => e.username === employee),
    [ai.employees, employee],
  );

  if (!available) {
    return (
      <Alert>
        <AlertTitle>数字咨询师暂不可用</AlertTitle>
        <AlertDescription>
          当前账号没有可用的数字咨询师，或大模型服务尚未配置。表格可以照常填写。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <AIToolRendererProvider renderers={RENDERERS}>
      <AIChatProvider
        id={chatId}
        controller={controller}
        defaultEmployee={employee}
      >
        <AttachPageContext />
        <CoachBridge />
        {/* Messages scroll; the composer stays at the bottom of the panel (design 10). */}
        <div
          ref={host}
          data-dingze-chat
          className="relative flex min-h-0 flex-1 flex-col"
          onKeyDownCapture={(e) => {
            if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).closest("textarea")) lastSendAt = Date.now();
          }}
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("button[type=submit], button[aria-label*='发送'], button[aria-label*='Send']")) lastSendAt = Date.now();
          }}
        >
          {attach.input}
          <ChatMenu onUpload={attach.open} />
          <AIChatWindow
            className="min-h-0 flex-1 bg-card"
            showConversationToggle
            showEmployeeSelector={false}
            showModelSelector={false}
            composerActions={[{ key: "attach", label: "上传资料（存进资料库，供数字咨询师引用）", icon: <Paperclip />, onClick: attach.open }]}
            disclaimer="Enter 发送 · Shift+Enter 换行 · 📎 上传的文件进资料库 · 修改卡确认后才写入成果"
            placeholder="回答数字咨询师，或直接说你的想法…"
          />
          <StarterPrompts host={host} />
        </div>
      </AIChatProvider>
    </AIToolRendererProvider>
  );
}
