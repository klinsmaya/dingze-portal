import { Crosshair, GitCompareArrows, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { diffPayloads, summarizeDiff } from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type { ProjectSummary } from "@/lib/dingze/api";
import { type Command, VIA_LABELS, type Via, anchorsOf, laterConflicts, preview, revertCommand } from "@/lib/dingze/edit-log";
import { locateAnchor } from "@/lib/dingze/locate";
import { formatTime } from "@/lib/dingze/records";
import { type SavedCommand, getVersionPayload } from "@/lib/dingze/records-api";
import { useArtifactHistory } from "@/lib/dingze/records-queries";

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

  return (
    <div className="flex flex-col gap-3">
      <RevisionControl project={project} code={code} versions={versions.map((v) => ({ rev: v.rev, by: v.by, at: v.at, kind: v.kind }))} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <NativeSelect size="sm" aria-label="按人筛选" value={byPerson} onChange={(e) => setByPerson(e.target.value)}>
          <NativeSelectOption value="">全部人</NativeSelectOption>
          {people.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {p}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect size="sm" aria-label="按来源筛选" value={byVia} onChange={(e) => setByVia(e.target.value as Via | "")}>
          <NativeSelectOption value="">全部来源</NativeSelectOption>
          {(Object.keys(VIA_LABELS) as Via[]).map((v) => (
            <NativeSelectOption key={v} value={v}>
              {VIA_LABELS[v]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground">{shown.length} 条</span>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">这一版还没有修改。改动会按“谁、什么时候、从哪里改”记在这里，每条都能定位和撤销。</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="修改记录">
          {shown.map((row, i) => {
            const prev = shown[i - 1];
            const header = row.saved && row.rev !== prev?.rev ? `v${row.rev} 保存的修改` : !row.saved && i === 0 ? "未保存" : null;
            const no = row.command.commentId ? commentNo(row.command.commentId) : null;
            return (
              <li key={row.key} className="flex flex-col gap-1">
                {header ? <div className="mt-1 text-[11px] font-semibold text-muted-foreground">{header}</div> : null}
                <div className="rounded-lg border bg-card px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{row.command.by}</span>
                    <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                      {VIA_LABELS[row.command.via]}
                    </Badge>
                    {no ? <Badge className="h-4 px-1 text-[10px]" style={{ background: "var(--dz-comment)" }}>批注 {no}</Badge> : null}
                    <span className="ml-auto">{formatTime(row.command.at)}</span>
                  </div>
                  <div className="mt-0.5">{row.command.label}</div>
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
                  <div className="mt-1 flex gap-1">
                    <Button size="xs" variant="ghost" onClick={() => locate(row)}>
                      <Crosshair /> 定位
                    </Button>
                    {!session.readOnly ? (
                      <Button size="xs" variant="ghost" onClick={() => undo(row)}>
                        <Undo2 /> 撤销
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** 修订 switch: compare the draft with any saved version; marks changed rows on the canvas. */
export function RevisionControl({ project, code, versions }: { project: ProjectSummary; code: string; versions: { rev: number; by: string; at: string; kind: string }[] }) {
  const session = useEditSession();
  const [pending, setPending] = useState(false);
  if (!session) return null;
  const { revision } = session;
  const fallback = versions[1]?.rev ?? versions[0]?.rev ?? null;

  const load = async (rev: number | null, on: boolean) => {
    if (!on || !rev) {
      session.setRevision({ ...revision, on, baseRev: rev ?? revision.baseRev });
      return;
    }
    setPending(true);
    try {
      const v = await getVersionPayload(project.id, project.spaceName, code, rev);
      session.setRevision({ on: true, baseRev: rev, basePayload: v.payload, baseLabel: `v${rev} · ${v.by || "—"} ${formatTime(v.at)}` });
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
        <Switch
          checked={revision.on}
          disabled={pending || versions.length === 0}
          onCheckedChange={(on) => load(revision.baseRev ?? fallback, on)}
          aria-label="修订开关"
        />
        <span className="text-xs text-muted-foreground">Ctrl+Shift+E</span>
      </div>
      {versions.length ? (
        <label className="flex items-center gap-2 text-xs">
          对比
          <NativeSelect
            size="sm"
            aria-label="对比的版本"
            value={String(revision.baseRev ?? fallback ?? "")}
            onChange={(e) => load(Number(e.target.value), true)}
          >
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
          对比 {revision.baseLabel}：改 {summary.changed} 处 · 增 {summary.added} 项 · 删 {summary.removed} 项。表里青色竖线是改过的，绿色是新增的，悬停看原值。
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">关着时，只用青色竖线标出“上次保存之后改过的”格子。</p>
      )}
    </div>
  );
}
