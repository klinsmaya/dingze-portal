import { LassoSelect, MessageSquarePlus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { ProjectSummary, ProjectTeamMember } from "@/lib/dingze/api";
import { useAddComment } from "@/lib/dingze/comments-api";
import { errorMessage } from "@/lib/dingze/errors";

import { askCoach } from "./coach-panel";
import { anchorElement } from "./edit-markers";
import { COACH_MENTION, MentionTextarea, mentionsIn } from "./mention-input";

export type CommentDraft = { anchors: string[]; label: string; text: string };

/** Where an element sits inside the scrolling main area (absolute coordinates of its content). */
function placeIn(main: HTMLElement, el: HTMLElement) {
  const m = main.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { top: r.top - m.top + main.scrollTop, left: r.left - m.left + main.scrollLeft, width: r.width, height: r.height, mainWidth: main.clientWidth };
}

/**
 * 就地批注 (design 10 画面 5): a small composer right at the cell or node — 右键「插入批注」 or
 * Ctrl+Alt+M. Typing keeps a draft in the 批注 list; Ctrl+Enter sends, Esc cancels.
 */
export function CommentComposer({
  project,
  code,
  team,
  draft,
  onChange,
  onClose,
  onSent,
}: {
  project: ProjectSummary;
  code: string;
  team: ProjectTeamMember[];
  draft: CommentDraft;
  onChange: (text: string) => void;
  onClose: () => void;
  onSent: (id: number | null) => void;
}) {
  const add = useAddComment(project, code);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const key = draft.anchors.join("|");
  useLayoutEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-dingze-main]");
    const el = main ? anchorElement(main, draft.anchors[0]) : null;
    if (!main || !el) {
      setPos(null);
      return;
    }
    const p = placeIn(main, el);
    const width = 360;
    setPos({ top: p.top + p.height + 6, left: Math.max(8, Math.min(p.left + Math.min(p.width, 200) - 40, p.mainWidth - width - 8 + main.scrollLeft)) });
  }, [key, draft.anchors]);

  const send = () => {
    const text = draft.text.trim();
    if (!text) return;
    const mentions = mentionsIn(text, team);
    add.mutate(
      {
        anchor: draft.anchors[0] ?? null,
        anchors: draft.anchors.length > 1 ? draft.anchors : undefined,
        anchorLabel: draft.label.slice(0, 200),
        content: text,
        mentions: mentions.filter((id) => id !== COACH_MENTION),
      },
      {
        onSuccess: (result) => {
          toast.success("批注已发出");
          if (mentions.includes(COACH_MENTION)) askCoach(`我在「${draft.label}」批注：${text}\n请给出修改建议；需要改表时给修改卡，我确认后才写入。`);
          onSent((result as { id?: number } | undefined)?.id ?? null);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <div
      role="dialog"
      aria-label={`新批注：${draft.label}`}
      className="absolute z-40 w-[360px] rounded-xl border bg-popover p-3 shadow-xl"
      style={pos ? { top: pos.top, left: pos.left } : { top: 12, right: 12 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs">
        <MessageSquarePlus className="size-3.5" style={{ color: "var(--dz-comment)" }} />
        <b style={{ color: "var(--dz-comment)" }}>新批注</b>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">· {draft.label}</span>
        <button type="button" aria-label="关闭" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>
      <MentionTextarea
        autoFocus
        label="批注内容"
        team={team}
        value={draft.text}
        onChange={onChange}
        onSubmit={send}
        onCancel={onClose}
        placeholder="写下意见或问题；输入 @ 提到成员或数字咨询师"
        className="focus-visible:ring-[color:var(--dz-comment)]"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Kbd>Ctrl+Enter</Kbd> 发送 · <Kbd>Esc</Kbd> 取消
        </span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onClose}>
          取消
        </Button>
        <Button size="sm" disabled={!draft.text.trim() || add.isPending} onClick={send} style={{ background: "var(--dz-comment)", color: "white" }}>
          发送
        </Button>
      </div>
    </div>
  );
}

/** 右键「插入批注」: a one-item menu at the pointer. */
export function AnchorMenu({ x, y, label, onComment, onClose }: { x: number; y: number; label: string; onComment: () => void; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [onClose]);
  return (
    <div role="menu" aria-label={label} className="fixed z-50 min-w-48 rounded-lg border bg-popover p-1 text-sm shadow-lg" style={{ top: y, left: x }} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        role="menuitem"
        autoFocus
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent focus:bg-accent focus:outline-none"
        onClick={onComment}
      >
        <MessageSquarePlus className="size-4" style={{ color: "var(--dz-comment)" }} /> 插入批注
        <span className="ml-auto text-[11px] text-muted-foreground">Ctrl+Alt+M</span>
      </button>
    </div>
  );
}

/** 圈选中: what is selected and the way to the composer. */
export function LassoBar({ count, onWrite, onCancel }: { count: number; onWrite: () => void; onCancel: () => void }) {
  return (
    <div className="sticky top-0 z-30 -mb-2 flex items-center gap-2 self-center rounded-full border bg-popover px-3 py-1 text-xs shadow-md" role="status">
      <LassoSelect className="size-3.5" style={{ color: "var(--dz-comment)" }} />
      {count ? `已圈选 ${count} 处` : "圈选：点表里或图里要一起批注的地方（再点一次取消）"}
      {count ? (
        <Button size="xs" onClick={onWrite} style={{ background: "var(--dz-comment)", color: "white" }}>
          写批注
        </Button>
      ) : null}
      <Button size="xs" variant="ghost" onClick={onCancel}>
        取消
      </Button>
    </div>
  );
}

/**
 * 圈选批注的轮廓 (design 10 画面 2): a dashed purple box around the group a comment circles, with its
 * number, so it reads as one comment and not several.
 */
export function LassoOutlines({ groups, onOpen }: { groups: { id: number; no: number; anchors: string[] }[]; onOpen: (id: number) => void }) {
  const [boxes, setBoxes] = useState<{ id: number; no: number; top: number; left: number; width: number; height: number }[]>([]);
  const key = JSON.stringify(groups);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("[data-dingze-main]");
    if (!main) return;
    const measure = () => {
      const next = groups.flatMap((g) => {
        const rects = g.anchors.map((a) => anchorElement(main, a)).filter((el): el is HTMLElement => !!el && el.offsetParent !== null).map((el) => placeIn(main, el));
        if (rects.length < 2) return [];
        const top = Math.min(...rects.map((r) => r.top)) - 6;
        const left = Math.min(...rects.map((r) => r.left)) - 6;
        const bottom = Math.max(...rects.map((r) => r.top + r.height)) + 6;
        const right = Math.max(...rects.map((r) => r.left + r.width)) + 6;
        return [{ id: g.id, no: g.no, top, left, width: right - left, height: bottom - top }];
      });
      setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    const timer = window.setInterval(measure, 800);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <>
      {boxes.map((b) => (
        <div
          key={b.id}
          aria-hidden
          className="pointer-events-none absolute z-[5] rounded-xl border-2 border-dashed"
          style={{ top: b.top, left: b.left, width: b.width, height: b.height, borderColor: "var(--dz-comment)", background: "color-mix(in oklab, var(--dz-comment) 5%, transparent)" }}
        >
          <button
            type="button"
            className="pointer-events-auto absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full rounded-bl-none text-[11px] font-bold text-white shadow"
            style={{ background: "var(--dz-comment)" }}
            onClick={() => onOpen(b.id)}
            aria-label={`圈选批注 ${b.no}`}
          >
            {b.no}
          </button>
        </div>
      ))}
    </>
  );
}
