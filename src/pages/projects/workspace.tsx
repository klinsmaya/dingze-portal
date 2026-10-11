import { ArrowRight, History, Lock, Redo2, Save, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { useGetIdentity } from "@refinedev/core";
import { toast } from "sonner";

import {
  type Actor,
  getArtifactDef,
  isArtifactCode,
  validateArtifact,
  ARTIFACTS,
  profileBrief,
} from "@dingze/shared";

import { useAIPageElementHandle } from "@/extensions/nocobase-ai/components";
import {
  AIPageContextScope,
  defineAIFrontendTool,
} from "@/extensions/nocobase-ai/providers";

import { StatusBadge } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { nextStep, workspacePath } from "@/lib/dingze/progress";
import { useArtifactDetail, useSaveArtifact, useUpstreamPayloads } from "@/lib/dingze/queries";
import { useComments } from "@/lib/dingze/comments-api";
import { SEARCH_MATERIALS_TOOL } from "@/lib/dingze/material-tools";
import { useProfile } from "@/lib/dingze/materials-api";
import { initHistory, recordDraft, redoDraft, undoDraft } from "@/lib/dingze/draft-history";
import { nextArtifact } from "@/lib/dingze/next-step";
import { useRecordExport } from "@/lib/dingze/records-queries";
import { cn } from "@/lib/utils";

import { EDITABLE_CODES, emptyPayload } from "@/lib/dingze/artifact-payloads";
import { type ProposedChange, applyChanges } from "@/lib/dingze/changes";
import { PROPOSE_TOOL } from "@/lib/dingze/coach";
import { errorMessage } from "@/lib/dingze/errors";

import { ArtifactActions, DissentList } from "./components/artifact-actions";
import { CoachPanel } from "./components/coach-panel";
import { DiagramExportButton } from "./components/diagram-export";
import { ExportButton } from "./components/export-button";
import { PlanBookExportButton } from "./components/plan-book-export";
import { StepBar } from "./components/step-bar";
import { ValidationBar } from "./components/validation-bar";
import { BookMethod } from "./components/book-method";
import { CommentMarkers, CommentsPanel } from "./components/comments-panel";
import { GuidanceGapButton } from "./components/guidance-gap-dialog";
import { ArtifactEditor } from "./editors/artifact-editor";
import { useProjectContext } from "./project-context";

const ENTERPRISE_ROLES = ["ent_lead", "dept_head", "member"];
const CONSULTANT_ROLES = ["lead_consultant", "co_consultant"];

export default function WorkspacePage() {
  const { project, overview } = useProjectContext();
  const params = useParams();

  if (!params.code) {
    const next = nextStep(overview.artifacts);
    return (
      <Navigate to={workspacePath(project.id, next?.code ?? "S1-01")} replace />
    );
  }
  // S2-03-T (定目标) was folded into S2-03's target zone to follow 附录 B.
  if (params.code === "S2-03-T") return <Navigate to={workspacePath(project.id, "S2-03")} replace />;
  if (!isArtifactCode(params.code)) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>没有这张成果表</AlertTitle>
          <AlertDescription>
            <Link to={workspacePath(project.id, "S1-01")} className="underline">
              回到第一张表
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return <Workspace key={params.code} code={params.code} />;
}

function Workspace({ code }: { code: string }) {
  const { project, overview } = useProjectContext();
  const def = getArtifactDef(code);
  const detail = useArtifactDetail(project, code);
  const save = useSaveArtifact(project, code);
  const upstream = useUpstreamPayloads(project, [...def.dependsOn, ...(def.reads ?? [])]).payloads;

  const artifact = detail.data?.artifact ?? null;
  const serverPayload =
    artifact?.currentVersion?.payload ?? emptyPayload(code, project);
  const serverRev = artifact?.currentRev ?? 0;
  const [history, setHistory] = useState(() => initHistory<unknown>(serverPayload));
  const draft = history.present;
  const setDraft = useCallback((next: unknown) => setHistory((h) => recordDraft(h, next, Date.now())), []);
  const resetDraft = useCallback((value: unknown) => setHistory(initHistory(value)), []);
  const undo = useCallback(() => setHistory((h) => undoDraft(h)), []);
  const redo = useCallback(() => setHistory((h) => redoDraft(h)), []);
  const [baseRev, setBaseRev] = useState(serverRev);
  const dirty = JSON.stringify(draft) !== JSON.stringify(serverPayload);
  const recordExport = useRecordExport(project);
  const [searchParams] = useSearchParams();
  const highlightComment = Number(searchParams.get("comment")) || null;
  const [asideTab, setAsideTab] = useState<"coach" | "comments">(highlightComment ? "comments" : "coach");
  const [focusAnchor, setFocusAnchor] = useState<string | null>(null);
  const identity = useGetIdentity<{ id: number }>();
  const comments = useComments(project, code);
  const openThreads = (comments.data ?? []).filter((t) => !t.resolved);

  // Adopt the server version when it changes and nothing local is pending.
  useEffect(() => {
    if (!dirty || serverRev !== baseRev) {
      resetDraft(serverPayload);
      setBaseRev(serverRev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRev, detail.dataUpdatedAt]);

  // Unsaved edits: warn on reload and on in-app links (step bar, project tabs, notifications).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const guard = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const to = new URL(link.href, window.location.href);
      if (to.origin !== window.location.origin || to.pathname === window.location.pathname) return;
      if (!window.confirm("这张表有未保存的修改，离开后会丢失。确定离开？")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [dirty]);

  const issues = useMemo(
    () => (draft ? validateArtifact(code, draft, upstream) : []),
    [code, draft, upstream],
  );
  const blocking = issues.filter((i) => i.level === "error").length;

  const role = overview.projectRole;
  const actor: Actor = {
    projectRole: role,
    isConsultAdmin: overview.isConsultAdmin,
  };
  const status = artifact?.status ?? "not_started";
  const unlocked = detail.data?.unlock.unlocked ?? false;
  const canEditRole =
    !!role &&
    (ENTERPRISE_ROLES.includes(role) || CONSULTANT_ROLES.includes(role));
  const consultantInReview =
    status === "in_review" && !!role && CONSULTANT_ROLES.includes(role);
  const readOnly =
    !canEditRole ||
    !unlocked ||
    status === "locked" ||
    status === "archived" ||
    (status === "in_review" && !consultantInReview);

  const onSave = () =>
    save.mutate(
      { payload: draft, baseRev },
      {
        onSuccess: (result) => {
          setBaseRev(result.rev);
          toast.success(`已保存 v${result.rev}`);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  const canSave = !readOnly && EDITABLE_CODES.has(code);
  const saveShortcut = useRef(onSave);
  saveShortcut.current = onSave;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (canSave && dirty && !save.isPending) saveShortcut.current();
        return;
      }
      // Undo / redo of the table; the chat box keeps its own text undo.
      if (!canSave || (event.target as HTMLElement | null)?.closest?.("[data-dingze-coach]")) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSave, dirty, save.isPending, undo, redo]);
  const next = useMemo(() => nextArtifact(code, overview.artifacts), [code, overview.artifacts]);

  // The digital consultant reads the live draft and proposes changes through a frontend
  // tool; the change is written (as an AI-suggested version) only after the user approves.
  const latest = useRef({
    draft,
    baseRev,
    readOnly,
    editable: EDITABLE_CODES.has(code),
  });
  latest.current = {
    draft,
    baseRev,
    readOnly,
    editable: EDITABLE_CODES.has(code),
  };
  const profile = useProfile(project);
  const saveRef = useRef(save.mutateAsync);
  saveRef.current = save.mutateAsync;
  const tools = useMemo(
    () => [
      defineAIFrontendTool({
        name: PROPOSE_TOOL,
        title: "建议写入成果表",
        description:
          "把与用户在对话中达成一致的内容写入当前成果表。每条 change 的 path 用点号分隔，数组条目用 id 定位，追加用 +（如 goals.y3、battlefields.b1.mustWin、battlefields.+）；label 是给用户看的格子名称。用户确认后才会写入。",
        permission: "ASK",
        inputSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "一句话说明这次建议写入什么",
            },
            changes: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  label: { type: "string" },
                  value: {},
                },
                required: ["path", "label", "value"],
              },
            },
          },
          required: ["summary", "changes"],
        },
        execute: async (args: unknown) => {
          const {
            draft: current,
            baseRev: rev,
            readOnly: locked,
            editable,
          } = latest.current;
          if (!editable)
            return {
              status: "error",
              content: "这张表的编辑器尚未上线，请让用户在线下记录。",
            };
          if (locked)
            return {
              status: "error",
              content: "当前用户不能修改这张表（未解锁、已定版或在复核中）。",
            };
          const changes = (args as { changes?: ProposedChange[] })?.changes;
          if (!Array.isArray(changes) || changes.length === 0)
            return { status: "error", content: "没有要写入的内容。" };
          try {
            const next = applyChanges(current, changes);
            const result = await saveRef.current({
              payload: next,
              baseRev: rev,
              aiSuggested: true,
            });
            setDraft(next);
            setBaseRev(result.rev);
            toast.success(`已按建议写入 v${result.rev}`);
            return {
              status: "success",
              content: `已写入成果表，当前版本 v${result.rev}。`,
            };
          } catch (error) {
            return { status: "error", content: errorMessage(error) };
          }
        },
      }),
    ],
    [],
  );
  const page = useAIPageElementHandle({
    id: `dingze-artifact-${code}`,
    title: `《${def.name}》`,
    kind: "record-detail",
    tools,
    getContext: () => ({
      projectId: project.id,
      projectName: project.name,
      enterprise: project.enterprise?.name,
      primaryExpression: project.primaryExpression,
      artifact: {
        code,
        name: def.name,
        stage: def.stage,
        task: def.task,
        step: def.step,
        bookRef: def.bookRef,
      },
      status,
      currentRev: latest.current.baseRev,
      userCanEdit: !latest.current.readOnly && latest.current.editable,
      projectRole: role,
      draft: latest.current.draft,
      issues: latest.current.draft
        ? validateArtifact(code, latest.current.draft, upstream)
        : [],
      enterpriseProfile: profileBrief(profile.data) || "（企业画像还没有内容）",
      materialsHint: `起草或核对数字时可用 ${SEARCH_MATERIALS_TOOL} 查阅企业资料`,
    }),
  });

  return (
    <AIPageContextScope context={page.context}>
      <div className="flex flex-1 flex-wrap items-stretch">
        <aside className="w-full border-b bg-card md:w-[300px] md:border-r md:border-b-0">
          <details className="md:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm">
              <span className="text-muted-foreground">步骤</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{def.specId} {def.name}</span>
              <span className="text-xs text-muted-foreground">展开 ▾</span>
            </summary>
            <div className="px-4 pb-4">
              <StepBar projectId={project.id} artifacts={overview.artifacts} stage={def.stage} activeCode={code} />
            </div>
          </details>
          <div className="hidden p-4 md:block">
            <StepBar projectId={project.id} artifacts={overview.artifacts} stage={def.stage} activeCode={code} />
          </div>
        </aside>

        <main
          ref={page.ref}
          data-dingze-main
          onFocusCapture={(event) => {
            const anchor = (event.target as HTMLElement).closest?.("[data-anchor]")?.getAttribute("data-anchor");
            if (anchor) setFocusAnchor(anchor);
          }}
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-4 md:p-6"
        >
          <div className="sticky top-0 z-20 -mx-4 -mt-4 flex flex-col gap-1 border-b bg-background/95 px-4 pt-3 pb-3 backdrop-blur md:-mx-6 md:-mt-6 md:px-6 md:pt-4">
          <div className="text-xs text-muted-foreground">
            {def.task} › {def.step}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-heading text-2xl font-bold text-brand">
              《{def.name}》
            </h1>
            <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
              {def.specId} · {def.bookRef}
            </span>
            {artifact ? (
              <StatusBadge status={status} stale={artifact.stale} />
            ) : null}
            {artifact?.currentRev ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <History className="size-3.5" /> 当前 v{artifact.currentRev}
                {artifact.lockedVersion
                  ? ` · 定版 v${artifact.lockedVersion.rev}`
                  : ""}
              </span>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <ExportButton
                code={code}
                name={def.name}
                payload={artifact?.currentVersion?.payload}
                rev={artifact?.currentRev ?? 0}
                status={status}
                enterprise={project.enterprise?.shortName ?? "企业"}
                projectName={project.name}
                upstream={upstream}
                dirty={dirty}
                onExported={recordExport}
              />
              <DiagramExportButton
                code={code}
                name={def.name}
                payload={artifact?.currentVersion?.payload}
                rev={artifact?.currentRev ?? 0}
                status={status}
                enterprise={project.enterprise?.shortName ?? "企业"}
                dirty={dirty}
                onExported={recordExport}
              />
              <PlanBookExportButton
                code={code}
                payload={artifact?.currentVersion?.payload}
                rev={artifact?.currentRev ?? 0}
                status={status}
                enterprise={project.enterprise?.name ?? "企业"}
                year={project.year}
                upstream={upstream}
                dirty={dirty}
                onExported={recordExport}
              />
              {canSave ? (
                <div className="flex">
                  <Button variant="ghost" size="icon" aria-label="撤销" title="撤销（Ctrl / ⌘ + Z）" disabled={!history.past.length} onClick={undo}>
                    <Undo2 />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="重做" title="重做（Ctrl / ⌘ + Shift + Z）" disabled={!history.future.length} onClick={redo}>
                    <Redo2 />
                  </Button>
                </div>
              ) : null}
              {canSave ? (
                <Button
                  variant={dirty ? "default" : "outline"}
                  onClick={onSave}
                  disabled={!dirty || save.isPending}
                  title="Ctrl / ⌘ + S"
                >
                  <Save /> {save.isPending ? "保存中…" : dirty ? "保存" : "已保存"}
                </Button>
              ) : null}
              {detail.data ? (
                <ArtifactActions
                  project={project}
                  code={code}
                  title={def.name}
                  detail={detail.data}
                  actor={actor}
                  dirty={dirty}
                  blocking={blocking}
                />
              ) : null}
            </div>
          </div>
          </div>

          {detail.isLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : detail.error ? (
            <Alert variant="destructive">
              <AlertTitle>成果加载失败</AlertTitle>
              <AlertDescription>{errorMessage(detail.error)}</AlertDescription>
            </Alert>
          ) : !unlocked ? (
            <Alert>
              <Lock />
              <AlertTitle>这一步还没解锁</AlertTitle>
              <AlertDescription className="flex flex-col gap-1">
                <span>{detail.data?.unlock.waitingFor}</span>
                <span className="flex flex-wrap gap-x-3">
                  {def.unlockAfter
                    .filter((c) => !["step_done", "in_review", "pending_confirm", "locked"].includes(overview.artifacts.find((a) => a.code === c)?.status ?? ""))
                    .map((c) => (
                      <Link key={c} to={workspacePath(project.id, c)} className="inline-flex items-center gap-1 font-medium text-brand underline">
                        去做 {getArtifactDef(c).specId} 《{getArtifactDef(c).name}》 <ArrowRight className="size-3.5" />
                      </Link>
                    ))}
                </span>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {artifact?.stale ? (
                <Alert className="border-destructive/30 bg-status-stale text-status-stale-foreground">
                  <AlertTitle>上游已变更</AlertTitle>
                  <AlertDescription className="text-status-stale-foreground">
                    {artifact.staleReason}
                    。核对后保存一次，即视为已按新版本更新。
                  </AlertDescription>
                </Alert>
              ) : null}
              {status === "locked" ? (
                <Alert className="border-brand bg-brand text-brand-foreground">
                  <Lock />
                  <AlertTitle>
                    已定版 v{artifact?.lockedVersion?.rev}
                  </AlertTitle>
                  <AlertDescription className="text-brand-foreground/85">
                    只读。修改需由主咨询师解锁重开，下游会标“上游已变更”。
                  </AlertDescription>
                </Alert>
              ) : status === "pending_confirm" && !readOnly ? (
                <Alert>
                  <AlertTitle>正在等企业确认</AlertTitle>
                  <AlertDescription>
                    现在修改会生成新版本，需要重新提交复核。
                  </AlertDescription>
                </Alert>
              ) : null}
              {["step_done", "in_review", "pending_confirm", "locked"].includes(status) ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-4 py-2 text-sm">
                  {next ? (
                    <>
                      <span className="text-muted-foreground">这一步{status === "locked" ? "已定版" : "已交出去"}，可以接着做：</span>
                      <Link to={workspacePath(project.id, next.code)} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                        {next.specId} 《{next.name}》 <ArrowRight className="size-4" />
                      </Link>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {ARTIFACTS.filter((a) => a.priority === "P0").every((a) => overview.artifacts.find((x) => x.code === a.code)?.status === "locked") ? (
                        <>
                          全部 P0 成果都已定版，可以到
                          <Link to={`/projects/${project.id}/delivery`} className="mx-1 font-semibold text-brand underline">
                            交付
                          </Link>
                          页导出正式交付物。
                        </>
                      ) : (
                        "本阶段已解锁的表都做完了；下一阶段在本阶段 P0 全部定版后开启。"
                      )}
                    </span>
                  )}
                </div>
              ) : null}

              {EDITABLE_CODES.has(code) ? (
                <ArtifactEditor
                  code={code}
                  value={draft}
                  onChange={setDraft}
                  readOnly={readOnly}
                  issues={issues}
                  upstream={upstream}
                  projectYear={project.year}
                  keyProjectLevel={project.keyProjectLevel}
                  orgUnits={overview.orgUnits ?? []}
                  team={overview.team ?? []}
                  scheduleScale={project.scheduleScale}
                  enterprise={project.enterprise?.name ?? "企业"}
                />
              ) : (
                <Alert>
                  <AlertTitle>这张表暂无在线编辑器</AlertTitle>
                  <AlertDescription>请按方法手册在线下完成，成果以附件形式由咨询师归档。</AlertDescription>
                </Alert>
              )}

              {EDITABLE_CODES.has(code) ? (
                <ValidationBar issues={issues} hasRules />
              ) : null}
              {detail.data &&
              (status === "pending_confirm" ||
                status === "locked" ||
                detail.data.dissents.length > 0) ? (
                <DissentList
                  detail={detail.data}
                  project={project}
                  code={code}
                />
              ) : null}
            </>
          )}
        </main>

        <aside
          aria-label="数字咨询师"
          data-dingze-coach
          className="flex w-full flex-col gap-3 border-t bg-card p-4 lg:w-[400px] lg:border-t-0 lg:border-l"
        >
          <details className="rounded-xl border border-book-border bg-book px-4 py-3 text-sm text-book-foreground">
            <summary className="cursor-pointer font-heading text-base font-bold">
              书中方法
            </summary>
            <BookMethod def={def} />
          </details>
          <div role="tablist" aria-label="右侧面板" className="flex gap-0.5 rounded-xl bg-muted p-1 text-sm">
            {(
              [
                ["coach", "数字咨询师"],
                ["comments", `批注${openThreads.length ? ` · ${openThreads.length}` : ""}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={asideTab === key}
                onClick={() => setAsideTab(key)}
                className={cn("flex min-h-9 flex-1 items-center justify-center rounded-lg", asideTab === key ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={cn("flex flex-1 flex-col", asideTab !== "coach" && "hidden")}>
            <CoachPanel
              stage={def.stage}
              chatId={`dingze-${project.id}-${code}`}
            />
            {overview.isConsultAdmin || (!!role && CONSULTANT_ROLES.includes(role)) ? (
              <GuidanceGapButton project={project} code={code} artifactName={def.name} />
            ) : null}
          </div>
          <div className={cn(asideTab !== "comments" && "hidden")}>
            <CommentsPanel
              project={project}
              code={code}
              payload={draft}
              team={overview.team ?? []}
              canComment={overview.isConsultAdmin || (!!role && role !== "readonly")}
              canResolveAny={overview.isConsultAdmin || role === "ent_lead" || role === "lead_consultant"}
              currentUserId={identity.data?.id ?? null}
              focusAnchor={focusAnchor}
              highlightId={highlightComment}
            />
          </div>
          <CommentMarkers anchors={openThreads.map((t) => t.anchor).filter((a): a is string => !!a)} />
        </aside>
      </div>
    </AIPageContextScope>
  );
}
