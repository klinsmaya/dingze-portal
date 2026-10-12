import { ARTIFACTS, SERVICE_LABELS, STATUS_LABELS, type ServiceMode } from "@dingze/shared";
import { ArrowLeft, Bell, Building2, Download, Pencil, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { StatusDot } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/dingze/camp-import";
import { errorMessage } from "@/lib/dingze/errors";
import { type Camp, type CampProject, opsApi } from "@/lib/dingze/ops-api";
import { useCampDetail, useOpsMutation } from "@/lib/dingze/ops-queries";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

import { CampAccountsDialog, CampAttachDialog, CampEnrollDialog, CampFormDialog, type IssuedRow, IssuedListDialog } from "./components/camp-dialogs";
import { ConfirmAction } from "./components/confirm-action";
import { CAMP_STATUS_LABELS } from "./components/labels";
import { OpsPageHeader } from "./components/page-header";
import { StageBars } from "./components/stage-bars";

const TABS = ["prep", "site", "close"] as const;
type Tab = (typeof TABS)[number];

const ready = (p: CampProject) => p.startup.every((s) => s.state === "done");
const specId = (code: string) => ARTIFACTS.find((a) => a.code === code)?.specId ?? code;
const plain = (code: string) => ARTIFACTS.find((a) => a.code === code)?.plain ?? code;

export default function CampDetailPage() {
  const campId = Number(useParams().campId);
  const detail = useCampDetail(campId);
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "prep";
  const [editing, setEditing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [accountsFor, setAccountsFor] = useState<CampProject | null>(null);
  const [issued, setIssued] = useState<{ title: string; rows: IssuedRow[] } | null>(null);

  const back = (
    <Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link to="/ops/camps" />}>
      <ArrowLeft /> 训练营批次
    </Button>
  );
  if (detail.error)
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert variant="destructive">
          <AlertTitle>批次加载失败</AlertTitle>
          <AlertDescription>{errorMessage(detail.error)}</AlertDescription>
        </Alert>
      </div>
    );
  if (!detail.data) return <Skeleton className="h-64 rounded-xl" />;
  const { camp, projects } = detail.data;

  return (
    <div className="flex flex-col gap-5">
      {back}
      <OpsPageHeader
        title={camp.name}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={camp.status === "running" ? "default" : camp.status === "closed" ? "secondary" : "outline"}>{CAMP_STATUS_LABELS[camp.status]}</Badge>
            {[camp.startDate && `${camp.startDate}${camp.endDate ? ` ～ ${camp.endDate}` : ""}`, camp.location].filter(Boolean).join(" · ")}
          </span>
        }
        description={`${projects.length} 家企业项目 · 营前就绪 ${projects.filter(ready).length} 家`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> 编辑批次
            </Button>
            <Button variant="outline" onClick={() => setAttaching(true)} disabled={camp.status === "closed"}>
              <Plus /> 编入已有项目
            </Button>
            <Button onClick={() => setEnrolling(true)} disabled={camp.status === "closed"}>
              <Building2 /> 批量加企业
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setParams(v === "prep" ? {} : { tab: String(v) }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="prep">营前准备</TabsTrigger>
          <TabsTrigger value="site">现场看板</TabsTrigger>
          <TabsTrigger value="close">结营</TabsTrigger>
        </TabsList>
        <TabsContent value="prep" className="pt-3">
          <PrepTab camp={camp} projects={projects} onAccounts={setAccountsFor} />
        </TabsContent>
        <TabsContent value="site" className="pt-3">
          <SiteTab camp={camp} projects={projects} onEdit={() => setEditing(true)} />
        </TabsContent>
        <TabsContent value="close" className="pt-3">
          <CloseTab key={projects.map((p) => `${p.id}:${p.service}`).join(",")} camp={camp} projects={projects} />
        </TabsContent>
      </Tabs>

      {editing ? <CampFormDialog open camp={camp} onClose={() => setEditing(false)} /> : null}
      <CampEnrollDialog open={enrolling} onClose={() => setEnrolling(false)} camp={camp} onIssued={(rows) => setIssued({ title: "企业已开通", rows })} />
      <CampAttachDialog open={attaching} onClose={() => setAttaching(false)} camp={camp} />
      <CampAccountsDialog project={accountsFor} onClose={() => setAccountsFor(null)} onIssued={(rows) => setIssued({ title: "账号已开通", rows })} />
      <IssuedListDialog title={issued?.title ?? ""} rows={issued?.rows ?? null} onClose={() => setIssued(null)} />
    </div>
  );
}

function EmptyCamp() {
  return <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">这期还没有企业：点右上角「批量加企业」，或把已开通的项目编入本批次。</p>;
}

function PrepTab({ camp, projects, onAccounts }: { camp: Camp; projects: CampProject[]; onAccounts: (p: CampProject) => void }) {
  const remind = useOpsMutation(opsApi.campRemind);
  const notReady = projects.filter((p) => !ready(p));
  const send = (projectIds?: number[]) =>
    remind.mutate(
      { campId: camp.id, projectIds },
      {
        onSuccess: (r) => toast.success(r.sent ? `已提醒 ${r.sent} 家企业的项目负责人` : "没有需要提醒的项目（或项目还没有企业项目负责人）"),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  if (!projects.length) return <EmptyCamp />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>开营前每家企业要准备好三件事：组织与部门、资料与画像、项目团队。企业项目负责人在项目首页能看到同样的清单。</span>
        <Button size="sm" variant="outline" disabled={!notReady.length || remind.isPending} onClick={() => send()}>
          <Bell /> 提醒未就绪的 {notReady.length} 家
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>企业 · 项目</TableHead>
              <TableHead>组织与部门</TableHead>
              <TableHead>资料与画像</TableHead>
              <TableHead>项目团队</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.enterprise.shortName || p.enterprise.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.name} · 企业成员 {p.enterpriseMembers} 人{p.scene === "inhouse" ? " · 已转企业内训" : ""}
                  </div>
                </TableCell>
                {p.startup.map((s) => (
                  <TableCell key={s.key} className="max-w-56 align-top">
                    <Badge variant={s.state === "done" ? "secondary" : "outline"} className={cn(s.state !== "done" && "border-[color:var(--dz-warn)] text-[color:var(--dz-warn)]")}>
                      {s.state === "done" ? "已就绪" : s.state === "partial" ? "部分就绪" : "待准备"}
                    </Badge>
                    <div className="mt-1 text-xs whitespace-normal text-muted-foreground">{s.state === "done" ? s.detail : s.problems.join("；")}</div>
                  </TableCell>
                ))}
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => onAccounts(p)}>
                      <UserPlus /> 批量发账号
                    </Button>
                    <Button size="sm" variant="ghost" nativeButton={false} render={<Link to={`/ops/enterprises/${p.enterprise.id}`} />}>
                      组织与成员
                    </Button>
                    {!ready(p) ? (
                      <Button size="sm" variant="ghost" disabled={remind.isPending} onClick={() => send([p.id])} aria-label={`提醒 ${p.enterprise.shortName}`}>
                        <Bell />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function stuckBadges(p: CampProject) {
  return [
    { n: p.stuck.stepDone, label: "待复核提交" },
    { n: p.stuck.inReview, label: "待复核" },
    { n: p.stuck.pendingConfirm, label: "待确认" },
    { n: p.stuck.stale, label: "待更新" },
    { n: p.stuck.comments, label: "未解决批注" },
  ].filter((i) => i.n > 0);
}

function SiteTab({ camp, projects, onEdit }: { camp: Camp; projects: CampProject[]; onEdit: () => void }) {
  const focus = camp.focusCodes ?? [];
  if (!projects.length) return <EmptyCamp />;
  const doneCount = (code: string) => projects.filter((p) => ["step_done", "in_review", "pending_confirm", "locked"].includes(p.focus.find((f) => f.code === code)?.status ?? "")).length;
  return (
    <div className="flex flex-col gap-3">
      {focus.length ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">今日目标表：</span>
          {focus.map((code) => (
            <Badge key={code} variant="outline" className="font-normal">
              {specId(code)} {plain(code)} · 完成本步 {doneCount(code)}/{projects.length}
            </Badge>
          ))}
        </div>
      ) : (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            还没设今日目标表：设好后这里按表显示每家企业做到哪一步。
            <Button size="sm" variant="outline" onClick={onEdit}>
              设今日目标表
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>企业</TableHead>
              {focus.map((code) => (
                <TableHead key={code} title={plain(code)}>
                  {specId(code)}
                </TableHead>
              ))}
              <TableHead>卡在哪</TableHead>
              <TableHead>三阶段</TableHead>
              <TableHead>最近动作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => {
              const stuck = stuckBadges(p);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={`/projects/${p.id}`}>
                      {p.enterprise.shortName || p.enterprise.name}
                    </Link>
                  </TableCell>
                  {focus.map((code) => {
                    const status = p.focus.find((f) => f.code === code)?.status ?? "not_started";
                    return (
                      <TableCell key={code} className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <StatusDot status={status} />
                          {STATUS_LABELS[status]}
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    {stuck.length ? (
                      <div className="flex flex-wrap gap-1">
                        {stuck.map((i) => (
                          <Badge key={i.label} variant="outline" className="font-normal">
                            {i.label} {i.n}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StageBars stages={p.stages} />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatTime(p.lastActivityAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CloseTab({ camp, projects }: { camp: Camp; projects: CampProject[] }) {
  const [choice, setChoice] = useState<Record<number, ServiceMode>>(() => Object.fromEntries(projects.map((p) => [p.id, p.service])));
  const close = useOpsMutation(opsApi.campClose);
  if (!projects.length) return <EmptyCamp />;
  const summary = () =>
    downloadCsv(`${camp.name}-结营小结.csv`, [
      ["企业", "项目", ...projects[0].stages.map((s) => `${s.name}（已定版/P0）`), "已定版成果", "导出次数", "数字咨询师对话轮次", "最近动作", "结营后服务方式"],
      ...projects.map((p) => [
        p.enterprise.shortName || p.enterprise.name,
        p.name,
        ...p.stages.map((s) => `${s.locked}/${s.total}`),
        p.lockedTotal,
        p.exports,
        p.usage?.turns ?? 0,
        formatTime(p.lastActivityAt),
        SERVICE_LABELS[choice[p.id] ?? p.service],
      ]),
    ]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {camp.status === "closed"
            ? "本期已结营；项目已转为企业内训，企业照常登录继续做。"
            : "结营后每个项目转为企业内训：付费客户选陪跑（主咨询师继续复核），其他选自助（企业负责人自查复核后定版）。"}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={summary}>
            <Download /> 导出结营小结
          </Button>
          <ConfirmAction
            trigger={<Button size="sm" disabled={close.isPending}>{camp.status === "closed" ? "按当前选择更新" : "结营"}</Button>}
            title={camp.status === "closed" ? "更新服务方式" : `结营：${camp.name}`}
            description={`${projects.filter((p) => choice[p.id] === "guided").length} 个项目转为陪跑，${projects.filter((p) => choice[p.id] === "self").length} 个转为自助；企业侧数据和已定版成果都不变。`}
            confirmLabel="确定"
            onConfirm={() =>
              close.mutateAsync({ campId: camp.id, projects: projects.map((p) => ({ projectId: p.id, service: choice[p.id] ?? p.service })) }).then(
                (r) => toast.success(`已更新 ${r.updated} 个项目`),
                (error) => {
                  toast.error(errorMessage(error));
                  throw error;
                },
              )
            }
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>企业 · 项目</TableHead>
              <TableHead>三阶段</TableHead>
              <TableHead>已定版</TableHead>
              <TableHead>导出</TableHead>
              <TableHead>数字咨询师</TableHead>
              <TableHead>结营后</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.enterprise.shortName || p.enterprise.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.name}
                    {p.scene === "inhouse" ? ` · 企业内训 · ${SERVICE_LABELS[p.service]}` : ""}
                  </div>
                </TableCell>
                <TableCell>
                  <StageBars stages={p.stages} />
                </TableCell>
                <TableCell className="tabular-nums">{p.lockedTotal}</TableCell>
                <TableCell className="tabular-nums">{p.exports}</TableCell>
                <TableCell className="text-xs tabular-nums">{p.usage ? `${p.usage.turns} 轮` : "—"}</TableCell>
                <TableCell>
                  <NativeSelect size="sm" aria-label={`${p.enterprise.shortName} 结营后服务方式`} value={choice[p.id] ?? p.service} onChange={(e) => setChoice({ ...choice, [p.id]: e.target.value as ServiceMode })}>
                    <NativeSelectOption value="guided">{SERVICE_LABELS.guided}</NativeSelectOption>
                    <NativeSelectOption value="self">{SERVICE_LABELS.self}</NativeSelectOption>
                  </NativeSelect>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
