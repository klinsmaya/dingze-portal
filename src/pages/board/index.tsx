import { ArrowRight, ClipboardCheck, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import {
  BOARD_BUCKETS,
  type BoardBucket,
  PROJECT_ROLE_LABELS,
  STAGES,
  type StageKey,
  boardBucket,
  getArtifactDef,
  stageGateCodes,
  waitingDays,
} from "@dingze/shared";

import { StatusBadge } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { BoardArtifact, BoardProject } from "@/lib/dingze/api";
import { errorMessage } from "@/lib/dingze/errors";
import { workspacePath } from "@/lib/dingze/progress";
import { useConsultantBoard } from "@/lib/dingze/queries";

type Item = { project: BoardProject; artifact: BoardArtifact; bucket: BoardBucket; stage: StageKey; name: string };

export default function ConsultantBoardPage() {
  const board = useConsultantBoard();
  const [bucket, setBucket] = useState<BoardBucket | null>(null);
  const [enterpriseId, setEnterpriseId] = useState<number | null>(null);
  const [stage, setStage] = useState<StageKey | "all">("all");

  const projects = useMemo(() => board.data?.projects ?? [], [board.data]);
  const enterprises = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of projects) if (p.enterprise) map.set(p.enterprise.id, p.enterprise.shortName);
    return [...map.entries()];
  }, [projects]);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const project of projects) {
      if (enterpriseId && project.enterprise?.id !== enterpriseId) continue;
      for (const artifact of project.artifacts) {
        const b = boardBucket(artifact.status, artifact.stale);
        const def = getArtifactDef(artifact.code);
        if (!b || !def) continue;
        if (stage !== "all" && def.stage !== stage) continue;
        out.push({ project, artifact, bucket: b, stage: def.stage, name: def.name });
      }
    }
    // Longest-waiting first inside each bucket.
    return out.sort((a, b) => (a.artifact.updatedAt ?? "").localeCompare(b.artifact.updatedAt ?? ""));
  }, [projects, enterpriseId, stage]);

  const counts = useMemo(() => {
    const map = new Map<BoardBucket, number>();
    for (const item of items) map.set(item.bucket, (map.get(item.bucket) ?? 0) + 1);
    return map;
  }, [items]);

  const visibleBuckets = BOARD_BUCKETS.filter((b) => (bucket ? b.key === bucket : (counts.get(b.key) ?? 0) > 0));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand">咨询师工作台</h1>
        <p className="mt-1 text-sm text-muted-foreground">所有你负责的企业与项目里，需要你推进的成果。</p>
      </div>

      {board.error ? (
        <Alert variant="destructive">
          <AlertTitle>工作台加载失败</AlertTitle>
          <AlertDescription>{errorMessage(board.error)}</AlertDescription>
        </Alert>
      ) : board.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : projects.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>还没有负责的项目</EmptyTitle>
            <EmptyDescription>运营管理员把你设为项目的主咨询师或协作咨询师后，项目会出现在这里。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {BOARD_BUCKETS.map((b) => {
              const active = bucket === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBucket(active ? null : b.key)}
                  className={cn(
                    "rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active && "border-primary bg-primary/5",
                    b.key === "stale" && (counts.get("stale") ?? 0) > 0 && "border-destructive/40"
                  )}
                >
                  <div className="text-2xl font-bold tabular-nums">{counts.get(b.key) ?? 0}</div>
                  <div className="text-sm font-medium">{b.label}</div>
                  <div className="mt-1 hidden text-xs text-muted-foreground sm:block">{b.hint}</div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect
              aria-label="按企业筛选"
              value={enterpriseId ?? ""}
              onChange={(e) => setEnterpriseId(e.target.value ? Number(e.target.value) : null)}
            >
              <NativeSelectOption value="">全部企业</NativeSelectOption>
              {enterprises.map(([id, name]) => (
                <NativeSelectOption key={id} value={id}>
                  {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <ToggleGroup
              value={[stage]}
              onValueChange={(value) => setStage((value[0] as StageKey | "all" | undefined) ?? "all")}
              variant="outline"
            >
              <ToggleGroupItem value="all">全部阶段</ToggleGroupItem>
              {STAGES.map((s) => (
                <ToggleGroupItem key={s.key} value={s.key}>
                  {s.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {visibleBuckets.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardCheck />
                </EmptyMedia>
                <EmptyTitle>没有待处理的成果</EmptyTitle>
                <EmptyDescription>企业提交复核或上游发生变化时，会出现在这里。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            visibleBuckets.map((b) => {
              const rows = items.filter((i) => i.bucket === b.key);
              return (
                <section key={b.key} className="flex flex-col gap-2">
                  <h2 className="flex items-baseline gap-2 font-heading text-lg font-bold">
                    {b.label} <span className="text-sm font-normal text-muted-foreground">{rows.length}</span>
                  </h2>
                  {rows.length === 0 ? (
                    <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">暂无</p>
                  ) : (
                    <ul className="overflow-hidden rounded-xl border bg-card">
                      {rows.map((item) => (
                        <BoardRow key={`${item.project.id}-${item.artifact.code}`} item={item} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-bold">项目进度</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects
                .filter((p) => !enterpriseId || p.enterprise?.id === enterpriseId)
                .map((project) => (
                  <ProjectProgressCard key={project.id} project={project} />
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function BoardRow({ item }: { item: Item }) {
  const { project, artifact } = item;
  const days = waitingDays(artifact.updatedAt);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">《{item.name}》</span>
          <span className="font-mono text-xs text-muted-foreground">{artifact.code}</span>
          <StatusBadge status={artifact.status} stale={artifact.stale} />
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {project.enterprise?.shortName ?? "—"} · {project.name}
          {project.projectRole ? ` · 我是${PROJECT_ROLE_LABELS[project.projectRole]}` : ""}
          {artifact.stale && artifact.staleReason ? ` · ${artifact.staleReason}` : ""}
        </div>
      </div>
      {days !== null ? (
        <Badge variant={days >= 3 ? "destructive" : "outline"} className="tabular-nums">
          {days === 0 ? "今天" : `已等 ${days} 天`}
        </Badge>
      ) : null}
      <Button size="sm" variant="outline" nativeButton={false} render={<Link to={workspacePath(project.id, artifact.code)} />}>
        去处理 <ArrowRight />
      </Button>
    </li>
  );
}

function ProjectProgressCard({ project }: { project: BoardProject }) {
  const byCode = new Map(project.artifacts.map((a) => [a.code, a]));
  return (
    <Link
      to={`/projects/${project.id}/overview`}
      className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:border-primary">
        <CardHeader>
          <CardDescription>
            {project.enterprise?.name ?? "—"}
            {project.enterprise?.status === "suspended" ? " · 已停用" : ""}
          </CardDescription>
          <CardTitle className="text-brand">{project.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {STAGES.map((s) => {
            const gate = stageGateCodes(s.key);
            const locked = gate.filter((code) => byCode.get(code)?.status === "locked").length;
            return (
              <div key={s.key} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {locked}/{gate.length} 定版
                  </span>
                </div>
                <Progress value={gate.length ? (locked / gate.length) * 100 : 0} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </Link>
  );
}
