import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { ACTION_LABELS, STATUS_LABELS, VERSION_KIND_LABELS, getArtifactDef } from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectSummary } from "@/lib/dingze/api";
import { errorMessage } from "@/lib/dingze/errors";
import { formatTime } from "@/lib/dingze/records";
import { getVersionPayload } from "@/lib/dingze/records-api";
import { useArtifactHistory, useVersionDiff } from "@/lib/dingze/records-queries";
import { workspacePath } from "@/lib/dingze/progress";
import { lockRounds, roundOf } from "@/lib/dingze/rounds";
import { cn } from "@/lib/utils";

import { pathNamer } from "./edit-session";

const KIND_TONE: Record<string, string> = {
  added: "bg-status-done text-status-done-foreground",
  removed: "bg-status-stale text-status-stale-foreground",
  changed: "bg-status-progress text-status-progress-foreground",
};
const KIND_LABEL: Record<string, string> = { added: "新增", removed: "删除", changed: "修改" };

/** A whole row or list arrives as JSON text: show its name instead of the JSON. */
function readable(text: string): string {
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return text;
  try {
    const v = JSON.parse(t) as unknown;
    if (Array.isArray(v)) return `${v.length} 条`;
    const o = v as Record<string, unknown>;
    const name = [o.name, o.title, o.path, o.task, o.metric, o.deptName].find((x) => typeof x === "string" && x);
    return typeof name === "string" ? `「${name}」这一条` : "一条内容";
  } catch {
    // Cut-off JSON (long values are truncated by the server).
    const m = t.match(/"(?:name|title|path|task|metric|deptName)":"([^"]+)"/);
    return m ? `「${m[1]}」这一条` : "一条内容";
  }
}

