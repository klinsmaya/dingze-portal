import { type KeyboardEvent, type Ref, useMemo, useState } from "react";

import { PROJECT_ROLE_LABELS } from "@dingze/shared";

import { Textarea } from "@/components/ui/textarea";
import type { ProjectTeamMember } from "@/lib/dingze/api";
import { cn } from "@/lib/utils";

/** @数字咨询师 in a comment asks the coach for a suggestion; it is not sent as a mention. */
export const COACH_MENTION = -1;

type Option = { id: number; name: string; role: string };

/** Mentions are the members whose “@昵称” is still in the text. */
export function mentionsIn(text: string, team: ProjectTeamMember[]): number[] {
  const ids = team.filter((m) => text.includes(`@${m.nickname}`)).map((m) => m.userId);
  return text.includes("@数字咨询师") ? [...ids, COACH_MENTION] : ids;
}

/**
 * 批注输入框 (design 10 画面 5): type “@” for the member list — members get notified, @数字咨询师
 * asks for a suggestion. Ctrl+Enter sends, Esc cancels.
 */
export function MentionTextarea({
  value,
  onChange,
  team,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus,
  className,
  label,
  textRef,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  team: ProjectTeamMember[];
  onSubmit: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  label: string;
  textRef?: Ref<HTMLTextAreaElement>;
  /** One-line reply box. */
  compact?: boolean;
}) {
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);
  const options: Option[] = useMemo(
    () => [
      ...team.map((m) => ({ id: m.userId, name: m.nickname, role: PROJECT_ROLE_LABELS[m.projectRole] ?? "" })),
      { id: COACH_MENTION, name: "数字咨询师", role: "给修改建议" },
    ],
    [team],
  );
  const shown = query ? options.filter((o) => o.name.includes(query.text)) : [];

  const pick = (o: Option) => {
    if (!query) return;
    const before = value.slice(0, query.start);
    const after = value.slice(query.start + 1 + query.text.length);
    onChange(`${before}@${o.name} ${after}`);
    setQuery(null);
  };
  const track = (text: string, caret: number) => {
    const head = text.slice(0, caret);
    const at = head.lastIndexOf("@");
    if (at >= 0 && !/\s/.test(head.slice(at + 1)) && head.length - at <= 12) {
      setQuery({ start: at, text: head.slice(at + 1) });
      setActive(0);
    } else setQuery(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (query && shown.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(shown[active]);
        return;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query) setQuery(null);
      else onCancel?.();
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (compact && !e.shiftKey))) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textRef}
        autoFocus={autoFocus}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setQuery(null), 150)}
        className={cn(compact ? "min-h-9 resize-none py-1.5 text-sm" : "min-h-20", className)}
        rows={compact ? 1 : undefined}
      />
      {query && shown.length ? (
        <ul role="listbox" aria-label="提到成员" className="absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border bg-popover p-1 text-sm shadow-lg">
          <li className="px-2 py-1 text-[11px] text-muted-foreground">提到成员（会收到通知）</li>
          {shown.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5", i === active && "bg-accent")}
            >
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-white", o.id === COACH_MENTION ? "bg-brand" : "bg-[color:var(--dz-fin)]")}>{o.name.slice(0, 1)}</span>
              <span className="flex-1">{o.name}</span>
              <span className="text-[11px] text-muted-foreground">{o.role}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
