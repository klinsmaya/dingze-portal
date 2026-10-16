import { STAGES, getArtifactDef } from "@dingze/shared";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectSummary } from "@/lib/dingze/api";
import { errorMessage } from "@/lib/dingze/errors";
import { useImportArtifacts, useImportSources } from "@/lib/dingze/queries";
import { cn } from "@/lib/utils";

/**
 * 从已有项目带入（2026-10-16 甲方确认）：企业项目负责人手动选来源项目和表；带入后都是草稿，
 * 照常本步完成、复核、定版。已定版的表带定版内容，没定版的带最新草稿。
 */
export function ImportDialog({ project, open, onOpenChange }: { project: ProjectSummary; open: boolean; onOpenChange: (open: boolean) => void }) {
  const sources = useImportSources(project, open);
  const run = useImportArtifacts(project);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = sources.data ?? [];
  const source = list.find((s) => s.projectId === sourceId) ?? list[0];
  const rows = source?.artifacts ?? [];
  const importable = rows.filter((r) => !r.blocker).map((r) => r.code);

  const choose = (id: number) => {
    setSourceId(id);
    setPicked(new Set());
  };
  const toggle = (code: string, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(code);
    else next.delete(code);
    setPicked(next);
  };
  const submit = () => {
    if (!source || picked.size === 0) return;
    run.mutate(
      { sourceProjectId: source.projectId, codes: [...picked] },
      {
        onSuccess: (r) => {
          toast.success(`已带入 ${r.imported.length} 张表${r.skipped.length ? `，${r.skipped.length} 张没带入：${r.skipped.map((s) => `${getArtifactDef(s.code).specId} ${s.reason}`).join("；")}` : ""}`);
          setPicked(new Set());
          onOpenChange(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>从已有项目带入</DialogTitle>
          <DialogDescription>选一个本企业的已有项目，勾选要带入的表。带入后都是草稿，照常本步完成、复核、定版；年度、数值请按本项目改。</DialogDescription>
        </DialogHeader>

        {sources.isLoading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : sources.error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(sources.error)}</AlertDescription>
          </Alert>
        ) : list.length === 0 ? (
          <Alert>
            <AlertDescription>没有可以带入的项目：本企业没有其他项目，或者你不是它们的成员。</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              来源项目
              <NativeSelect aria-label="来源项目" value={source?.projectId ?? ""} onChange={(e) => choose(Number(e.target.value))}>
                {list.map((s) => (
                  <NativeSelectOption key={s.projectId} value={s.projectId}>
                    {s.name.includes(String(s.year)) ? s.name : `${s.year} · ${s.name}`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(importable))} disabled={!importable.length}>
                  全选可带入的
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())} disabled={!picked.size}>
                  清空
                </Button>
              </span>
            </label>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">这个项目还没有填过内容。</p>
            ) : (
              STAGES.map((stage) => {
                const inStage = rows.filter((r) => getArtifactDef(r.code).stage === stage.key);
                if (!inStage.length) return null;
                return (
                  <section key={stage.key} aria-label={stage.name}>
                    <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{stage.name}</h3>
                    <ul className="flex flex-col divide-y rounded-lg border">
                      {inStage.map((r) => {
                        const def = getArtifactDef(r.code);
                        const id = `import-${r.code}`;
                        return (
                          <li key={r.code} className={cn("flex items-start gap-3 px-3 py-2", r.blocker && "opacity-60")}>
                            <Checkbox id={id} checked={picked.has(r.code)} disabled={!!r.blocker} onCheckedChange={(on) => toggle(r.code, !!on)} className="mt-0.5" />
                            <label htmlFor={id} className="min-w-0 flex-1 text-sm">
                              <span className="font-medium">{def.priority === "method" ? def.name : def.plain}</span>
                              <span className="ml-1.5 text-xs text-muted-foreground">{def.specId}</span>
                              <span className="block text-xs text-muted-foreground">
                                {r.blocker ?? (r.targetStatus === "in_progress" ? "本项目已有草稿：带入后作为新版本，原内容在历史里" : "本项目还没填")}
                              </span>
                            </label>
                            <span className={cn("shrink-0 text-xs", r.basis.locked ? "text-[color:var(--dz-ok)]" : "text-muted-foreground")}>带{r.basis.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={!picked.size || run.isPending}>
            {run.isPending ? "带入中…" : `带入 ${picked.size} 张`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
