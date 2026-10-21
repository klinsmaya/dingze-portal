import { CheckCheck, ClipboardPaste, Download, Eye, FileCheck2, FileUp, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetIdentity } from "@refinedev/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
  PROFILE_CATEGORIES,
  PROFILE_STATUS_LABELS,
  type ProfileCategory,
  type ProfileItem,
  canSetProfileStatus,
  getArtifactDef,
  profileItem,
} from "@dingze/shared";

import { useAIPageElementHandle } from "@/extensions/nocobase-ai/components";
import { AIPageContextScope, defineAIFrontendTool } from "@/extensions/nocobase-ai/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { type ProposedChange, applyChanges } from "@/lib/dingze/changes";
import { PROPOSE_TOOL } from "@/lib/dingze/coach";
import { errorMessage } from "@/lib/dingze/errors";
import { MATERIAL_ACCEPT } from "@/lib/dingze/extract-text";
import { SEARCH_MATERIALS_TOOL } from "@/lib/dingze/material-tools";
import { type MaterialSummary, downloadOriginal, useAddMaterial, useDeleteMaterial, useMaterials, useProfile, useSaveProfile } from "@/lib/dingze/materials-api";
import { opsApi } from "@/lib/dingze/ops-api";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

import { OrgUnitsEditor } from "../ops/components/org-units-tab";
import { CoachPanel, askCoach } from "./components/coach-panel";
import { TextCell } from "./editors/kit";
import { MaterialViewer, useMaterialUpload } from "./components/material-shared";
import { OrgView } from "./components/org-view";
import { useProjectContext } from "./project-context";

const STATUS_TONE: Record<ProfileItem["status"], string> = {
  draft: "border-input text-muted-foreground",
  reviewed: "bg-status-review text-status-review-foreground",
  confirmed: "bg-status-locked text-status-locked-foreground",
};

