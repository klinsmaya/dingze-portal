import { Ellipsis, History, MessageSquarePlus } from "lucide-react";
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
import type { StageKey } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type ProposedChange, applyChanges, describeValue } from "@/lib/dingze/changes";
import { COACH_BY_STAGE, PROPOSE_TOOL } from "@/lib/dingze/coach";
import { getAt, preview } from "@/lib/dingze/edit-log";

import { useEditSession } from "./edit-session";

const SAY = "dz:coach-say";

/** Put a first sentence into the digital consultant's composer and send it. */
export function askCoach(text: string, send = true) {
  window.dispatchEvent(new CustomEvent(SAY, { detail: { text, send } }));
}

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
  const decided =
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied";
  const changes = args.changes ?? [];

  if (decided) {
    const { ok, message } = readOutcome(part);
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

  return <PendingCard args={args} disabled={disabled} onApprove={onApprove} onReject={onReject} onRevise={onRevise} />;
}

/**
 * 修改卡 (design 10 §3): 原值 → 新值 per cell, and the 影响 on the table's checks. Nothing is
 * written until 确认; the cells it would touch are outlined amber on the canvas meanwhile.
 */
function PendingCard({
  args,
  disabled,
  onApprove,
  onReject,
  onRevise,
}: {
  args: ProposalArgs;
  disabled?: boolean;
  onApprove: AIToolRendererProps["onApprove"];
  onReject: AIToolRendererProps["onReject"];
  onRevise: AIToolRendererProps["onRevise"];
}) {
  const session = useEditSession();
  const changes = useMemo(() => args.changes ?? [], [args.changes]);
  const paths = changes.map((c) => c.path.replace(/\.\+$/, "")).join("|");
  useEffect(() => {
    if (!session) return;
    session.setPreview(paths.split("|").filter(Boolean));
    return () => session.setPreview([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  const impact = useMemo(() => {
    if (!session) return null;
    try {
      const next = applyChanges(session.draft, changes);
      const errors = (payload: unknown) => session.validate(payload).filter((i) => i.level === "error");
      const before = errors(session.draft);
      const after = errors(next);
      const fixed = before.filter((b) => !after.some((a) => a.message === b.message));
      const added = after.filter((a) => !before.some((b) => b.message === a.message));
      return { before: before.length, after: after.length, fixed, added, invalid: null as string | null };
    } catch (error) {
      return { before: 0, after: 0, fixed: [], added: [], invalid: error instanceof Error ? error.message : "路径无效" };
    }
  }, [session, changes]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-suggestion-border bg-suggestion p-3 text-sm">
      <div className="flex justify-between text-xs font-bold text-suggestion-foreground">
        <span>修改卡{args.summary ? ` · ${args.summary}` : ""}</span>
        <span>待你确认</span>
      </div>
      <ul className="flex flex-col gap-2">
        {changes.map((change, i) => {
          const append = change.path.endsWith(".+");
          const before = session && !append ? getAt(session.draft, change.path) : undefined;
          const hadText = before !== undefined && before !== null && before !== "" && !(Array.isArray(before) && before.length === 0);
          const name = change.label ?? session?.nameOf(change.path) ?? change.path;
          return (
            <li key={`${change.path}-${i}`} className="flex flex-col gap-0.5">
              <div className="text-xs text-suggestion-foreground">
                {append ? "新增一项 · " : ""}
                {name}
              </div>
              {hadText ? (
                <div className="text-xs text-muted-foreground line-through" title="原值">
                  {preview(before, 120)}
                </div>
              ) : null}
              <div className="font-semibold text-foreground">{describeValue(change.value) || preview(change.value, 120)}</div>
              {hadText ? <div className="text-[11px] text-suggestion-foreground">会替换已填写的内容，确认前请核对</div> : null}
            </li>
          );
        })}
      </ul>
      {impact ? (
        <div className="rounded-md bg-background/60 px-2 py-1.5 text-xs">
          <span className="font-semibold">影响：</span>
          {impact.invalid ? (
            <span className="text-destructive">这条建议对不上表里的位置（{impact.invalid}），请让数字咨询师重出。</span>
          ) : (
            <>
              必须改的问题 {impact.before} → {impact.after}
              {impact.fixed.length ? <span className="text-status-done-foreground">，解决：{impact.fixed.slice(0, 2).map((x) => x.message).join("；")}</span> : null}
              {impact.added.length ? <span className="text-destructive">，新增：{impact.added.slice(0, 2).map((x) => x.message).join("；")}</span> : null}
            </>
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={disabled || !!impact?.invalid} onClick={() => onApprove()}>
          确认
        </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onRevise()}>
          改一下
        </Button>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onReject("用户不采纳这条建议")}>
          不采纳
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">确认后写入草稿、记入“修改”，可撤销；保存后生效。</p>
    </div>
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
  const prompts: [string, string][] = [
    ["帮我看这张表缺什么", "帮我看看这张表现在缺什么、哪里不符合书里的要求，按先后告诉我先补哪几格。"],
    [cell ? `解释「${cell.length > 10 ? `${cell.slice(0, 10)}…` : cell}」这一格` : "解释这一格", cell ? `「${cell}」这一格应该填什么？请用大白话解释，再举一个同类企业的例子。` : "我不太懂这张表，请用大白话解释每一栏该填什么，各举一个例子。"],
    ["建议怎么填", "结合我们企业的资料，建议这张表怎么填；先给思路，我同意后再出修改卡。"],
  ];
  return (
    <div className="absolute inset-x-3 z-10 flex flex-col gap-1.5 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur" style={{ bottom }} aria-label="可以这样开始">
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
function ChatMenu() {
  const { startNewConversation, setConversationListOpen } = useAIChatBase();
  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
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
        <div ref={host} data-dingze-chat className="relative flex min-h-0 flex-1 flex-col">
          <ChatMenu />
          <AIChatWindow
            className="min-h-0 flex-1 bg-card"
            showConversationToggle
            showEmployeeSelector={false}
            showModelSelector={false}
            disclaimer="Enter 发送 · Shift+Enter 换行 · 修改卡确认后才写入成果"
            placeholder="回答数字咨询师，或直接说你的想法…"
          />
          <StarterPrompts host={host} />
        </div>
      </AIChatProvider>
    </AIToolRendererProvider>
  );
}