/** Versions, operations and a two-version comparison for one artifact. */
export function ArtifactHistorySheet({
  project,
  code,
  onClose,
}: {
  project: ProjectSummary;
  code: string | null;
  onClose: () => void;
}) {
  const history = useArtifactHistory(project, code);
  const versions = history.data?.versions ?? [];
  const [pair, setPair] = useState<{ code: string; from: number; to: number } | null>(null);
  // Default comparison: the first AI draft (or first version) against the latest.
  const firstAi = [...versions].reverse().find((v) => v.kind === "ai_draft") ?? versions[versions.length - 1];
  const defaults = versions.length >= 2 ? { from: firstAi?.rev ?? versions[versions.length - 1].rev, to: versions[0].rev } : null;
  const current = pair && pair.code === code ? pair : defaults && code ? { code, ...defaults } : null;
  const diff = useVersionDiff(project, code, current?.from ?? null, current?.to ?? null);
  // Business names instead of technical keys (验收意见 E D07): rows by their label, fields by name.
  // Both versions: a removed row only has its name in the older one.
  const payloadOf = (rev: number | undefined) => ({
    queryKey: ["dingze", "version-payload", project.id, code ?? "", rev ?? 0],
    queryFn: () => getVersionPayload(project.id, project.spaceName, code!, rev!),
    enabled: !!code && !!rev,
  });
  const toPayload = useQuery(payloadOf(current?.to));
  const fromPayload = useQuery(payloadOf(current?.from));
  const nameOf = useMemo(
    () => pathNamer({ before: fromPayload.data?.payload, after: toPayload.data?.payload }),
    [fromPayload.data, toPayload.data],
  );
  const def = code ? getArtifactDef(code) : null;
  const rounds = useMemo(() => lockRounds(history.data?.events ?? []), [history.data]);

  return (
    <Sheet open={!!code} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{def ? `${def.specId} 《${def.name}》` : ""}</SheetTitle>
          <SheetDescription>版本、操作记录和任意两个版本的差异。每次定版是一轮，之后的修改属于“优化”；点“查看”打开那一版的完整内容（只读）。</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {history.error ? (
            <p className="text-sm text-destructive">{errorMessage(history.error)}</p>
          ) : history.isLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <Tabs defaultValue="versions">
              <TabsList>
                <TabsTrigger value="versions">版本（{versions.length}）</TabsTrigger>
                <TabsTrigger value="diff">版本对比</TabsTrigger>
                <TabsTrigger value="events">操作记录</TabsTrigger>
              </TabsList>
              <TabsContent value="versions" className="pt-3">
                <ol className="flex flex-col gap-2">
                  {versions.map((v) => (
                    <li key={v.rev} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="font-semibold tabular-nums">v{v.rev}</span>
                      <Badge variant={v.kind === "ai_draft" ? "secondary" : "outline"}>{VERSION_KIND_LABELS[v.kind] ?? v.kind}</Badge>
                      {rounds.get(v.rev) ? <Badge className="bg-status-locked text-status-locked-foreground">{rounds.get(v.rev)!.label}</Badge> : roundOf(v.rev, rounds) ? <span className="text-xs text-muted-foreground">{roundOf(v.rev, rounds)}</span> : null}
                      <span>{v.by || "—"}</span>
                      <span className="text-muted-foreground">{formatTime(v.at)}</span>
                      {code ? (
                        <Link to={`${workspacePath(project.id, code)}?view=${v.rev}`} onClick={onClose} className="ml-auto text-xs text-primary hover:underline">
                          查看
                        </Link>
                      ) : null}
                      {v.note ? <span className="basis-full text-xs text-muted-foreground">{v.note}</span> : null}
                    </li>
                  ))}
                  {versions.length === 0 ? <li className="text-sm text-muted-foreground">还没有版本</li> : null}
                </ol>
              </TabsContent>
              <TabsContent value="diff" className="flex flex-col gap-3 pt-3">
                {versions.length < 2 || !current ? (
                  <p className="text-sm text-muted-foreground">至少需要两个版本才能对比。</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>从</span>
                      <NativeSelect size="sm" aria-label="对比起点版本" value={String(current.from)} onChange={(e) => setPair({ code: code!, from: Number(e.target.value), to: current.to })}>
                        {versions.map((v) => (
                          <NativeSelectOption key={v.rev} value={String(v.rev)}>
                            v{v.rev} {VERSION_KIND_LABELS[v.kind] ?? ""}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <span>到</span>
                      <NativeSelect size="sm" aria-label="对比终点版本" value={String(current.to)} onChange={(e) => setPair({ code: code!, from: current.from, to: Number(e.target.value) })}>
                        {versions.map((v) => (
                          <NativeSelectOption key={v.rev} value={String(v.rev)}>
                            v{v.rev} {VERSION_KIND_LABELS[v.kind] ?? ""}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      {diff.data ? (
                        <span className="text-xs text-muted-foreground">
                          修改 {diff.data.summary.changed} · 新增 {diff.data.summary.added} · 删除 {diff.data.summary.removed}
                        </span>
                      ) : null}
                    </div>
                    {current.from === current.to ? (
                      <p className="text-sm text-muted-foreground">选两个不同的版本。</p>
                    ) : diff.isLoading ? (
                      <Skeleton className="h-32" />
                    ) : diff.error ? (
                      <p className="text-sm text-destructive">{errorMessage(diff.error)}</p>
                    ) : diff.data?.entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">两个版本内容相同。</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {diff.data?.entries.map((e, i) => (
                          <li key={i} className="rounded-lg border p-2 text-xs">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge className={cn("font-semibold", KIND_TONE[e.kind])}>{KIND_LABEL[e.kind]}</Badge>
                              <span className="break-all text-muted-foreground" title={e.path}>
                                {nameOf(e.path)}
                              </span>
                            </div>
                            {e.before ? <div className="break-all text-muted-foreground line-through">{readable(e.before)}</div> : null}
                            {e.after ? <div className="break-all">{readable(e.after)}</div> : null}
                          </li>
                        ))}
                        {diff.data?.truncated ? <li className="text-xs text-muted-foreground">差异较多，只列出前 300 处。</li> : null}
                      </ul>
                    )}
                  </>
                )}
              </TabsContent>
              <TabsContent value="events" className="pt-3">
                <ol className="flex flex-col gap-2">
                  {(history.data?.events ?? []).map((e, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="font-semibold">{ACTION_LABELS[e.action] ?? e.action}</span>
                      {e.rev ? <span className="tabular-nums text-muted-foreground">v{e.rev}</span> : null}
                      {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus ? (
                        <span className="text-xs text-muted-foreground">
                          {STATUS_LABELS[e.fromStatus]} → {STATUS_LABELS[e.toStatus]}
                        </span>
                      ) : null}
                      <span>{e.by || "—"}</span>
                      <span className="text-muted-foreground">{formatTime(e.at)}</span>
                      {e.reason ? <span className="basis-full text-xs">原因：{e.reason}</span> : null}
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
