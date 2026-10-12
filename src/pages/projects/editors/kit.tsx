import { ArrowDown, ArrowUp, CircleHelp, Import, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const pendingTone = "border-suggestion-border bg-suggestion text-suggestion-foreground";

/** A compact table cell editor; “待补” renders in the suggestion tone. */
export function TextCell({
  label,
  value,
  onChange,
  readOnly,
  invalid,
  multiline = false,
  placeholder,
  className,
  anchor,
}: {
  /** Issue / comment anchor (row or field id) so the cell can be scrolled to. */
  anchor?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  invalid?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  if (readOnly) {
    const text = (value ?? "").trim();
    return (
      <div
        aria-label={label}
        data-anchor={anchor}
        className={cn("min-h-9 rounded-md px-2 py-1.5 text-sm whitespace-pre-wrap", text ? "text-foreground" : "text-muted-foreground/60", text === "待补" && pendingTone, className)}
      >
        {text || "—"}
      </div>
    );
  }
  const shared = {
    "data-anchor": anchor,
    "aria-label": label,
    value: value ?? "",
    readOnly,
    "aria-invalid": invalid || undefined,
    placeholder: readOnly ? "" : (placeholder ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    className: cn((value ?? "").trim() === "待补" && pendingTone, className),
  };
  return multiline ? (
    <Textarea {...shared} className={cn("min-h-16 resize-y", shared.className)} />
  ) : (
    <Input {...shared} />
  );
}

/** The editor's own small row: a 怎么填 tip (kept out of the way) and table-specific buttons. */
export function EditorToolbar({ children, hint }: { children?: ReactNode; hint?: ReactNode }) {
  if (!children && !hint) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {hint ? (
        <Popover>
          <PopoverTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <CircleHelp className="size-3.5" /> 怎么填
          </PopoverTrigger>
          <PopoverContent align="start" className="max-w-md text-sm leading-relaxed">
            {hint}
          </PopoverContent>
        </Popover>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Plus /> {label}
    </Button>
  );
}

/** “从上游带入”: only offered when the upstream has something new to bring. */
export function ImportButton({
  label,
  count,
  onClick,
  readOnly,
}: {
  label: string;
  count: number;
  onClick: () => void;
  readOnly: boolean;
}) {
  if (readOnly) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={count === 0} title={count === 0 ? "上游没有新的内容可带入" : undefined}>
      <Import /> {label}
      {count > 0 ? `（${count}）` : ""}
    </Button>
  );
}

export function RowActions({
  label,
  onRemove,
  onMove,
  readOnly,
}: {
  label: string;
  onRemove: () => void;
  onMove?: (delta: -1 | 1) => void;
  readOnly: boolean;
}) {
  if (readOnly) return null;
  return (
    <div className="flex shrink-0 items-center">
      {onMove ? (
        <>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`上移 ${label}`} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`下移 ${label}`} onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
        </>
      ) : null}
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`删除 ${label}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}

/** Read-only context from an upstream table, shown above the editor. */
export function UpstreamNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-book-border bg-book px-4 py-3 text-sm text-book-foreground">
      <div className="mb-1 text-xs font-semibold opacity-80">{title}</div>
      {children}
    </div>
  );
}

/**
 * 表格格子 (design 10 画面 4): reads like Excel — click, Enter, F2 or just start typing to edit;
 * Enter saves, Tab saves and goes to the next cell, Esc cancels.
 */
export function GridCell({
  label,
  value,
  onChange,
  readOnly,
  anchor,
  placeholder,
  align = "left",
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  anchor?: string;
  placeholder?: string;
  align?: "left" | "right";
  className?: string;
  /** Extra line under the value (e.g. “下级 310”). */
  children?: ReactNode;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cell = useRef<HTMLDivElement>(null);
  const commit = () => {
    if (draft !== null && draft !== (value ?? "")) onChange(draft);
    setDraft(null);
  };
  if (draft !== null) {
    return (
      <div className="relative">
        <input
          autoFocus
          aria-label={label}
          data-anchor={anchor}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              requestAnimationFrame(() => cell.current?.focus());
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setDraft(null);
              requestAnimationFrame(() => cell.current?.focus());
            }
          }}
          className={cn("block min-h-9 w-full min-w-0 bg-background px-2 py-1.5 text-sm outline-2 -outline-offset-2 outline-brand", align === "right" && "text-right font-semibold")}
        />
        <div className="absolute top-full left-0 z-30 mt-1 flex items-center gap-1 whitespace-nowrap rounded-md bg-[#12384a] px-2 py-1 text-[11px] text-white shadow-lg">
          <Kbd className="bg-white/15 text-white">Enter</Kbd> 保存 <Kbd className="bg-white/15 text-white">Tab</Kbd> 下一格 <Kbd className="bg-white/15 text-white">Esc</Kbd> 取消
        </div>
      </div>
    );
  }
  const text = (value ?? "").trim();
  return (
    <div
      ref={cell}
      role="gridcell"
      tabIndex={0}
      aria-label={label}
      aria-readonly={readOnly || undefined}
      data-anchor={anchor}
      onClick={() => !readOnly && setDraft(value ?? "")}
      onKeyDown={(e) => {
        if (readOnly || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          setDraft(value ?? "");
        } else if (e.key.length === 1) {
          e.preventDefault();
          setDraft(e.key);
        }
      }}
      className={cn(
        "min-h-9 cursor-text px-2 py-1.5 text-sm whitespace-pre-wrap outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
        readOnly && "cursor-default",
        align === "right" && "text-right font-semibold tabular-nums",
        !text && "text-muted-foreground/60",
        text === "待补" && pendingTone,
        className,
      )}
    >
      {text || (readOnly ? "—" : (placeholder ?? ""))}
      {children}
    </div>
  );
}