function PasteDialog({ open, onClose, onSubmit, pending }: { open: boolean; onClose: () => void; onSubmit: (title: string, text: string) => void; pending: boolean }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>粘贴文字资料</DialogTitle>
          <DialogDescription>会议纪要、访谈记录、网页摘录等，粘贴后作为一份资料保存。</DialogDescription>
        </DialogHeader>
        <Input aria-label="资料标题" placeholder="标题，如“2025 年年终经营分析会纪要”" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea aria-label="资料内容" value={text} onChange={(e) => setText(e.target.value)} className="min-h-64" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!text.trim() || pending}
            onClick={() => {
              onSubmit(title.trim() || "文字资料", text);
              setTitle("");
              setText("");
            }}
          >
            保存资料
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 已确认成果：只放一张链接卡，成果的唯一入口在「成果」（开营前 UX 改版 M1、M2）。规格把它列为资料分类，数字咨询师仍按定版内容引用。 */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function MaterialLibrary({ materials, canEdit, canDeleteAny, currentUserId }: { materials: MaterialSummary[]; canEdit: boolean; canDeleteAny: boolean; currentUserId: number | null }) {
  const { project } = useProjectContext();
  const add = useAddMaterial(project);
  const remove = useDeleteMaterial(project);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const uploadFiles = useMaterialUpload();
  const upload = async (files: FileList | null) => {
    setBusy(true);
    await uploadFiles(files);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section aria-labelledby="library" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="library" className="font-heading text-lg font-bold text-brand">
          资料库
        </h2>
        <span className="text-xs text-muted-foreground">保存原件，并提取文字供数字咨询师检索、注明出处；只有本项目成员能查看和下载</span>
        {canEdit ? (
          <div className="ml-auto flex gap-2">
            <input ref={fileRef} type="file" multiple accept={MATERIAL_ACCEPT} className="hidden" onChange={(e) => upload(e.target.files)} />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <FileUp /> {busy ? "上传中…" : "上传原件"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPasting(true)}>
              <ClipboardPaste /> 粘贴文字
            </Button>
          </div>
        ) : null}
      </div>
      {materials.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          还没有资料。可上传原件：Word（docx）、PDF、Excel（xlsx、xls、xlsm、xlsb、ods）、txt、md、csv（不超过 20 MB）；也可以直接粘贴文字。
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
              <span className="w-10 text-xs text-muted-foreground tabular-nums">#{m.id}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{m.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.kind === "note" ? "粘贴的文字" : m.fileName}
                  {m.hasFile ? ` · 原件 ${formatSize(m.size)}` : ""} · {m.chars ? `可检索 ${m.chars} 字` : "无可检索文字"} · {m.by} · {formatTime(m.at)}
                </span>
              </span>
              {m.hasFile ? (
                <Button variant="ghost" size="sm" onClick={() => downloadOriginal(project, m).catch((e) => toast.error(errorMessage(e)))}>
                  <Download /> 原件
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" disabled={!m.chars} onClick={() => setViewing(m.id)}>
                <Eye /> 文字
              </Button>
              {canEdit && (canDeleteAny || m.byId === currentUserId) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`删除资料《${m.title}》？`)) remove.mutate(m.id, { onError: (e) => toast.error(errorMessage(e)) });
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <PasteDialog
        open={pasting}
        pending={add.isPending}
        onClose={() => setPasting(false)}
        onSubmit={(title, text) =>
          add.mutate(
            { title, kind: "note", text },
            {
              onSuccess: () => {
                setPasting(false);
                toast.success("资料已保存");
              },
              onError: (e) => toast.error(errorMessage(e)),
            }
          )
        }
      />
      <MaterialViewer id={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}

/** 资料与画像: the enterprise's materials and the profile (事实 / 假设 / 未知 / 待补) built from them. */
const MATERIAL_TABS = [
  ["profile", "① 企业画像"],
  ["org", "② 组织与职责"],
  ["library", "资料库"],
] as const;
type MaterialTab = (typeof MATERIAL_TABS)[number][0];

/** 让数字咨询师从资料库整理画像或组织架构：只出修改卡，确认后才写入。 */
const AI_ASK = {
  profile:
    "请先查阅资料库里的资料，把企业画像整理出来：能确认的写成“事实”，规划依赖但未验证的写成“假设”，不清楚的写成“未知”，需要企业补的写成“待补”，每条注明来源资料编号。已有的条目不要重复。整理好后给我修改卡确认。",
  org: "请先查阅资料库里的组织架构图、部门职责说明等资料，把本企业的组织架构整理出来：部门名称、上级、类型（公司 / 部门 / 团队）、负责人和主要职责。已有的同名部门只补缺的职责和负责人，资料里没有的部门不要编。整理好后给我修改卡确认。",
} as const;

function askAI(kind: keyof typeof AI_ASK) {
  document.querySelector("[data-dingze-coach]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  askCoach(AI_ASK[kind]);
}

/** ② 组织与职责：企业项目负责人、主咨询师在这里直接维护（企业级，对本企业所有项目生效）；其他人只读。 */
function OrgSection({ canEditOrg, onAI }: { canEditOrg: boolean; onAI: () => void }) {
  const { project, overview } = useProjectContext();
  const team = overview.team ?? [];
  if (!canEditOrg || !project.enterprise?.id) return <OrgView orgUnits={overview.orgUnits ?? []} team={team} />;
  const people = team.filter((m) => m.projectRole !== "lead_consultant" && m.projectRole !== "co_consultant").map((m) => ({ id: m.userId, name: m.nickname }));
  const unplaced = team.filter((m) => !m.orgUnitId && m.projectRole !== "lead_consultant" && m.projectRole !== "co_consultant");
  return (
    <section aria-labelledby="org" className="flex flex-col gap-3">
      <h2 id="org" className="font-heading text-lg font-bold text-brand">
        ② 组织与职责
      </h2>
      <OrgUnitsEditor
        scope={{ enterpriseId: project.enterprise.id, enterpriseName: project.enterprise.shortName, projectId: project.id }}
        orgUnits={overview.orgUnits ?? []}
        people={people}
        intro={
          <p className="min-w-60 flex-1 text-sm text-muted-foreground">
            部门、负责人和职责。责任分工矩阵、部门承接、部门计划书都会用到；组织是企业级的，改了对本企业所有项目生效，已定版的部门表只提示、不自动改。
          </p>
        }
        actions={
          <Button variant="outline" onClick={onAI} title="数字咨询师查阅资料库后提出组织部门，你确认后写入">
            <Sparkles /> 从资料整理组织架构
          </Button>
        }
        rowExtra={(unitId) => {
          const members = team.filter((m) => m.orgUnitId === unitId);
          return members.length ? <span className="text-xs text-muted-foreground">本项目成员：{members.map((m) => m.nickname).join("、")}</span> : null;
        }}
        footer={
          unplaced.length ? (
            <p className="text-xs text-[color:var(--dz-warn)]">还没归到部门的项目成员：{unplaced.map((m) => m.nickname).join("、")}（企业管理员在“本企业 › 组织部门”里设置所属部门）</p>
          ) : null
        }
      />
    </section>
  );
}

export default function MaterialsPage() {
  // 页签记在地址里（?tab=org），从左栏“组织与职责”“资料库”等带锚点（#org、#library）进来也打开对应页签。
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const fromHash = hash === "#org" ? "org" : hash === "#library" ? "library" : hash === "#profile" ? "profile" : null;
  const tab: MaterialTab = (MATERIAL_TABS.map(([k]) => k) as string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as MaterialTab) : (fromHash ?? "profile");
  const setTab = (next: MaterialTab) => setParams(next === "profile" ? {} : { tab: next }, { replace: true });
  const { project, overview } = useProjectContext();
  const materials = useMaterials(project);
  const profile = useProfile(project);
  const save = useSaveProfile(project);
  const role = overview.projectRole;
  const isAdmin = overview.isConsultAdmin;
  const canEdit = isAdmin || (!!role && role !== "readonly");
  const identity = useGetIdentity<{ id: number }>();

  const [items, setItems] = useState<ProfileItem[]>([]);
  const [baseRev, setBaseRev] = useState(0);
  const serverItems = profile.data?.items;
  const dirty = JSON.stringify(items) !== JSON.stringify(serverItems ?? []);
  useEffect(() => {
    if (!profile.data) return;
    if (!dirty || profile.data.rev !== baseRev) {
      setItems(profile.data.items);
      setBaseRev(profile.data.rev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data?.rev, profile.dataUpdatedAt]);

  const persist = (next: ProfileItem[], rev = baseRev) =>
    save.mutateAsync({ items: next, baseRev: rev }).then((result) => {
      setItems(result.items);
      setBaseRev(result.rev);
      return result;
    });
  const onSave = () => persist(items).then(() => toast.success("画像已保存"), (e) => toast.error(errorMessage(e)));
  const patch = (id: string, change: Partial<ProfileItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));

  // The digital consultant reads materials and proposes profile items through the same
  // path-based proposal tool as the workspace; nothing is written until the user approves.
  const canEditOrg = isAdmin || role === "ent_lead" || role === "lead_consultant";
  const client = useQueryClient();
  const latest = useRef({ items, baseRev, canEdit, canEditOrg, enterpriseId: project.enterprise?.id ?? 0 });
  latest.current = { items, baseRev, canEdit, canEditOrg, enterpriseId: project.enterprise?.id ?? 0 };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const tools = useMemo(
    () => [
      defineAIFrontendTool({
        name: PROPOSE_TOOL,
        title: "建议写入企业画像或组织架构",
        description:
          "把整理出的内容写入企业画像或组织架构，用户确认后才写入。企业画像：path 用 items.+ 新增（值为完整对象 {id, category: fact|assumption|unknown|todo, topic, content, source: 资料编号字符串或空, status: 'draft'}），或 items.<id>.content 修改。组织架构：path 用 org.+，值为 {name, parent?: 上级部门名称, kind?: company|department|team, head?: 负责人姓名, duty?: 职责}，上级排在下级前面；同名部门会更新。组织是企业级的，对本企业所有项目生效。",
        permission: "ASK",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            changes: { type: "array", minItems: 1, items: { type: "object", properties: { path: { type: "string" }, label: { type: "string" }, value: {} }, required: ["path", "label", "value"] } },
          },
          required: ["summary", "changes"],
        },
        execute: async (args: unknown) => {
          const changes = (args as { changes?: ProposedChange[] })?.changes;
          if (!Array.isArray(changes) || !changes.length) return { status: "error", content: "没有要写入的内容。" };
          const orgChanges = changes.filter((c) => c.path === "org.+" || c.path.startsWith("org."));
          const profileChanges = changes.filter((c) => !orgChanges.includes(c));
          const done: string[] = [];
          try {
            if (orgChanges.length) {
              if (!latest.current.canEditOrg) return { status: "error", content: "当前用户不能维护组织架构（由企业项目负责人、主咨询师或企业管理员维护）。" };
              const rows = orgChanges
                .map((c) => c.value as { name?: unknown; parent?: unknown; kind?: unknown; head?: unknown; duty?: unknown })
                .filter((v) => v && typeof v.name === "string" && v.name.trim())
                .map((v) => ({
                  name: String(v.name).trim(),
                  parent: typeof v.parent === "string" ? v.parent.trim() : undefined,
                  kind: ["company", "department", "team"].includes(String(v.kind)) ? String(v.kind) : "department",
                  head: typeof v.head === "string" ? v.head.trim() : undefined,
                  duty: typeof v.duty === "string" ? v.duty.trim() : undefined,
                }));
              if (!rows.length) return { status: "error", content: "组织部门缺少名称。" };
              const r = await opsApi.importOrgUnits({ enterpriseId: latest.current.enterpriseId, projectId: project.id, rows });
              await client.invalidateQueries({ queryKey: ["dingze", "overview"] });
              done.push(`组织架构新增 ${r.created} 个、更新 ${r.updated} 个部门`);
            }
            if (profileChanges.length) {
              if (!latest.current.canEdit) return { status: "error", content: "当前用户不能修改企业画像。" };
              const next = applyChanges({ items: latest.current.items }, profileChanges).items.map((i) => ({ ...profileItem(), ...i, status: "draft" as const }));
              const result = await persistRef.current(next, latest.current.baseRev);
              done.push(`企业画像共 ${result.items.length} 条`);
            }
            toast.success(`已写入：${done.join("；")}`);
            return { status: "success", content: `已写入：${done.join("；")}。` };
          } catch (error) {
            return { status: "error", content: errorMessage(error) };
          }
        },
      }),
    ],
    []
  );
  const page = useAIPageElementHandle({
    id: `dingze-materials-${project.id}`,
    title: "资料",
    kind: "record-detail",
    tools,
    getContext: () => ({
      projectId: project.id,
      projectName: project.name,
      enterprise: project.enterprise?.name,
      page: "资料：企业画像与组织架构",
      guide: `先用 ${SEARCH_MATERIALS_TOOL} 查阅资料。企业画像：能确认的写成“事实”，规划依赖但未验证的写成“假设”，不清楚的写成“未知”，需要企业补的写成“待补”；每条注明来源资料编号 source。组织架构：从组织架构图、部门职责说明里整理部门名称、上级、类型、负责人和职责，用 org.+ 提出；已有的同名部门只补缺的职责和负责人，不要臆造资料里没有的部门。`,
      orgUnits: (overview.orgUnits ?? []).map((u) => ({ name: u.name, parent: overview.orgUnits?.find((p) => p.id === u.parentId)?.name ?? null, kind: u.kind, head: u.headName ?? null, duty: u.duty ?? null })),
      userCanEditOrg: latest.current.canEditOrg,
      materials: (materials.data ?? []).map((m) => ({ id: m.id, title: m.title, chars: m.chars })),
      profile: latest.current.items,
      userCanEdit: latest.current.canEdit,
      projectRole: role,
    }),
  });

  const materialList = materials.data ?? [];
  const lockedCount = overview.artifacts.filter((a) => a.status === "locked" && getArtifactDef(a.code).priority !== "method").length;
  const sourceTitle = (source: string) => materialList.find((m) => String(m.id) === source)?.title;

  return (
    <AIPageContextScope context={page.context}>
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <main ref={page.ref} className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          {/* 标题和页签固定在上面，内容区自己滚动（2026-10-16）。 */}
          <div className="shrink-0 border-b bg-background px-4 pt-4 md:px-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-heading text-2xl font-bold text-brand">资料</h1>
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                填表前先备好企业画像和组织架构：直接填，或先上传资料再让数字咨询师整理，你确认后才写入。
              </p>
            </div>
            <nav aria-label="资料页签" role="tablist" className="mt-3 -mb-px flex flex-wrap items-end gap-1 text-sm">
              {MATERIAL_TABS.map(([key, label]) => {
                const count = key === "profile" ? items.length : key === "org" ? (overview.orgUnits ?? []).length : materialList.length;
                const unit = key === "profile" ? "条" : key === "org" ? "个部门" : "份";
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 px-3 py-2",
                      tab === key ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                    <span className="text-xs font-normal text-muted-foreground">
                      {count} {unit}
                    </span>
                  </button>
                );
              })}
              <span className="ml-auto flex items-center gap-3 pb-2">
                {canEdit && tab !== "library" ? (
                  <button type="button" onClick={() => setTab("library")} className="flex items-center gap-1 text-primary hover:underline">
                    <FileUp className="size-3.5" /> 先上传资料
                  </button>
                ) : null}
                <Link to={`/projects/${project.id}/results`} className="flex items-center gap-1 text-primary hover:underline" title="表一定版就成为资料的一部分；查看、对比、下载在「成果」">
                  <FileCheck2 className="size-3.5" /> 已定版 {lockedCount} 张 →
                </Link>
              </span>
            </nav>
          </div>

          <div className="flex flex-col gap-6 p-4 md:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {materials.error || profile.error ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{errorMessage(materials.error ?? profile.error)}</AlertDescription>
            </Alert>
          ) : null}

          {tab === "profile" ? (
          <section aria-labelledby="profile" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="profile" className="font-heading text-lg font-bold text-brand">
                ① 企业画像
              </h2>
              {profile.data?.updatedAt ? (
                <span className="text-xs text-muted-foreground">
                  {profile.data.updatedBy} 更新于 {formatTime(profile.data.updatedAt)}
                </span>
              ) : null}
              {canEdit ? (
                <Button className="ml-auto" size="sm" variant="outline" onClick={() => askAI("profile")} title="数字咨询师查阅资料库后提出画像条目，你确认后写入">
                  <Sparkles /> 从资料整理画像
                </Button>
              ) : null}
              {canEdit ? (
                <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || save.isPending} onClick={onSave}>
                  <Save /> {dirty ? "保存画像" : "已保存"}
                </Button>
              ) : null}
            </div>
            {profile.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              PROFILE_CATEGORIES.map((category) => {
                const own = items.filter((i) => i.category === category.key);
                return (
                  <div key={category.key} className="overflow-hidden rounded-xl border bg-card">
                    <div className="flex items-center gap-2 bg-muted px-4 py-2">
                      <span className="font-semibold">{category.label}</span>
                      <span className="text-xs text-muted-foreground">{category.hint}</span>
                      <span className="text-xs text-muted-foreground">· {own.length} 条</span>
                      {canEdit ? (
                        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setItems((list) => [...list, profileItem({ category: category.key as ProfileCategory })])}>
                          ＋ 添加
                        </Button>
                      ) : null}
                    </div>
                    {own.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">暂无</p>
                    ) : (
                      <ul>
                        {own.map((item) => (
                          <li key={item.id} data-anchor={item.id} className="grid gap-2 border-t px-3 py-2 md:grid-cols-[10rem_1fr_11rem_auto]">
                            <TextCell label="主题" placeholder="主题，如“售气量”" value={item.topic} onChange={(topic) => patch(item.id, { topic })} readOnly={!canEdit} />
                            <TextCell label="内容" multiline placeholder="内容" value={item.content} onChange={(content) => patch(item.id, { content })} readOnly={!canEdit} />
                            <div className="flex flex-col gap-1">
                              <NativeSelect size="sm" aria-label="来源资料" value={item.source} disabled={!canEdit} onChange={(e) => patch(item.id, { source: e.target.value })}>
                                <NativeSelectOption value="">无来源</NativeSelectOption>
                                {materialList.map((m) => (
                                  <NativeSelectOption key={m.id} value={String(m.id)}>
                                    #{m.id} {m.title}
                                  </NativeSelectOption>
                                ))}
                              </NativeSelect>
                              {item.source && !sourceTitle(item.source) ? <span className="text-xs text-destructive">来源资料已删除</span> : null}
                              <Badge variant={item.status === "draft" ? "outline" : "default"} className={cn("w-fit", STATUS_TONE[item.status])}>{PROFILE_STATUS_LABELS[item.status]}</Badge>
                            </div>
                            <div className="flex flex-wrap items-start gap-1">
                              {canEdit && item.status === "draft" && canSetProfileStatus("reviewed", role, isAdmin) ? (
                                <Button variant="outline" size="sm" onClick={() => patch(item.id, { status: "reviewed" })}>
                                  <ShieldCheck /> 复核
                                </Button>
                              ) : null}
                              {canEdit && item.status !== "confirmed" && canSetProfileStatus("confirmed", role, isAdmin) ? (
                                <Button variant="outline" size="sm" onClick={() => patch(item.id, { status: "confirmed" })}>
                                  <CheckCheck /> 确认
                                </Button>
                              ) : null}
                              {canEdit ? (
                                <Button variant="ghost" size="sm" aria-label="删除" onClick={() => setItems((list) => list.filter((i) => i.id !== item.id))}>
                                  <Trash2 />
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </section>
          ) : null}

          {tab === "org" ? <OrgSection canEditOrg={canEditOrg} onAI={() => askAI("org")} /> : null}

          {tab === "library" ? (
            materials.isLoading ? <Skeleton className="h-32" /> : <MaterialLibrary materials={materialList} canEdit={canEdit} canDeleteAny={isAdmin || role === "ent_lead" || role === "lead_consultant"} currentUserId={identity.data?.id ?? null} />
          ) : null}
          </div>
        </main>
        {/* 和填写页一样：对话内容滚动，输入框固定在底部。 */}
        <aside aria-label="数字咨询师" data-dingze-coach className="flex h-[80svh] w-full flex-col border-t bg-card lg:h-auto lg:min-h-0 lg:w-[400px] lg:shrink-0 lg:border-t-0 lg:border-l">
          <p className="shrink-0 border-b px-3 py-2 text-[11px] text-muted-foreground">
            先把资料传进资料库，再让数字咨询师整理画像和组织架构；它会给修改卡，你确认后才写入。
          </p>
          <div className="flex min-h-0 flex-1 flex-col">
            <CoachPanel
              stage="strategy"
              chatId={`dingze-${project.id}-materials`}
              starters={[
                ["从资料整理企业画像", AI_ASK.profile],
                ["从资料整理组织架构", AI_ASK.org],
                ["资料库里有什么、还缺什么", "请看一下资料库里的资料各讲了什么，哪些对定战略、定目标、定行动有用，还缺哪些资料需要企业补。"],
              ]}
            />
          </div>
        </aside>
      </div>
    </AIPageContextScope>
  );
}
