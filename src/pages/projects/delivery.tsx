import { FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "react-router";
import { useMemo } from "react";
import { toast } from "sonner";

import { ARTIFACTS, STAGES, STATUS_LABELS, type ScorecardSet, cardWeight, getArtifactDef } from "@dingze/shared";

import { StatusBadge } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import { artifactSheets } from "@/lib/dingze/export/sheets";
import { downloadXlsx } from "@/lib/dingze/export/xlsx";
import { formatTime } from "@/lib/dingze/records";
import { workspacePath } from "@/lib/dingze/progress";
import type { DeliveryArtifact } from "@/lib/dingze/records-api";
import { cn } from "@/lib/utils";
import { useDeliveryBundle, useRecordExport } from "@/lib/dingze/records-queries";

import { DiagramExportButton } from "./components/diagram-export";
import { ExportButton } from "./components/export-button";
import { PlanBookExportButton } from "./components/plan-book-export";
import { useProjectContext } from "./project-context";

const PLAN_BOOKS = ["S3-07", "S3-08"];

/** 交付：正式交付物（定版版本，未定版为草稿）、各部门绩效计分卡和导出记录。 */
export default function DeliveryPage({ embedded = false }: { embedded?: boolean }) {
  const { project } = useProjectContext();
  const bundle = useDeliveryBundle(project);
  const recordExport = useRecordExport(project);
  const enterprise = project.enterprise?.shortName ?? "企业";

  const { byCode, upstream } = useMemo(() => {
    const map = new Map<string, DeliveryArtifact>();
    const payloads: Record<string, unknown> = {};
    for (const a of bundle.data?.artifacts ?? []) {
      map.set(a.code, a);
      if (a.payload) payloads[a.code] = a.payload;
    }
    return { byCode: map, upstream: payloads };
  }, [bundle.data]);

  const deliverables = ARTIFACTS.filter((def) => {
    const a = byCode.get(def.code);
    if (!a?.payload || PLAN_BOOKS.includes(def.code)) return false;
    return artifactSheets(def.code, a.payload, upstream).length > 0;
  });

  const scorecards = byCode.get("S2-07");
  const cards = ((scorecards?.payload as ScorecardSet | undefined)?.cards ?? []).filter((c) => (c.items ?? []).length > 0);

  const exportCard = async (deptId: string) => {
    if (!scorecards) return;
    const set = scorecards.payload as ScorecardSet;
    const card = set.cards.find((c) => c.deptId === deptId);
    if (!card) return;
    const fileName = `${enterprise}-${card.deptName}-绩效计分卡-v${scorecards.rev}.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
    try {
      await downloadXlsx(
        fileName,
        {
          title: `《${card.deptName}绩效计分卡》`,
          subtitle: `${enterprise} · ${project.name} · ${STATUS_LABELS[scorecards.status]} v${scorecards.rev} · 导出于 ${formatTime(new Date().toISOString())}`,
          draft: !scorecards.locked,
        },
        artifactSheets("S2-07", { cards: [card] })
      );
      recordExport({ code: "S2-07", rev: scorecards.rev, format: "xlsx", fileName, draft: !scorecards.locked });
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    }
  };

  return (
    <div className={embedded ? "flex flex-col gap-6" : "mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6"}>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          {embedded ? null : <h1 className="font-heading text-2xl font-bold text-brand">导出</h1>}
          <p className="mt-1 text-sm text-muted-foreground">
            最终交付是年度经营计划书（Word）。没定版的内容导出时会标“草稿”，避免被当作定版件流转。
          </p>
        </div>
        {embedded ? null : (
          <Link to={`/projects/${project.id}/results`} className="ml-auto text-sm text-primary hover:underline">
            查看全部表的版本与修改记录 →
          </Link>
        )}
      </div>

      {bundle.error ? (
        <Alert variant="destructive">
          <AlertTitle>交付物加载失败</AlertTitle>
          <AlertDescription>{errorMessage(bundle.error)}</AlertDescription>
        </Alert>
      ) : bundle.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <section aria-labelledby="plan-books" className="flex flex-col gap-3">
            <h2 id="plan-books" className="sr-only">年度经营计划书</h2>
            {PLAN_BOOKS.map((code) => {
              const def = getArtifactDef(code);
              const a = byCode.get(code);
              return (
                <div key={code} className={cn("flex flex-wrap items-center gap-4 rounded-2xl border p-5", code === "S3-07" ? "border-primary bg-primary/5" : "bg-card")}>
                  <FileText className={cn("size-9 shrink-0", code === "S3-07" ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-56 flex-1">
                    <div className={cn("font-heading font-bold text-brand", code === "S3-07" ? "text-xl" : "text-base")}>{def.plain}</div>
                    <div className="text-xs text-muted-foreground">
                      {def.specId} · {def.name} ·{" "}
                      {a?.payload ? (a.locked ? `已定版 v${a.rev}` : `草稿 v${a.rev}（未定版）`) : "还没有开始写"}
                    </div>
                  </div>
                  {a?.payload ? (
                    <PlanBookExportButton
                      code={code}
                      payload={a.payload}
                      rev={a.rev}
                      status={a.locked ? "locked" : a.status}
                      enterprise={project.enterprise?.name ?? enterprise}
                      year={project.year}
                      upstream={upstream}
                      dirty={false}
                      onExported={recordExport}
                      variant={code === "S3-07" ? "default" : "outline"}
                      size={code === "S3-07" ? "lg" : "default"}
                      label={code === "S3-07" ? "下载计划书 Word" : "下载部门计划书 Word"}
                    />
                  ) : (
                    <Button variant="outline" nativeButton={false} render={<Link to={workspacePath(project.id, code)} />}>
                      去写计划书
                    </Button>
                  )}
                </div>
              );
            })}
          </section>

          <details className="group rounded-xl border bg-card" open={false}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
              其他表格与图片 <span className="font-normal text-muted-foreground">· 单张表的 Excel、战略图 PNG / SVG（次要，按需导出）</span>
            </summary>
          <section aria-labelledby="deliverables" className="flex flex-col gap-3 border-t p-4">
            <h2 id="deliverables" className="sr-only">
              其他表格
            </h2>
            {STAGES.map((stage) => {
              const items = deliverables.filter((d) => d.stage === stage.key);
              if (items.length === 0) return null;
              return (
                <div key={stage.key} className="overflow-hidden rounded-xl border bg-card">
                  <div className="bg-muted px-4 py-2 text-sm font-semibold">{stage.name}</div>
                  <ul>
                    {items.map((def) => {
                      const a = byCode.get(def.code)!;
                      return (
                        <li key={def.code} className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
                          <div className="min-w-56 flex-1">
                            <div className="font-medium">{def.plain}</div>
                            <div className="text-xs text-muted-foreground">
                              {def.specId} · {def.name} · {a.locked ? `定版 v${a.rev}` : `草稿 v${a.rev}`}
                            </div>
                          </div>
                          <StatusBadge status={a.status} />
                          <div className="flex gap-1">
                            <ExportButton
                              code={def.code}
                              name={def.name}
                              payload={a.payload}
                              rev={a.rev}
                              status={a.locked ? "locked" : a.status}
                              enterprise={enterprise}
                              projectName={project.name}
                              upstream={upstream}
                              dirty={false}
                              onExported={recordExport}
                              variant="ghost"
                              size="sm"
                              label="Excel"
                            />
                            <DiagramExportButton
                              code={def.code}
                              name={def.name}
                              payload={a.payload}
                              rev={a.rev}
                              status={a.locked ? "locked" : a.status}
                              enterprise={enterprise}
                              dirty={false}
                              onExported={recordExport}
                              variant="ghost"
                              size="sm"
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {deliverables.length === 0 ? <p className="text-sm text-muted-foreground">还没有可以导出的成果。</p> : null}
          </section>
          </details>

          <section aria-labelledby="scorecards" className="flex flex-col gap-3">
            <h2 id="scorecards" className="font-heading text-lg font-bold text-brand">
              各部门绩效计分卡
            </h2>
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">《绩效计分卡》还没有内容。</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {cards.map((card) => (
                  <Card key={card.deptId}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2">
                      <div>
                        <CardTitle>{card.deptName}</CardTitle>
                        <CardDescription>
                          {card.items.length} 项指标 · 权重合计 {cardWeight(card)}
                          {scorecards?.locked ? ` · 定版 v${scorecards.rev}` : " · 草稿"}
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => exportCard(card.deptId)}>
                        <FileSpreadsheet /> Excel
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-1 text-left font-semibold">衡量指标</th>
                            <th className="py-1 text-left font-semibold">保底</th>
                            <th className="py-1 text-left font-semibold">力争</th>
                            <th className="py-1 text-right font-semibold">权重</th>
                          </tr>
                        </thead>
                        <tbody>
                          {card.items.map((item) => (
                            <tr key={item.id} className="border-t">
                              <td className="py-1">{item.metric}</td>
                              <td className="py-1">{item.floor}</td>
                              <td className="py-1">{item.target}</td>
                              <td className="py-1 text-right tabular-nums">{item.weight ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="exports" className="flex flex-col gap-3">
            <h2 id="exports" className="font-heading text-lg font-bold text-brand">
              导出记录
            </h2>
            {(bundle.data?.exports ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有导出过。</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">时间</th>
                      <th className="px-3 py-2 text-left font-semibold">成果</th>
                      <th className="px-3 py-2 text-left font-semibold">文件</th>
                      <th className="px-3 py-2 text-left font-semibold">版本</th>
                      <th className="px-3 py-2 text-left font-semibold">导出人</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.data!.exports.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2 text-xs tabular-nums">{formatTime(e.at)}</td>
                        <td className="px-3 py-2">{getArtifactDef(e.code)?.name ?? e.code}</td>
                        <td className="px-3 py-2 text-xs break-all">{e.fileName}</td>
                        <td className="px-3 py-2 text-xs">
                          v{e.rev} {e.draft ? <Badge variant="outline">草稿</Badge> : <Badge variant="secondary">定版</Badge>}
                        </td>
                        <td className="px-3 py-2 text-xs">{e.by || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
