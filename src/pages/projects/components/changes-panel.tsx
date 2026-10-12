import { ClipboardPaste, Crosshair, Download, GitCompareArrows, Import, MessageSquareText, Network, Table2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { diffPayloads, summarizeDiff } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type { ProjectSummary } from "@/lib/dingze/api";
import { type Command, VIA_LABELS, type Via, anchorsOf, laterConflicts, preview, revertCommand } from "@/lib/dingze/edit-log";
import { locateAnchor } from "@/lib/dingze/locate";
import { formatTime } from "@/lib/dingze/records";
import type { SavedCommand } from "@/lib/dingze/records-api";
import { useArtifactHistory } from "@/lib/dingze/records-queries";
import { cn } from "@/lib/utils";

import { useEditSession } from "./edit-session";

type Row = { key: string; command: Command; saved: boolean; rev: number | null };

/** 修改 tab: the command log — unsaved edits first, then what each saved version contained. */
export function ChangesPanel({ project, code, commentNo }: { project: ProjectSummary; code: string; commentNo: (id: number) => number | null }) {
  const session = useEditSession();
  const history = useArtifactHistory(project, code);
  const [byPerson, setByPerson] = useState("");
  const [byVia, setByVia] = useState<Via | "">("");
  const versions = history.data?.versions ?? [];

  const rows: Row[] = useMemo(() => {
    const local = [...(session?.log ?? [])].reverse().map((c) => ({ key: c.id, command: { ...c, by: c.by ?? "我" }, saved: false, rev: null }));
    const saved = versions.flatMap((v) =>
      [...(v.changes ?? [])].reverse().map((c: SavedCommand, i) => ({
        key: `v${v.rev}-${i}`,
        command: { id: `v${v.rev}-${i}`, at: c.at, via: c.via, label: c.label, by: c.by || v.by, commentId: c.commentId, changes: c.changes.map((x) => ({ ...x, before: x.before ?? undefined, after: x.after ?? undefined })) },
        saved: true,
        rev: v.rev,
      }))
    );
    return [...local, ...saved];
  }, [session?.log, versions]);

  if (!session) return null;
  const people = [...new Set(rows.map((r) => r.command.by).filter(Boolean))] as string[];
  const shown = rows.filter((r) => (!byPerson || r.command.by === byPerson) && (!byVia || r.command.via === byVia));

  const undo = (row: Row) => {
    if (session.readOnly) return toast.error("当前不能修改这张表");
    if (!row.saved) {
      const later = laterConflicts(session.log, row.command);
      if (later.length && !window.confirm(`之后还有 ${later.length} 处修改改过同一位置，撤销会把它们一起覆盖。继续？`)) return;
      session.undoCommand(row.command);
      return;
    }
    // A saved command: revert its paths on the current draft as a new edit.
    if (!window.confirm(`撤销已保存的修改「${row.command.label}」？会作为一次新修改记录，保存后生效。`)) return;
    session.commit(revertCommand(session.draft, row.command), { via: "undo", label: `撤销：${row.command.label}` });
  };

  const locate = (row: Row) => {
    const anchors = anchorsOf(row.command.changes);
    if (!anchors.some((a) => locateAnchor(a))) toast.info("这处内容已经不在表里了（可能被删除或移动）");
  };

  const day = (at: string) => {
    const d = new Date(at);
    const today = new Date();
    const y = new Date(today.getTime() - 86_400_000);
    const same = (x: Date) => x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
    return same(today) ? "今天" : same(y) ? "昨天" : `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  };
  const clock = (at: string) => formatTime(at).slice(11);
  const exportCsv = () => {
    const lines = [["时间", "谁", "来源", "批注", "修改", "版本"], ...shown.map((r) => [formatTime(r.command.at), r.command.by ?? "", VIA_LABELS[r.command.via], r.command.commentId ? String(commentNo(r.command.commentId) ?? "") : "", r.command.label, r.saved ? `v${r.rev}` : "未保存"])];
    const csv = "\ufeff" + lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `修改记录-${code}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <RevisionControl />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          aria-pressed={!byPerson && !byVia}
          onClick={() => {
            setByPerson("");
            setByVia("");
          }}
          className={cn("rounded-full border px-2.5 py-0.5", !byPerson && !byVia ? "border-brand font-semibold text-brand" : "text-muted-foreground")}
        >
          全部 {rows.length}
        </button>
        <NativeSelect size="sm" aria-label="按人筛选" value={byPerson} onChange={(e) => setByPerson(e.target.value)} className="w-24">
          <NativeSelectOption value="">按人</NativeSelectOption>
          {people.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {p}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect size="sm" aria-label="按来源筛选" value={byVia} onChange={(e) => setByVia(e.target.value as Via | "")} className="w-24">
          <NativeSelectOption value="">按来源</NativeSelectOption>
          {(Object.keys(VIA_LABELS) as Via[]).map((v) => (
            <NativeSelectOption key={v} value={v}>
              {VIA_LABELS[v]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button size="xs" variant="ghost" className="ml-auto" onClick={exportCsv} disabled={!shown.length} title="导出为 Excel 可打开的 CSV">
          <Download /> 导出
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">这一版还没有修改。改动会按“谁、什么时候、从哪里改”记在这里，每条都能定位和撤销。</p>
      ) : (
        <ol className="flex flex-col" aria-label="修改记录">
          {shown.map((row, i) => {
            const prev = shown[i - 1];
            const dayHeader = !prev || day(prev.command.at) !== day(row.command.at) ? day(row.command.at) : null;
            const versionHeader = row.saved && row.rev !== prev?.rev ? `v${row.rev} 保存` : !row.saved && i === 0 ? "未保存" : null;
            const no = row.command.commentId ? commentNo(row.command.commentId) : null;
            return (
              <li key={row.key} className="flex flex-col">
                {dayHeader ? <div className="mt-2 mb-1 text-xs font-semibold">{dayHeader}</div> : null}
                {versionHeader ? <div className="mt-1 mb-1 text-[11px] text-muted-foreground">{versionHeader}</div> : null}
                <div className={cn("grid grid-cols-[2.75rem_1fr] gap-2 border-b py-2 text-sm", !row.saved && "bg-muted/40")}>
                  <span className="pt-0.5 text-xs text-muted-foreground tabular-nums">{clock(row.command.at)}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span aria-hidden className="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: "var(--dz-fin)" }}>
                        {(row.command.by ?? "?").slice(0, 1)}
                      </span>
                      <b>{row.command.by}</b>
                      <span className="flex items-center gap-0.5 rounded border px-1 text-[10px] text-muted-foreground">
                        {VIA_ICON[row.command.via]} {VIA_LABELS[row.command.via]}
                      </span>
                      {no ? (
                        <span className="rounded px-1 text-[10px] font-semibold" style={{ color: "var(--dz-comment)", background: "color-mix(in oklab, var(--dz-comment) 12%, transparent)" }}>
                          批注 {no}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 leading-snug">{row.command.label}</div>
                    {row.command.changes.length > 1 ? (
                      <details className="mt-0.5 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">{row.command.changes.length} 处明细</summary>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {row.command.changes.slice(0, 12).map((c) => (
                            <li key={c.path}>
                              {session.nameOf(c.path)}：{c.kind === "added" ? `新增 ${preview(c.after)}` : c.kind === "removed" ? `删除 ${preview(c.before)}` : `${preview(c.before)} → ${preview(c.after)}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    <div className="mt-1 flex gap-3 text-xs">
                      <button type="button" className="flex items-center gap-1 text-brand hover:underline" onClick={() => locate(row)}>
                        <Crosshair className="size-3" /> 定位
                      </button>
                      {!session.readOnly ? (
                        <button type="button" className="flex items-center gap-1 text-brand hover:underline" onClick={() => undo(row)}>
                          <Undo2 className="size-3" /> 撤销
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {session.revision.on && session.revision.baseLabel ? <p className="text-[11px] text-muted-foreground">对比起点：{session.revision.baseLabel}</p> : null}
    </div>
  );
}

const VIA_ICON: Record<Via, React.ReactNode> = {
  edit: <Table2 className="size-3" />,
  structure: <Network className="size-3" />,
  chat: <MessageSquareText className="size-3" />,
  paste: <ClipboardPaste className="size-3" />,
  undo: <Undo2 className="size-3" />,
  import: <Import className="size-3" />,
};

/** 修订 switch: compare the draft with any saved version; marks changed rows on the canvas. */
export function RevisionControl() {
  const session = useEditSession();
  const [pending, setPending] = useState(false);
  if (!session) return null;
  const { revision, versions } = session;
  const fallback = versions[1]?.rev ?? versions[0]?.rev ?? null;
  const load = async (rev: number | null, on: boolean) => {
    setPending(true);
    try {
      await session.compareWith(rev, on);
    } catch {
      toast.error("读取对比版本失败");
    } finally {
      setPending(false);
    }
  };

  const summary = revision.on && revision.basePayload !== undefined ? summarizeDiff(diffPayloads(revision.basePayload, session.draft)) : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <GitCompareArrows className="size-4 text-muted-foreground" />
        <span className="font-semibold">修订</span>
        <Switch checked={revision.on} disabled={pending || versions.length === 0} onCheckedChange={(on) => load(revision.baseRev ?? fallback, on)} aria-label="修订开关" />
        <span className="text-xs text-muted-foreground">Ctrl+Shift+E</span>
      </div>
      {versions.length ? (
        <label className="flex items-center gap-2 text-xs">
          对比
          <NativeSelect size="sm" aria-label="对比的版本" value={String(revision.baseRev ?? fallback ?? "")} onChange={(e) => load(Number(e.target.value), true)}>
            {versions.map((v) => (
              <NativeSelectOption key={v.rev} value={String(v.rev)}>
                v{v.rev} · {v.by || "—"} · {formatTime(v.at)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          → 当前
        </label>
      ) : (
        <p className="text-xs text-muted-foreground">还没有保存过的版本可以对比。</p>
      )}
      {summary ? (
        <p className="text-xs text-muted-foreground">
          对比 {revision.baseLabel}：改 {summary.changed} 处 · 增 {summary.added} 项 · 删 {summary.removed} 项。表里青色竖线是改过的，绿色是新增的，悬停看原值；删掉的项列在下面。
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">关着时，只用青色竖线标出“上次保存之后改过的”地方。</p>
      )}
      {revision.on && revision.basePayload !== undefined ? <RemovedList /> : null}
    </div>
  );
}

/** Rows deleted since the compared version: they are no longer on the canvas, so list them. */
function RemovedList() {
  const session = useEditSession()!;
  const removed = diffPayloads(session.revision.basePayload, session.draft).filter((d) => d.kind === "removed");
  if (!removed.length) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-xs" aria-label="已删除的内容">
      {removed.slice(0, 12).map((d) => (
        <li key={d.path} className="line-through" style={{ color: "var(--dz-removed)" }}>
          {session.nameOf(d.path)}：{preview(d.before)}
        </li>
      ))}
    </ul>
  );
}
