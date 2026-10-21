import { Bot, Check, ChevronRight, CircleCheck, Ellipsis, LassoSelect, Link2, LocateFixed, MessageSquarePlus, PencilLine, RotateCcw } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectSummary, ProjectTeamMember } from "@/lib/dingze/api";
import { type CommentThread, useAddComment, useComments, useResolveComment } from "@/lib/dingze/comments-api";
import { errorMessage } from "@/lib/dingze/errors";
import { locateAnchor } from "@/lib/dingze/locate";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

import { askCoach } from "./coach-panel";
import type { CommentDraft } from "./comment-composer";
import { anchorElement } from "./edit-markers";
import { useEditSession } from "./edit-session";
import { COACH_MENTION, MentionTextarea, mentionsIn } from "./mention-input";

/** ① ② ③ … for the numbered drops; plain digits past 20. */
export function circled(no: number): string {
  return no >= 1 && no <= 20 ? String.fromCharCode(0x2460 + no - 1) : String(no);
}

const locateAll = (anchors: string[]) => {
  if (!anchors.some((a) => locateAnchor(a))) toast.info("这一处已删除，或当前没有展开");
};

function Avatar({ name, tone }: { name: string; tone?: string }) {
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: tone ?? "var(--brand)" }}>
      {name.slice(0, 1)}
    </span>
  );
}

