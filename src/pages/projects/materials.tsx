import { CheckCheck, ClipboardPaste, Download, Eye, FileCheck2, FileUp, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useGetIdentity } from "@refinedev/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
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
import { workspacePath } from "@/lib/dingze/progress";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

import { CoachPanel } from "./components/coach-panel";
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

/** 已确认成果: every table once 定版 is part of the enterprise's materials (资料分类“已确认成果”). */
function ConfirmedResults() {
  const { project, overview } = useProjectContext();
  const locked = overview.artifacts.filter((a) => a.status === "locked" && getArtifactDef(a.code).priority !== "method");
  return (
    <section aria-labelledby="confirmed" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="confirmed" className="font-heading text-lg font-bold text-brand">
          已确认成果
        </h2>
        <span className="text-xs text-muted-foreground">表一定版就出现在这里，数字咨询师和专家咨询都按定版内容引用；版本、对比和导出在</span>
        <Link to={`/projects/${project.id}/results`} className="text-xs text-primary hover:underline">
          「成果」
        </Link>
      </div>
      {locked.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">还没有定版的表。</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {locked.map((a) => {
            const def = getArtifactDef(a.code);
            return (
              <li key={a.code}>
                <Link to={workspacePath(project.id, a.code)} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary">
                  <FileCheck2 className="size-4 shrink-0 text-status-done-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{def.plain}</span>
                    <span className="block text-xs text-muted-foreground">
                      {def.specId} · 定版 v{a.currentRev}
                      {a.stale ? " · 上游已变更" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

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
export default function MaterialsPage() {
  // 从工作台“组织”“资料”等入口带锚点进来时，滚到对应一节。
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const timer = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    return () => window.clearTimeout(timer);
  }, [hash]);
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
  const latest = useRef({ items, baseRev, canEdit });
  latest.current = { items, baseRev, canEdit };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const tools = useMemo(
    () => [
      defineAIFrontendTool({
        name: PROPOSE_TOOL,
        title: "建议写入企业画像",
        description:
          "把整理出的画像条目写入企业画像。path 用 items.+ 新增（值为完整对象 {id, category: fact|assumption|unknown|todo, topic, content, source: 资料编号字符串或空, status: 'draft'}），或 items.<id>.content 修改。用户确认后才写入。",
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
          if (!latest.current.canEdit) return { status: "error", content: "当前用户不能修改企业画像。" };
          const changes = (args as { changes?: ProposedChange[] })?.changes;
          if (!Array.isArray(changes) || !changes.length) return { status: "error", content: "没有要写入的内容。" };
          try {
            const next = applyChanges({ items: latest.current.items }, changes).items.map((i) => ({ ...profileItem(), ...i, status: "draft" as const }));
            const result = await persistRef.current(next, latest.current.baseRev);
            toast.success("已按建议写入画像");
            return { status: "success", content: `已写入企业画像，共 ${result.items.length} 条。` };
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
    title: "资料与画像",
    kind: "record-detail",
    tools,
    getContext: () => ({
      projectId: project.id,
      projectName: project.name,
      enterprise: project.enterprise?.name,
      page: "资料与企业画像",
      guide: `先用 ${SEARCH_MATERIALS_TOOL} 查阅资料，再把能确认的写成“事实”，规划依赖但未验证的写成“假设”，不清楚的写成“未知”，需要企业补的写成“待补”；每条注明来源资料编号 source。`,
      materials: (materials.data ?? []).map((m) => ({ id: m.id, title: m.title, chars: m.chars })),
      profile: latest.current.items,
      userCanEdit: latest.current.canEdit,
      projectRole: role,
    }),
  });

  const materialList = materials.data ?? [];
  const sourceTitle = (source: string) => materialList.find((m) => String(m.id) === source)?.title;

  return (
    <AIPageContextScope context={page.context}>
      <div className="flex flex-1 flex-wrap items-stretch">
        <main ref={page.ref} className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 p-4 md:p-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-brand">资料</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              填表前的准备与参考：资料库、组织与职责、企业画像。资料越全，数字咨询师起草越准、要企业补的“待补”越少；画像由咨询师复核、企业项目负责人确认。
            </p>
          </div>

          {materials.error || profile.error ? (
            <Alert variant="destructive">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{errorMessage(materials.error ?? profile.error)}</AlertDescription>
            </Alert>
          ) : null}

          <nav aria-label="本页目录" className="-mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {[
              ["#library", "资料库"],
              ["#confirmed", "已确认成果"],
              ["#org", "组织与职责"],
              ["#profile", "企业画像"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-primary hover:underline">
                {label}
              </a>
            ))}
          </nav>

          {materials.isLoading ? <Skeleton className="h-32" /> : <MaterialLibrary materials={materialList} canEdit={canEdit} canDeleteAny={isAdmin || role === "ent_lead" || role === "lead_consultant"} currentUserId={identity.data?.id ?? null} />}

          <ConfirmedResults />

          <OrgView orgUnits={overview.orgUnits ?? []} team={overview.team ?? []} />

          <section aria-labelledby="profile" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="profile" className="font-heading text-lg font-bold text-brand">
                企业画像
              </h2>
              {profile.data?.updatedAt ? (
                <span className="text-xs text-muted-foreground">
                  {profile.data.updatedBy} 更新于 {formatTime(profile.data.updatedAt)}
                </span>
              ) : null}
              {canEdit ? (
                <Button className="ml-auto" size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || save.isPending} onClick={onSave}>
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
        </main>
        <aside aria-label="数字咨询师" data-dingze-coach className="flex w-full flex-col gap-3 border-t bg-card p-4 lg:w-[400px] lg:border-t-0 lg:border-l">
          <p className="rounded-xl border border-book-border bg-book px-4 py-3 text-xs text-book-foreground">
            可以让数字咨询师“把资料整理成画像”：它会先查阅资料，再按事实 / 假设 / 未知 / 待补提出条目，你确认后写入。
          </p>
          <CoachPanel stage="strategy" chatId={`dingze-${project.id}-materials`} />
        </aside>
      </div>
    </AIPageContextScope>
  );
}
