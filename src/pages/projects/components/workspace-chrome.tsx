import {
  Map as MapIcon,
  BookOpen,
  Waypoints,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Combine,
  CornerDownRight,
  Download,
  FolderInput,
  IndentDecrease,
  IndentIncrease,
  Keyboard,
  LassoSelect,
  Maximize,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Split,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { formatTime } from "@/lib/dingze/records";
import { type RouteSub, routePath } from "@/lib/dingze/route";
import { cn } from "@/lib/utils";

import type { EditorChrome } from "./edit-session";

// The workspace chrome from design 10: a three-row header over the canvas (where you are · title and view · structure toolbar).

/** 本表小节：左栏收起（窄屏）时，在位置行给一个下拉，代替左栏里的小节列表。 */
export function SubsMenu({ projectId, items }: { projectId: number; items: RouteSub[] }) {
  const navigate = useNavigate();
  const at = items.findIndex((i) => i.current);
  const done = items.filter((i) => i.done).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-6 min-w-0 shrink-0 items-center gap-1 rounded-full border px-2 text-xs text-muted-foreground hover:text-foreground">
        <span className="truncate">本表小节{at >= 0 ? `：${items[at].short}` : ""}</span>
        <span>
          {done}/{items.length}
        </span>
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {items.map((item, i) => (
          <DropdownMenuItem key={item.key} disabled={!item.to} onClick={() => item.to && navigate(routePath(projectId, item.to))} className={cn("gap-2", item.current && "font-semibold")}>
            <span className="w-4 text-center text-xs text-muted-foreground">{item.done ? <Check className="size-3.5" /> : i + 1}</span>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The 收起 / 展开 button for the right panel, rendered into the top bar. */
export function PanelToggle({ slot, open, onToggle, count }: { slot: HTMLElement | null; open: boolean; onToggle: () => void; count: number }) {
  if (!slot) return null;
  return createPortal(
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "收起右栏" : "展开右栏（对话、批注、修改）"}
      title={open ? "收起右栏" : "展开右栏"}
      className="relative flex size-9 items-center justify-center rounded-lg text-band-foreground hover:bg-white/10"
    >
      {open ? <PanelRightClose className="size-5" /> : <PanelRightOpen className="size-5" />}
      {!open && count ? <span className="absolute -top-0.5 -right-0.5 rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--dz-comment)" }}>{count}</span> : null}
    </button>,
    slot,
  );
}

/** 工具栏右侧的“书中方法”：这一步怎么做的一句话，点开右栏书中方法。 */
export function MethodButton({ text, active, onClick }: { text: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${text}（点开右栏“书中方法”）`}
      className={cn(
        "mx-1 flex h-8 max-w-[26rem] min-w-0 items-center gap-1.5 rounded-md border px-2 text-xs",
        active ? "border-[color:var(--book-border,var(--border))] bg-book text-book-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <BookOpen className="size-3.5 shrink-0" />
      <span className="shrink-0 font-semibold">书中方法</span>
      <span className="truncate">{text}</span>
    </button>
  );
}

export type HeaderState = {
  tone: "act" | "wait" | "done" | "warn" | "neutral";
  text: string;
  /** Longer text in a popover (退回原因、上游变化). */
  detail?: string | null;
  /** Link text for the popover, e.g. 查看原因 / 说明. */
  detailLabel?: string;
  /** Buttons under the detail (e.g. 组织已变更 → 不需要重开). */
  actions?: ReactNode;
};

const TONE: Record<HeaderState["tone"], string> = {
  act: "text-[color:var(--dz-cus)]",
  wait: "text-muted-foreground",
  done: "text-[color:var(--dz-ok)]",
  warn: "text-destructive",
  neutral: "text-muted-foreground",
};

/** Row 1: where you are, and the table's state and save state (保存方式 甲: still a button). */
export function WhereRow({
  crumbs,
  subs,
  links,
  next,
  states,
  savedAt,
  rev,
  unsaved,
  saving,
  canSave,
  onSave,
}: {
  crumbs: string[];
  /** 左栏收起时的“本表小节”下拉。 */
  subs?: ReactNode;
  /** 上下游按钮（上游输入、上游已变更、下游影响），放在状态旁。 */
  links?: ReactNode;
  /** 本表交出去后的下一张（一个小链接，不再占整行）。 */
  next?: ReactNode;
  states: HeaderState[];
  savedAt: string | null;
  rev: number;
  unsaved: number;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <nav aria-label="位置" className="flex min-w-[16rem] flex-1 items-center gap-1 text-muted-foreground">
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3 shrink-0" /> : null}
            <span className={cn("truncate", i === crumbs.length - 1 && "text-foreground")}>{c}</span>
          </span>
        ))}
        {subs}
      </nav>
      <div className="flex shrink-0 items-center gap-2" role="status">
        {states.map((s) => (
          <span key={s.text} className="flex items-center gap-1.5">
            {s.detail ? (
              <Popover>
                <PopoverTrigger className={cn("flex items-center gap-1 font-semibold underline-offset-2 hover:underline", TONE[s.tone])}>
                  <span className="size-1.5 rounded-full bg-current" /> {s.text} · {s.detailLabel ?? "查看原因"}
                </PopoverTrigger>
                <PopoverContent align="end" className="max-w-sm text-sm whitespace-pre-line">
                  {s.detail}
                </PopoverContent>
              </Popover>
            ) : (
              <span className={cn("flex items-center gap-1 font-semibold", TONE[s.tone])}>
                <span className="size-1.5 rounded-full bg-current" /> {s.text}
              </span>
            )}
            {/* 处理按钮（看上游改了什么、影响清单、不需要重开）直接放在提示旁边，不藏进弹层。 */}
            {s.actions ? <span className="flex items-center gap-1 [&_button]:h-6 [&_button]:px-2 [&_button]:text-xs">{s.actions}</span> : null}
          </span>
        ))}
        {links}
        {next}
        <span className="text-muted-foreground">
          {saving ? "保存中…" : unsaved ? null : savedAt ? `已保存 ${formatTime(savedAt).slice(-5)}` : "还没保存过"}
          {rev ? ` · v${rev}` : ""}
        </span>
        {canSave && unsaved ? (
          <Button size="xs" onClick={onSave} disabled={saving} title="Ctrl / ⌘ + S">
            有 {unsaved} 处未保存 · 保存
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Row 2: book title of the current view, view switch, 修订, 批注, 导出, the one next action. */
export function TitleRow({
  title,
  chip,
  chrome,
  revisionOn,
  canRevise,
  onRevision,
  openComments,
  onComments,
  exportMenu,
  history,
  actions,
  links,
}: {
  title: string;
  chip: string;
  /** 上下游按钮，紧跟表号。 */
  links?: ReactNode;
  chrome: EditorChrome | null;
  revisionOn: boolean;
  canRevise: boolean;
  onRevision: () => void;
  openComments: number;
  onComments: () => void;
  exportMenu: ReactNode;
  /** 历史：版本、轮次与查看任意一版。 */
  history?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="min-w-0 font-heading text-xl font-bold text-brand">《{title}》</h1>
      <span className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">{chip}</span>
      {links}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {chrome?.views && chrome.views.length > 1 ? (
          <div role="radiogroup" aria-label="展示方式" className="flex rounded-lg border p-0.5">
            {chrome.views.map((v) => (
              <button
                key={v.key}
                type="button"
                role="radio"
                aria-checked={chrome.view === v.key}
                onClick={() => chrome.setView?.(v.key)}
                className={cn("flex h-7 items-center gap-1 rounded-md px-2.5 text-sm", chrome.view === v.key ? "bg-brand font-semibold text-brand-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
        {chrome?.variants && chrome.variants.length > 1 ? (
          <select
            aria-label="版式"
            value={chrome.variant}
            onChange={(e) => chrome.setVariant?.(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            {chrome.variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        ) : null}
        {/* 次要组：修订、批注、导出只在这里有入口（页脚只显示状态）；流程按钮固定在最右（开营前 UX 改版 F6、F10）。 */}
        <div role="group" aria-label="修订、批注与导出" className="flex items-center gap-0.5 rounded-lg border p-0.5">
          <label className={cn("flex h-7 items-center gap-1.5 rounded-md px-2 text-sm", revisionOn && "text-[color:var(--dz-changed)]")} title="修订（Ctrl / ⌘ + Shift + E）：和任意一版对比">
            <Switch checked={revisionOn} disabled={!canRevise} onCheckedChange={onRevision} aria-label="修订开关" />
            修订
          </label>
          <Button variant="ghost" size="sm" onClick={onComments} title="批注（Ctrl / ⌘ + Alt + M）">
            <MessageSquarePlus /> 批注
            {openComments ? <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: "var(--dz-comment)" }}>{openComments}</span> : null}
          </Button>
          {history}
          {exportMenu}
        </div>
        {actions}
      </div>
    </div>
  );
}

export type InputItem = { code: string; name: string; state: string; tone: "done" | "doing" | "todo" | "warn"; to: string };

const INPUT_TONE: Record<InputItem["tone"], string> = {
  done: "text-[color:var(--dz-ok)]",
  doing: "text-[color:var(--dz-cus)]",
  todo: "text-muted-foreground",
  warn: "text-[color:var(--dz-warn)]",
};

/**
 * 上下游（2026-10-16 页头规整）：上游输入、上游已变更、下游影响合成一个按钮，按钮上只放一个状态，
 * 点开再看每张上游表的状态、变化原因和处理入口。
 */
export function LinksButton({
  inputs,
  stale,
  downstream,
}: {
  inputs: InputItem[];
  /** 本表的上游已变更：原因、已定版与否、看上游改了什么。 */
  stale: { reason: string; advice: string; onView: () => void } | null;
  /** 引用本表的下游：总数、其中待核对的张数、打开影响清单。 */
  downstream: { total: number; waiting: number; onOpen: () => void } | null;
}) {
  if (!inputs.length && !downstream?.total) return null;
  const pending = inputs.filter((i) => i.tone === "todo" || i.tone === "doing").length;
  const [tone, text] = stale
    ? ["warn", "上游已变更"]
    : pending
      ? ["todo", `上游 ${pending} 张未定版`]
      : inputs.length
        ? ["done", `上游 ${inputs.length} 张已定版`]
        : ["todo", "无上游"];
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted",
          stale || downstream?.waiting ? "border-[color:var(--dz-warn)]/50" : "",
        )}
        title="上游输入与下游影响"
      >
        <Waypoints className="size-3.5 text-muted-foreground" />
        <span className={cn("size-1.5 rounded-full bg-current", INPUT_TONE[tone as InputItem["tone"]])} />
        <span className={INPUT_TONE[tone as InputItem["tone"]]}>{text}</span>
        {downstream?.waiting ? <span className="text-[color:var(--dz-warn)]">· 下游 {downstream.waiting} 张待核对</span> : null}
        <ChevronDown className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[26rem] max-w-[92vw] p-0 text-sm">
        {stale ? (
          <div className="border-b bg-[color:var(--dz-warn)]/8 px-4 py-3">
            <div className="font-semibold text-[color:var(--dz-warn)]">上游已变更</div>
            <p className="mt-1 text-xs text-muted-foreground">{stale.reason}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stale.advice}</p>
            <Button size="sm" className="mt-2" onClick={stale.onView}>
              看上游改了什么
            </Button>
          </div>
        ) : null}
        <div className="px-4 py-3">
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">上游输入 · 这张表承接的表</div>
          {inputs.length ? (
            <ul className="flex flex-col gap-1">
              {inputs.map((i) => (
                <li key={i.code} className="flex items-baseline gap-2">
                  <Link to={i.to} className="min-w-0 flex-1 truncate hover:underline" title={`${i.code} ${i.name}`}>
                    《{i.name}》<span className="text-xs text-muted-foreground">{i.code}</span>
                  </Link>
                  <span className={cn("shrink-0 text-xs", INPUT_TONE[i.tone])}>{i.state}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">这是第一张表，没有上游。</p>
          )}
        </div>
        {downstream?.total ? (
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <span className="min-w-0 flex-1 text-xs">
              <span className="font-semibold text-muted-foreground">下游</span> · {downstream.total} 张表引用本表
              {downstream.waiting ? <span className="text-[color:var(--dz-warn)]">，{downstream.waiting} 张待核对</span> : null}
            </span>
            <Button size="sm" variant="outline" onClick={downstream.onOpen}>
              影响清单
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function ExportMenu({ children }: { children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="导出" title="导出" />}>
        <Download />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-60 flex-col items-stretch gap-1.5 p-2 [&_button]:w-full [&_button]:justify-start">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function ToolButton({ label, shortcut, icon, onClick, disabled, active, text }: { label: string; shortcut?: string; icon: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; text?: boolean }) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size={text ? "sm" : "icon-sm"}
      aria-label={label}
      aria-pressed={active}
      title={`${label}${shortcut ? `（${shortcut}）` : ""}${disabled ? " · 先在图或表里选中一项" : ""}`}
      disabled={disabled || !onClick}
      onClick={onClick}
    >
      {icon}
      {text ? label : null}
    </Button>
  );
}

const Sep = () => <span aria-hidden className="mx-1 h-5 w-px bg-border" />;

/** Row 3: the structure toolbar (same in 思维导图 and 表格; acts on the selected node / row). */
export function StructureToolbar({
  chrome,
  readOnly,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onComment,
  selecting,
  onLasso,
  onShortcuts,
  method,
  setHowToSlot,
}: {
  /** 编辑器的“怎么填”放进这里。 */
  setHowToSlot?: (el: HTMLElement | null) => void;
  /** 书中方法一句话，点开右栏“书中方法”（打开时高亮）。 */
  method?: ReactNode;
  chrome: EditorChrome | null;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onComment: () => void;
  selecting: boolean;
  onLasso: () => void;
  onShortcuts: () => void;
}) {
  const t = chrome?.tools;
  const off = readOnly || !t?.selected;
  const z = chrome?.zoom;
  return (
    <div role="toolbar" aria-label="调整工具条" className="flex min-h-10 flex-wrap items-center gap-0.5">
      <ToolButton label="撤销" shortcut="Ctrl+Z" icon={<Undo2 />} onClick={onUndo} disabled={readOnly || !canUndo} />
      <ToolButton label="重做" shortcut="Ctrl+Shift+Z" icon={<Redo2 />} onClick={onRedo} disabled={readOnly || !canRedo} />
      {t ? (
        <>
      <Sep />
      <ToolButton text label="下级" shortcut="Tab" icon={<CornerDownRight />} onClick={t?.child} disabled={off} />
      <ToolButton text label="同级" shortcut="Enter" icon={<Plus />} onClick={t?.sibling} disabled={off} />
      <Sep />
      <ToolButton label="升一级" shortcut="Alt+Shift+←" icon={<IndentDecrease />} onClick={t?.outdent} disabled={off} />
      <ToolButton label="降一级" shortcut="Alt+Shift+→" icon={<IndentIncrease />} onClick={t?.indent} disabled={off} />
      <ToolButton label="上移" shortcut="Alt+Shift+↑" icon={<ArrowUp />} onClick={t?.up} disabled={off} />
      <ToolButton label="下移" shortcut="Alt+Shift+↓" icon={<ArrowDown />} onClick={t?.down} disabled={off} />
      <Sep />
      <ToolButton text label="移动到…" shortcut="Shift+F10" icon={<FolderInput />} onClick={t?.moveTo} disabled={off} />
      {t?.split || t?.merge ? (
        <>
          <ToolButton label="拆分" icon={<Split />} onClick={t?.split} disabled={off} />
          <ToolButton label="合并" icon={<Combine />} onClick={t?.merge} disabled={off} />
        </>
      ) : null}
        </>
      ) : null}
      <Sep />
      <ToolButton text label="批注" shortcut="Ctrl+Alt+M" icon={<MessageSquarePlus />} onClick={onComment} />
      <ToolButton text label="圈选" icon={<LassoSelect />} onClick={onLasso} active={selecting} />
      {t ? (
        <>
          <Sep />
          <ToolButton label="删除" shortcut="Delete" icon={<Trash2 className="text-destructive" />} onClick={t?.remove} disabled={off} />
        </>
      ) : null}
      <span className="flex-1" />
      {chrome?.extra}
      {z ? (
        <div className="flex items-center rounded-lg border">
          <ToolButton label="缩小" icon={<ZoomOut />} onClick={() => z.set(Math.max(0.5, Math.round((z.value - 0.1) * 10) / 10))} />
          <span className="w-11 text-center text-xs tabular-nums">{Math.round(z.value * 100)}%</span>
          <ToolButton label="放大" icon={<ZoomIn />} onClick={() => z.set(Math.min(1.6, Math.round((z.value + 0.1) * 10) / 10))} />
          <ToolButton label="适应画布" icon={<Maximize />} onClick={z.fit} />
          {z.setMinimap ? <ToolButton label="小地图" icon={<MapIcon />} onClick={() => z.setMinimap?.(!z.minimap)} active={z.minimap} /> : null}
        </div>
      ) : null}
      {method}
      <span ref={setHowToSlot} className="contents" />
      <ToolButton label="快捷键" shortcut="?" icon={<Keyboard />} onClick={onShortcuts} />
    </div>
  );
}

/** Narrow screens: the right panel becomes a drawer below 1100px, the rail an icon bar below 1280px. */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