function Thread({
  thread,
  no,
  team,
  canComment,
  canResolve,
  highlighted,
  onReply,
  onResolve,
}: {
  thread: CommentThread;
  no: number | null;
  team: ProjectTeamMember[];
  canComment: boolean;
  canResolve: boolean;
  highlighted: boolean;
  onReply: (content: string, mentions: number[]) => Promise<unknown>;
  onResolve: (resolved: boolean) => void;
}) {
  const [text, setText] = useState("");
  const session = useEditSession();
  const anchors = thread.anchors?.length ? thread.anchors : thread.anchor ? [thread.anchor] : [];
  const working = session?.activeComment === thread.id;
  const canFix = !!session && !session.readOnly && !thread.resolved;
  const name = (id: number) => team.find((m) => m.userId === id)?.nickname ?? "";
  const fixed = thread.replies.filter((r) => r.content.startsWith("已按批注修改"));
  const body = (c: { content: string; mentions: number[] }) => (
    <p className="whitespace-pre-wrap leading-relaxed">
      {c.content.split(/(@\S+)/g).map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-medium" style={{ color: "var(--dz-comment)" }}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
      {c.mentions.filter((id) => !c.content.includes(`@${name(id)}`)).map((id) => (
        <span key={id} className="ml-1 font-medium" style={{ color: "var(--dz-comment)" }}>
          @{name(id)}
        </span>
      ))}
    </p>
  );
  const fixWithCoach = () => {
    session!.setActiveComment(thread.id);
    session!.openPanel("coach");
    const where = thread.anchorLabel || (anchors.length ? anchors.join("、") : "整张表");
    const quote = [`> 批注${no ? circled(no) : ""} · ${thread.author} · ${where}`, `> ${thread.content.replace(/\n/g, " ")}`, ...thread.replies.filter((r) => !r.content.startsWith("已按批注修改")).map((r) => `> ${r.author}：${r.content.replace(/\n/g, " ")}`)].join("\n");
    askCoach(`${quote}\n\n请按这条批注修改：先一句话说明打算怎么改，再给出修改卡让我确认。`);
  };
  const send = async () => {
    if (!text.trim()) return;
    await onReply(text.trim(), mentionsIn(text, team).filter((id) => id !== COACH_MENTION));
    if (text.includes("@数字咨询师")) fixWithCoach();
    setText("");
  };
  return (
    <li
      id={`comment-${thread.id}`}
      className={cn("rounded-xl border bg-card p-3 text-sm", (highlighted || working) && "ring-2")}
      style={highlighted || working ? ({ "--tw-ring-color": "var(--dz-comment)", borderLeft: "3px solid var(--dz-comment)" } as CSSProperties) : undefined}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs">
        {no ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full rounded-bl-none text-[11px] font-bold text-white" style={{ background: "var(--dz-comment)" }}>
            {no}
          </span>
        ) : null}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left font-medium hover:underline"
          title={anchors.length ? "定位到这一处" : undefined}
          onClick={() => anchors.length && locateAll(anchors)}
        >
          {anchors.length > 1 ? <LassoSelect className="size-3.5 shrink-0" /> : anchors.length ? <LocateFixed className="size-3.5 shrink-0" /> : null}
          <span className="truncate">{anchors.length > 1 ? `圈选 ${anchors.length} 条 · ` : ""}{thread.anchorLabel || (anchors.length ? thread.anchor : "整张表")}</span>
        </button>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: "var(--dz-comment)", background: "color-mix(in oklab, var(--dz-comment) 12%, transparent)" }}>
          未解决
        </span>
      </div>
      <div className="flex gap-2">
        <Avatar name={thread.author} />
        <div className="min-w-0 flex-1">
          <div className="text-xs">
            <b>{thread.author}</b> <span className="text-muted-foreground">{formatTime(thread.at)}{thread.rev ? ` · v${thread.rev}` : ""}</span>
          </div>
          {body(thread)}
        </div>
      </div>
      {thread.replies.length ? (
        <ul className="mt-2 ml-8 flex flex-col gap-2">
          {thread.replies.map((r) =>
            r.content.startsWith("已按批注修改") ? null : (
              <li key={r.id} className="flex gap-2">
                <Avatar name={r.author} tone="var(--dz-fin)" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs">
                    <b>{r.author}</b> <span className="text-muted-foreground">{formatTime(r.at)}</span>
                  </div>
                  {body(r)}
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}
      {fixed.length ? (
        <p className="mt-2 ml-8 flex items-start gap-1 rounded-md px-2 py-1 text-xs" style={{ color: "var(--dz-comment)", background: "color-mix(in oklab, var(--dz-comment) 8%, transparent)" }}>
          <Link2 className="mt-0.5 size-3 shrink-0" /> {fixed[fixed.length - 1].content}（{fixed[fixed.length - 1].author} {formatTime(fixed[fixed.length - 1].at)}）
        </p>
      ) : null}
      {working ? (
        <p className="mt-2 rounded-md px-2 py-1 text-xs" style={{ background: "color-mix(in oklab, var(--dz-comment) 12%, transparent)" }}>
          正在按这条批注修改：在表里直接改，改动会关联到批注 {no ? circled(no) : ""}，保存后自动回复“已按批注修改”。
        </p>
      ) : null}
      {canComment ? (
        <div className="mt-2 ml-8">
          <MentionTextarea compact label={`回复批注 ${no ?? ""}`} team={team} value={text} onChange={setText} onSubmit={send} placeholder="回复，输入 @ 提到成员…" />
        </div>
      ) : null}
      <div className="mt-2 ml-8 flex flex-wrap items-center gap-1">
        {canFix ? (
          working ? (
            <Button size="sm" variant="secondary" onClick={() => session!.setActiveComment(null)}>
              <Check /> 改完了
            </Button>
          ) : (
            <Button
              size="sm"
              title="按批注修改：就地改，改动关联到这条批注"
              style={{ background: "var(--dz-comment)", color: "white" }}
              onClick={() => {
                session!.setActiveComment(thread.id);
                if (anchors.length) locateAll(anchors);
              }}
            >
              <PencilLine /> 按批注修改
            </Button>
          )
        ) : null}
        {canFix && !working ? (
          <Button size="icon-sm" variant="outline" title="带着批注原文到对话里，让数字咨询师出修改卡" aria-label={`把批注 ${no ?? ""} 带到对话里`} onClick={fixWithCoach}>
            <Bot />
          </Button>
        ) : null}
        {canResolve ? (
          <Button size="sm" variant="outline" onClick={() => onResolve(true)}>
            <CircleCheck /> 解决
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`批注 ${no ?? ""} 的更多操作`} />}>
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {anchors.length ? (
              <DropdownMenuItem onClick={() => locateAll(anchors)}>
                <LocateFixed /> 定位
              </DropdownMenuItem>
            ) : null}
            {canFix ? (
              <DropdownMenuItem onClick={fixWithCoach}>
                <Bot /> 让数字咨询师改
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

type Filter = "all" | "open" | "mine";

/** 批注 (design 10 画面 2、5): filters, the draft being typed, open threads by position, resolved folded. */
export function CommentsPanel({
  project,
  code,
  team,
  canComment,
  canResolveAny,
  currentUserId,
  highlightId,
  numberOf,
  draft,
  onOpenDraft,
  onNew,
}: {
  project: ProjectSummary;
  code: string;
  team: ProjectTeamMember[];
  canComment: boolean;
  canResolveAny: boolean;
  currentUserId: number | null;
  highlightId: number | null;
  numberOf: (id: number) => number | null;
  /** The comment being typed at a cell / node (shown as 草稿). */
  draft: CommentDraft | null;
  onOpenDraft: () => void;
  /** 整表批注 / when nothing is selected. */
  onNew: () => void;
}) {
  const session = useEditSession();
  const comments = useComments(project, code);
  const add = useAddComment(project, code);
  const resolve = useResolveComment(project, code);
  const [filter, setFilter] = useState<Filter>("open");
  const [order, setOrder] = useState<"position" | "time">("position");
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    if (!highlightId || !comments.data) return;
    document.getElementById(`comment-${highlightId}`)?.scrollIntoView({ block: "nearest" });
    const thread = comments.data.find((t) => t.id === highlightId);
    if (thread?.anchor) window.setTimeout(() => locateAnchor(thread.anchor!), 300);
  }, [highlightId, comments.data]);

  const all = comments.data ?? [];
  const mentionsMe = (t: CommentThread) => currentUserId !== null && [t, ...t.replies].some((c) => c.mentions.includes(currentUserId));
  const counts = { all: all.length, open: all.filter((t) => !t.resolved).length, mine: all.filter(mentionsMe).length };
  const visible = all.filter((t) => (filter === "mine" ? mentionsMe(t) : true));
  const position = (t: CommentThread) => {
    const main = document.querySelector<HTMLElement>("[data-dingze-main]");
    const el = main && t.anchor ? anchorElement(main, t.anchor) : null;
    if (!el || !main) return Number.MAX_SAFE_INTEGER;
    const r = el.getBoundingClientRect();
    return Math.round(r.top + main.scrollTop) * 10000 + Math.round(r.left);
  };
  const sorted = [...visible].sort((a, b) => (order === "time" ? b.at.localeCompare(a.at) : position(a) - position(b) || a.id - b.id));
  const open = sorted.filter((t) => !t.resolved);
  const resolved = sorted.filter((t) => t.resolved);
  const fail = (error: unknown) => toast.error(errorMessage(error));
  const chip = (key: Filter, label: string, n: number) => (
    <button
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter(key)}
      className={cn("rounded-full border px-2.5 py-0.5 text-xs", filter === key ? "border-[color:var(--dz-comment)] font-semibold" : "text-muted-foreground hover:text-foreground")}
      style={filter === key ? { color: "var(--dz-comment)", background: "color-mix(in oklab, var(--dz-comment) 10%, transparent)" } : undefined}
    >
      {label} {n}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {chip("all", "全部", counts.all)}
        {chip("open", "未解决", counts.open)}
        {chip("mine", "@我", counts.mine)}
        <NativeSelect size="sm" aria-label="排序" value={order} onChange={(e) => setOrder(e.target.value as "position" | "time")} className="ml-auto w-24">
          <NativeSelectOption value="position">按位置</NativeSelectOption>
          <NativeSelectOption value="time">按时间</NativeSelectOption>
        </NativeSelect>
      </div>
      {canComment ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Button size="xs" variant="outline" onClick={onNew}>
            <MessageSquarePlus /> 整表批注
          </Button>
          {session ? (
            <Button size="xs" variant="outline" aria-pressed={session.selecting} onClick={() => session.setSelecting(!session.selecting)}>
              <LassoSelect /> {session.selecting ? "圈选中…" : "圈选"}
            </Button>
          ) : null}
          <span>在格子或节点上右键「插入批注」，或选中后按 Ctrl+Alt+M</span>
        </div>
      ) : null}

      {draft && draft.text.trim() ? (
        <button
          type="button"
          onClick={onOpenDraft}
          className="rounded-xl border p-3 text-left text-sm"
          style={{ borderColor: "var(--dz-comment)", background: "color-mix(in oklab, var(--dz-comment) 6%, transparent)" }}
        >
          <div className="mb-1 flex items-center gap-1.5 text-xs">
            <PencilLine className="size-3.5" style={{ color: "var(--dz-comment)" }} />
            <span className="min-w-0 flex-1 truncate font-medium">{draft.label}</span>
            <span className="text-[10px] font-semibold" style={{ color: "var(--dz-comment)" }}>
              草稿
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">正在输入：{draft.text}</p>
        </button>
      ) : null}

      {comments.isLoading ? (
        <Skeleton className="h-24" />
      ) : open.length === 0 && !resolved.length ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{filter === "mine" ? "没有提到你的批注" : filter === "open" ? "没有未解决的批注" : "还没有批注"}</p>
      ) : (
        <>
          {open.length ? (
            <ul className="flex flex-col gap-2">
              {open.map((t) => (
                <Thread
                  key={t.id}
                  thread={t}
                  no={numberOf(t.id)}
                  team={team}
                  canComment={canComment}
                  canResolve={canResolveAny || t.authorId === currentUserId}
                  highlighted={t.id === highlightId}
                  onReply={(content, m) => add.mutateAsync({ parentId: t.id, content, mentions: m }).catch(fail)}
                  onResolve={(r) => resolve.mutate({ id: t.id, resolved: r }, { onError: fail })}
                />
              ))}
            </ul>
          ) : (
            <p className="text-center text-xs text-muted-foreground">没有未解决的批注</p>
          )}
          {resolved.length ? (
            <div className="text-xs text-muted-foreground">
              <button type="button" className="flex items-center gap-1 hover:text-foreground" aria-expanded={showResolved || filter === "all"} onClick={() => setShowResolved((v) => !v)}>
                <ChevronRight className={cn("size-3.5 transition-transform", (showResolved || filter === "all") && "rotate-90")} />
                已解决 {resolved.length} 条 ·{" "}
                {resolved
                  .slice(0, 3)
                  .map((t) => `${circled(numberOf(t.id) ?? 0)} ${t.author}「${t.content.slice(0, 12)}${t.content.length > 12 ? "…" : ""}」`)
                  .join(" ")}
              </button>
              {showResolved || filter === "all" ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {resolved.map((t) => (
                    <li key={t.id} id={`comment-${t.id}`} className="flex items-start gap-2 rounded-lg border bg-card/60 px-2.5 py-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full rounded-bl-none bg-muted-foreground text-[11px] font-bold text-white">{numberOf(t.id)}</span>
                      <span className="min-w-0 flex-1">
                        <b className="text-foreground">{t.author}</b> {t.anchorLabel ? `· ${t.anchorLabel}` : ""}
                        <span className="block truncate">{t.content}</span>
                      </span>
                      {canResolveAny || t.authorId === currentUserId ? (
                        <Button size="xs" variant="ghost" onClick={() => resolve.mutate({ id: t.id, resolved: false }, { onError: fail })}>
                          <RotateCcw /> 重开
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
