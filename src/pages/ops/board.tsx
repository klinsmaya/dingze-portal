import { Activity, Bot, Building2, FolderKanban, MessageSquareText } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/dingze/errors";
import type { OpsBoardProject } from "@/lib/dingze/ops-api";
import { useCamps, useOpsBoard } from "@/lib/dingze/ops-queries";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./components/page-header";
import { StageBars } from "./components/stage-bars";

const number = new Intl.NumberFormat("zh-CN");

/** Tokens in 万 above ten thousand, so the columns stay narrow. */
function tokens(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : number.format(n);
}

function backlogCount(p: OpsBoardProject): number {
  return p.backlog.inReview + p.backlog.pendingConfirm + p.backlog.stale + p.backlog.comments;
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <div className="rounded-lg bg-brand/10 p-2 text-brand [&_svg]:size-4">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-heading text-2xl font-bold tabular-nums">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

function Backlog({ backlog }: { backlog: OpsBoardProject["backlog"] }) {
  const items = [
    { n: backlog.inReview, label: "待复核", tone: "border-gold text-brand" },
    { n: backlog.pendingConfirm, label: "待确认", tone: "border-brand text-brand" },
    { n: backlog.stale, label: "待更新", tone: "border-destructive text-destructive" },
    { n: backlog.comments, label: "未解决批注", tone: "" },
  ].filter((i) => i.n > 0);
  if (!items.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Badge key={i.label} variant="outline" className={cn("font-normal", i.tone)}>
          {i.label} {i.n}
        </Badge>
      ))}
    </div>
  );
}

export default function OpsBoardPage() {
  const board = useOpsBoard();
  const camps = useCamps();
  const [enterpriseId, setEnterpriseId] = useState("");
  const [campId, setCampId] = useState("");
  const [onlyBacklog, setOnlyBacklog] = useState(false);
  const enterprises = useMemo(() => new Map((board.data?.enterprises ?? []).map((e) => [e.id, e])), [board.data]);
  const projects = (board.data?.projects ?? []).filter((p) => (!enterpriseId || String(p.enterpriseId) === enterpriseId) && (!campId || String(p.campId ?? "") === campId) && (!onlyBacklog || backlogCount(p) > 0));

  const all = board.data?.projects ?? [];
  const turns30 = all.reduce((n, p) => n + (p.usage?.turns30 ?? 0), 0);
  const tokens30 = all.reduce((n, p) => n + (p.usage?.tokens30 ?? 0), 0);
  const backlogTotal = all.reduce((n, p) => n + backlogCount(p), 0);

  return (
    <div className="flex flex-col gap-6">
      <OpsPageHeader title="运营看板" description="各企业项目的阶段进度、待办积压与数字咨询师用量。用量只做记录，不计费。" />

      {board.error ? (
        <Alert variant="destructive">
          <AlertTitle>看板加载失败</AlertTitle>
          <AlertDescription>{errorMessage(board.error)}</AlertDescription>
        </Alert>
      ) : board.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={<Building2 />}
              label="企业"
              value={number.format(board.data?.enterprises.length ?? 0)}
              hint={`停用 ${board.data?.enterprises.filter((e) => e.status !== "active").length ?? 0} 家`}
            />
            <Stat icon={<FolderKanban />} label="项目" value={number.format(all.length)} hint={`已完成三阶段 ${all.filter((p) => p.stages.every((s) => s.total && s.locked === s.total)).length} 个`} />
            <Stat icon={<MessageSquareText />} label="待办积压" value={number.format(backlogTotal)} hint="待复核、待确认、待更新与未解决批注" />
            <Stat icon={<Bot />} label="数字咨询师 · 近 30 天" value={`${number.format(turns30)} 轮`} hint={`约 ${tokens(tokens30)} Token`} />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <NativeSelect size="sm" aria-label="按企业筛选" value={enterpriseId} onChange={(e) => setEnterpriseId(e.target.value)}>
              <NativeSelectOption value="">全部企业</NativeSelectOption>
              {(board.data?.enterprises ?? []).map((e) => (
                <NativeSelectOption key={e.id} value={String(e.id)}>
                  {e.shortName || e.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {camps.data?.length ? (
              <NativeSelect size="sm" aria-label="按训练营批次筛选" value={campId} onChange={(e) => setCampId(e.target.value)}>
                <NativeSelectOption value="">全部批次</NativeSelectOption>
                {camps.data.map((c) => (
                  <NativeSelectOption key={c.id} value={String(c.id)}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={onlyBacklog} onCheckedChange={setOnlyBacklog} />
              只看有待办的项目
            </label>
          </div>

          {projects.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Activity />
                </EmptyMedia>
                <EmptyTitle>{all.length ? "没有符合条件的项目" : "还没有项目"}</EmptyTitle>
                <EmptyDescription>{all.length ? "调整筛选条件看看。" : "在企业详情里创建项目后，这里会显示进度与用量。"}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>企业 / 项目</TableHead>
                    <TableHead>阶段进度（P0 定版）</TableHead>
                    <TableHead>待办</TableHead>
                    <TableHead className="text-right">咨询师 · 30 天</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">累计</TableHead>
                    <TableHead className="hidden md:table-cell">最近活动</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => {
                    const e = enterprises.get(p.enterpriseId);
                    const last = [p.lastActivityAt, p.usage?.lastAt].filter(Boolean).sort().pop() ?? null;
                    return (
                      <TableRow key={p.id} className="align-top">
                        <TableCell>
                          <Link to={`/ops/enterprises/${p.enterpriseId}`} className="text-xs text-muted-foreground hover:text-brand hover:underline">
                            {e ? e.shortName || e.name : `企业 #${p.enterpriseId}`}
                          </Link>
                          {e && e.status !== "active" ? (
                            <Badge variant="outline" className="ml-1 font-normal">
                              已停用
                            </Badge>
                          ) : null}
                          <div className="font-medium">
                            {p.name}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">{p.year}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StageBars stages={p.stages} />
                        </TableCell>
                        <TableCell>
                          <Backlog backlog={p.backlog} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.usage?.turns30 ? (
                            <>
                              <div>{number.format(p.usage.turns30)} 轮</div>
                              <div className="text-xs text-muted-foreground">{tokens(p.usage.tokens30)} Token</div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {p.usage ? (
                            <>
                              <div>{number.format(p.usage.turns)} 轮</div>
                              <div className="text-xs text-muted-foreground">
                                {tokens(p.usage.totalTokens)} Token · {p.usage.users} 人
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{formatTime(last)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            用量按数字咨询师对话所属项目统计（对话打开时的页面上下文），只计企业空间内三位数字咨询师；Token 数为模型返回的用量，仅供运营参考。
          </p>
        </>
      )}
    </div>
  );
}
