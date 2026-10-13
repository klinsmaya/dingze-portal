import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { useGetIdentity } from "@refinedev/core";
import { toast } from "sonner";

import {
  type Actor,
  collaborationStatus,
  type DiffEntry,
  diffPayloads,
  getArtifactDef,
  isArtifactCode,
  validateArtifact,
  ARTIFACTS,
  STAGES,
  profileBrief,
  staleAdvice,
} from "@dingze/shared";

import { useAIPageElementHandle } from "@/extensions/nocobase-ai/components";
import {
  AIPageContextScope,
  defineAIFrontendTool,
} from "@/extensions/nocobase-ai/providers";

import { RegionErrorBoundary } from "@/components/dingze/region-error-boundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { nextStep, workspacePath } from "@/lib/dingze/progress";
import { useArtifactDetail, useDismissOrgNotice, useSaveArtifact, useUpstreamPayloads } from "@/lib/dingze/queries";
import { useComments } from "@/lib/dingze/comments-api";
import { SEARCH_MATERIALS_TOOL } from "@/lib/dingze/material-tools";
import { useMaterials, useProfile } from "@/lib/dingze/materials-api";
import { useAddComment } from "@/lib/dingze/comments-api";
import { type Command, type CommandMeta, appendCommand, buildCommand, preview, reapplyCommand, revertCommand, toSaved } from "@/lib/dingze/edit-log";
import { getVersionPayload } from "@/lib/dingze/records-api";
import { nextArtifact } from "@/lib/dingze/next-step";
import { useArtifactHistory, usePlanBookSources, useRecordExport } from "@/lib/dingze/records-queries";
import { formatTime } from "@/lib/dingze/records";
import { locateAnchor } from "@/lib/dingze/locate";
import { buildRoute, topbarItems } from "@/lib/dingze/route";
import { cn } from "@/lib/utils";

import { EDITABLE_CODES, emptyPayload } from "@/lib/dingze/artifact-payloads";
import { type ProposedChange, applyChanges } from "@/lib/dingze/changes";
import { workflowContext } from "@/lib/dingze/coach-context";
import { usePersistentFlag } from "@/lib/dingze/view-prefs";
import { PROPOSE_TOOL } from "@/lib/dingze/coach";
import { errorMessage } from "@/lib/dingze/errors";

import { ArtifactActions, DissentList } from "./components/artifact-actions";
import { CoachPanel } from "./components/coach-panel";
import { DiagramExportButton } from "./components/diagram-export";
import { CharterDocxButton } from "./components/charter-export";
import { ExportButton } from "./components/export-button";
import { PlanBookExportButton } from "./components/plan-book-export";
import { type RailLink, RouteRail } from "./components/route-rail";
import { ExportMenu, type HeaderState, PanelToggle, StructureToolbar, TitleRow, TopbarTitle, WhereRow, useMediaQuery } from "./components/workspace-chrome";
import { ValidationBar } from "./components/validation-bar";
import { BookMethod } from "./components/book-method";
import { ChangesPanel } from "./components/changes-panel";
import { AnchorMenu, type CommentDraft, CommentComposer, LassoBar, LassoOutlines } from "./components/comment-composer";
import { CommentsPanel, circled } from "./components/comments-panel";
import { MaterialViewer } from "./components/material-shared";
import { CommentPins, EditMarkers } from "./components/edit-markers";
import { type EditSession, EditSessionContext, type EditorChrome, type RevisionState, pathNamer } from "./components/edit-session";
import { ShortcutsDialog, StatusBar } from "./components/status-bar";
import { GuidanceGapButton } from "./components/guidance-gap-dialog";
import { ArtifactEditor } from "./editors/artifact-editor";
import { useProjectContext } from "./project-context";

type AsideTab = "coach" | "comments" | "changes" | "book";
type EditState = { payload: unknown; log: Command[]; redo: Command[]; saved: Command[] };
const freshEdit = (payload: unknown): EditState => ({ payload, log: [], redo: [], saved: [] });


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
  const { project, overview, topbar } = useProjectContext();
  const def = getArtifactDef(code);
  const detail = useArtifactDetail(project, code);
  const save = useSaveArtifact(project, code);
  const liveUpstream = useUpstreamPayloads(project, [...def.dependsOn, ...(def.reads ?? [])]).payloads;

  const artifact = detail.data?.artifact ?? null;
  // A locked plan book shows the tables as they were when it was locked, same as its Word file (验收 D01).
  const lockedPlanBook = (code === "S3-07" || code === "S3-08") && artifact?.status === "locked";
  const planSources = usePlanBookSources(project, code, lockedPlanBook);
  const upstream = lockedPlanBook && planSources.data ? planSources.data.payloads : liveUpstream;
  const serverPayload =
    artifact?.currentVersion?.payload ?? emptyPayload(code, project);
  const serverRev = artifact?.currentRev ?? 0;
  // The draft and its change log (design 10 §7): every edit is a command; undo / redo walk the
  // commands, and commands saved in this visit can still be undone (as a new 撤销 command).
  const [edit, setEdit] = useState<EditState>(() => freshEdit(serverPayload));
  const draft = edit.payload;
  const [baseRev, setBaseRev] = useState(serverRev);
  const dirty = JSON.stringify(draft) !== JSON.stringify(serverPayload);
  const [activeComment, setActiveComment] = useState<number | null>(null);
  const activeCommentRef = useRef(activeComment);
  activeCommentRef.current = activeComment;
  const nameOf = useMemo(() => pathNamer(draft), [draft]);
  const nameOfRef = useRef(nameOf);
  nameOfRef.current = nameOf;
  const commit = useCallback((next: unknown, meta: CommandMeta = {}) => {
    setEdit((e) => {
      if (Object.is(next, e.payload)) return e;
      const log = appendCommand(e.log, e.payload, next, { commentId: activeCommentRef.current, ...meta }, nameOfRef.current);
      return { ...e, payload: next, log, redo: [] };
    });
  }, []);
  // Plain fields (outside table rows) carry no data-anchor; the field being typed into learns its
  // path from the edit, so markers, comments and 定位 can find it afterwards.
  const editRef = useRef(edit);
  editRef.current = edit;
  const lastField = useRef<HTMLElement | null>(null);
  const pendingMeta = useRef<CommandMeta | null>(null);
  const setDraft = useCallback(
    (next: unknown) => {
      const meta = pendingMeta.current ?? {};
      pendingMeta.current = null;
      const field = lastField.current;
      if (field?.isConnected && !field.hasAttribute("data-anchor")) {
        const changes = diffPayloads(editRef.current.payload, next);
        if (changes.length === 1 && changes[0].kind !== "removed") field.setAttribute("data-anchor", changes[0].path);
      }
      commit(next, meta);
    },
    [commit],
  );
  const undo = useCallback(() => {
    setEdit((e) => {
      const last = e.log[e.log.length - 1];
      if (last) return { ...e, payload: revertCommand(e.payload, last), log: e.log.slice(0, -1), redo: [last, ...e.redo] };
      // Nothing unsaved: undo the latest command saved in this visit, as a new edit.
      const saved = e.saved[e.saved.length - 1];
      if (!saved) return e;
      const payload = revertCommand(e.payload, { ...saved, prev: undefined, next: undefined });
      const cmd = buildCommand(e.payload, payload, { via: "undo", label: `撤销：${saved.label}` });
      return cmd ? { ...e, payload, log: [cmd], saved: e.saved.slice(0, -1) } : { ...e, saved: e.saved.slice(0, -1) };
    });
  }, []);
  const redo = useCallback(() => {
    setEdit((e) => {
      const [first, ...rest] = e.redo;
      if (!first) return e;
      return { ...e, payload: reapplyCommand(e.payload, first), log: [...e.log, first], redo: rest };
    });
  }, []);
  const undoCommand = useCallback((command: Command) => {
    setEdit((e) => {
      const index = e.log.findIndex((c) => c.id === command.id);
      if (index < 0) return e;
      const isLast = index === e.log.length - 1;
      const payload = revertCommand(e.payload, isLast ? command : { ...command, prev: undefined, next: undefined });
      return { ...e, payload, log: e.log.filter((c) => c.id !== command.id), redo: isLast ? [command, ...e.redo] : [] };
    });
  }, []);
  const recordExport = useRecordExport(project);
  const [searchParams] = useSearchParams();
  const highlightComment = Number(searchParams.get("comment")) || null;
  const [asideTab, setAsideTab] = useState<AsideTab>(highlightComment ? "comments" : "coach");
  const [focusAnchor, setFocusAnchor] = useState<string | null>(null);
  const identity = useGetIdentity<{ id: number }>();
  const comments = useComments(project, code);
  const openThreads = (comments.data ?? []).filter((t) => !t.resolved);

  // Adopt the server version when it changes and nothing local is pending.
  useEffect(() => {
    if (!dirty || serverRev !== baseRev) {
      // Our own save keeps the commands saved in this visit undoable; anyone else's resets them.
      setEdit((e) => ({ ...freshEdit(serverPayload), saved: serverRev === baseRev ? e.saved : [] }));
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
  const service = (overview.project.service ?? project.service) === "self" ? "self" : "guided";
  const actor: Actor = {
    projectRole: role,
    isConsultAdmin: overview.isConsultAdmin,
    service,
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

  const addComment = useAddComment(project, code);
  const onSave = () => {
    const log = edit.log;
    save.mutate(
      { payload: draft, baseRev, changes: log.map(toSaved), aiSuggested: log.some((c) => c.via === "chat") || undefined },
      {
        onSuccess: (result) => {
          setBaseRev(result.rev);
          setEdit((e) => ({ ...e, log: [], redo: [], saved: [...e.saved, ...log].slice(-50) }));
          toast.success(`已保存 v${result.rev}`);
          // Edits made 按批注 answer their comment thread.
          const byComment = new Map<number, string[]>();
          for (const c of log) if (c.commentId) byComment.set(c.commentId, [...(byComment.get(c.commentId) ?? []), c.label]);
          for (const [id, labels] of byComment) {
            addComment.mutate({ parentId: id, content: `已按批注修改（v${result.rev}）：${labels.slice(0, 5).join("；")}${labels.length > 5 ? ` 等 ${labels.length} 处` : ""}`, mentions: [] });
          }
          if (byComment.size) setActiveComment(null);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };
  const canSave = !readOnly && EDITABLE_CODES.has(code);
  const saveShortcut = useRef(onSave);
  saveShortcut.current = onSave;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const lastAnchor = useRef<string | null>(null);
  const materialsQuery = useMaterials(project);
  const materialList = useMemo(() => [...(materialsQuery.data ?? [])].sort((a, b) => b.at.localeCompare(a.at)), [materialsQuery.data]);
  const [viewingMaterial, setViewingMaterial] = useState<number | null>(null);
  const allThreadsRef = useRef<{ id: number; author: string }[]>([]);
  const revisionRef = useRef<{ entries: DiffEntry[]; whoOf: (path: string) => string | undefined; stats: ReturnType<EditSession["revisionStats"]> } | null>(null);
  const revisionToggle = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest?.("input, textarea, select, [contenteditable=true]");
      if (event.key === "?" && !typing && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "e") {
        event.preventDefault();
        revisionToggle.current();
        return;
      }
      if (event.altKey && (key === "m" || event.code === "KeyM")) {
        event.preventDefault();
        const at = chromeRef.current?.tools?.selected ?? lastAnchor.current;
        openComposer.current(at ? [at] : []);
        return;
      }
      if (key === "s") {
        event.preventDefault();
        if (canSave && dirty && !save.isPending) saveShortcut.current();
        return;
      }
      // Undo / redo of the table; the chat box keeps its own text undo.
      if (!canSave || target?.closest?.("[data-dingze-coach]")) return;
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

  // ── Edit session shared with the right panel, the change cards and the canvas markers ──
  const historyQuery = useArtifactHistory(project, code);
  const versions = useMemo(
    () => (historyQuery.data?.versions ?? []).map((v) => ({ rev: v.rev, by: v.by, at: v.at, kind: v.kind })),
    [historyQuery.data],
  );
  const [revision, setRevision] = useState<RevisionState>({ on: false, baseRev: null, basePayload: undefined, baseLabel: "" });
  const [previewAnchors, setPreviewAnchors] = useState<string[]>([]);
  const [previewDraft, setPreviewDraft] = useState<EditSession["previewDraft"]>(null);
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  // 就地批注 (design 10 画面 5): the composer at the cell / node, its draft listed in the 批注 tab.
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null);
  const [anchorMenu, setAnchorMenu] = useState<{ x: number; y: number; anchor: string } | null>(null);
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const canComment = overview.isConsultAdmin || !!role;
  const openComposer = useRef<(anchors: string[]) => void>(() => {});
  const compareWith = useCallback(
    async (rev: number | null, on: boolean) => {
      const target = rev ?? versions[1]?.rev ?? versions[0]?.rev ?? null;
      if (!on || !target) {
        setRevision((r) => ({ ...r, on: false }));
        return;
      }
      const v = await getVersionPayload(project.id, project.spaceName, code, target);
      setRevision({ on: true, baseRev: target, basePayload: v.payload, baseLabel: `v${target} · ${v.by || "—"} ${formatTime(v.at)}` });
    },
    [code, project.id, project.spaceName, versions],
  );
  revisionToggle.current = () => {
    if (!versions.length) return void toast.info("还没有保存过的版本可以对比");
    setAsideTab("changes");
    compareWith(revision.baseRev, !revision.on).catch(() => toast.error("读取对比版本失败"));
  };
  // What the open editor puts in the header (views, title, toolbar); re-render when it changes.
  const chromeRef = useRef<EditorChrome | null>(null);
  const [, setChromeSig] = useState("");
  const validate = useCallback((payload: unknown) => (payload ? validateArtifact(code, payload, upstream) : []), [code, upstream]);
  const session: EditSession = useMemo(
    () => ({
      code,
      draft,
      readOnly: readOnly || !EDITABLE_CODES.has(code),
      issues,
      commit,
      log: edit.log,
      undoCommand,
      activeComment,
      setActiveComment,
      preview: previewAnchors,
      setPreview: setPreviewAnchors,
      previewDraft,
      setPreviewDraft,
      revisionCell: (key: string) => {
        const data = revisionRef.current;
        if (!data) return null;
        const [row, field] = key.split(".");
        const primary = !field || ["path", "name", "title", "task"].includes(field);
        const hit =
          data.entries.find((d) => (d.kind === "changed" || d.kind === "added") && (d.path === key || d.path.endsWith(`.${key}`))) ??
          (primary ? data.entries.find((d) => d.kind === "added" && (d.path === row || d.path.endsWith(`.${row}`))) : undefined);
        if (!hit) return null;
        return { kind: hit.kind === "added" ? "added" : "changed", before: hit.kind === "changed" ? preview(hit.before, 40) : undefined, by: data.whoOf(hit.path) };
      },
      revisionStats: () => revisionRef.current?.stats ?? null,
      commentInfo: (id: number) => {
        const i = allThreadsRef.current.findIndex((t) => t.id === id);
        return i < 0 ? null : { no: i + 1, author: allThreadsRef.current[i].author };
      },
      selecting,
      setSelecting: (on: boolean) => {
        setSelecting(on);
        if (on) setAsideTab("comments");
      },
      selection,
      toggleSelection: (anchor: string) => setSelection((sel) => (sel.includes(anchor) ? sel.filter((a) => a !== anchor) : [...sel, anchor])),
      clearSelection: () => setSelection([]),
      focusAnchor,
      revision,
      compareWith,
      versions,
      validate,
      nameOf,
      openPanel: setAsideTab,
      nextMeta: (meta: CommandMeta) => {
        pendingMeta.current = meta;
      },
      commentOn: (anchor: string) => {
        if (anchor) setFocusAnchor(anchor);
        openComposer.current(anchor ? [anchor] : []);
      },
      chrome: chromeRef,
      publishChrome: setChromeSig,
    }),
    [code, draft, readOnly, issues, commit, edit.log, undoCommand, activeComment, previewAnchors, previewDraft, selecting, selection, focusAnchor, revision, compareWith, versions, validate, nameOf],
  );

  // Canvas markers: 修订 against a chosen version, or just what changed since the last save.
  const marks = useMemo(() => {
    const entries = revision.on && revision.basePayload !== undefined ? diffPayloads(revision.basePayload, draft) : edit.log.flatMap((c) => c.changes);
    const before: Record<string, string> = {};
    if (revision.on) for (const d of entries) if (d.kind === "changed") before[d.path] = preview(d.before, 60);
    return {
      changed: entries.filter((d) => d.kind === "changed" && !d.path.endsWith("#order")).map((d) => d.path),
      added: entries.filter((d) => d.kind === "added").map((d) => d.path),
      before,
    };
  }, [revision, draft, edit.log]);
  // 修订: who changed each path since the compared version (saved versions, then this session's edits).
  const revisionData = useMemo(() => {
    if (!revision.on || revision.basePayload === undefined) return null;
    const entries = diffPayloads(revision.basePayload, draft);
    const by = new Map<string, string>();
    const later = (historyQuery.data?.versions ?? []).filter((v) => v.rev > (revision.baseRev ?? 0)).sort((a, b) => a.rev - b.rev);
    for (const v of later) for (const c of v.changes ?? []) for (const ch of c.changes) by.set(ch.path, c.by || v.by);
    for (const c of edit.log) for (const ch of c.changes) by.set(ch.path, c.by ?? "我");
    const whoOf = (path: string) => by.get(path) ?? [...by.entries()].find(([p]) => p.startsWith(`${path}.`) || path.startsWith(`${p}.`))?.[1];
    const rows = (kind: string) => entries.filter((d) => d.kind === kind && d.before !== null && typeof (d.before ?? d.after) === "object").length;
    return {
      entries,
      whoOf,
      stats: {
        label: revision.baseLabel.split(" · ")[0] || `v${revision.baseRev}`,
        changed: entries.filter((d) => d.kind === "changed").length,
        added: entries.filter((d) => d.kind === "added" && typeof d.after === "object").length,
        removed: rows("removed"),
        people: new Set(entries.map((d) => whoOf(d.path)).filter(Boolean)).size,
      },
    };
  }, [revision, draft, historyQuery.data, edit.log]);
  revisionRef.current = revisionData;
  lastAnchor.current = focusAnchor;
  openComposer.current = (anchors: string[]) => {
    if (!canComment) return void toast.info("你在这个项目里不能批注");
    const label = anchors.length > 1 ? `圈选 ${anchors.length} 处 · ${anchors.map((a) => nameOf(a)).join("、")}` : anchors.length ? nameOf(anchors[0]) || "这一处" : "整张表";
    setCommentDraft((d) => (d && d.anchors.join("|") === anchors.join("|") ? d : { anchors, label, text: "" }));
  };
  const allThreads = useMemo(() => [...(comments.data ?? [])].sort((a, b) => a.id - b.id), [comments.data]);
  allThreadsRef.current = allThreads;
  const numberOf = useCallback((id: number) => {
    const i = allThreads.findIndex((t) => t.id === id);
    return i < 0 ? null : i + 1;
  }, [allThreads]);
  const threadAnchors = (t: { anchor: string | null; anchors?: string[] }) => (t.anchors?.length ? t.anchors : t.anchor ? [t.anchor] : []);
  const pins = useMemo(
    () => allThreads.map((t, i) => ({ id: t.id, no: i + 1, anchors: threadAnchors(t), resolved: t.resolved, label: `${t.author}：${t.content.slice(0, 40)}` })).filter((p) => p.anchors.length),
    [allThreads],
  );

  // Deleting a row or node: offer an 8-second undo right where the user is looking.
  const toasted = useRef<string | null>(null);
  useEffect(() => {
    const last = edit.log[edit.log.length - 1];
    if (!last || toasted.current === last.id || last.via !== "structure") return;
    const removed = last.changes.filter((c) => c.kind === "removed" && c.before && typeof c.before === "object");
    if (!removed.length) return;
    toasted.current = last.id;
    const no = last.commentId ? numberOf(last.commentId) : null;
    toast(`已删除「${preview(removed[0].before, 24)}」${removed.length > 1 ? ` 等 ${removed.length} 项` : ""}`, {
      description: no ? `按批注 ${circled(no)} · 8 秒内可撤销，之后在“修改”里撤销` : "8 秒内可撤销，之后在“修改”里撤销",
      duration: 8000,
      action: { label: "撤销 Ctrl+Z", onClick: () => undoCommand(last) },
    });
  }, [edit.log, undoCommand, numberOf]);

  const progress = overview.artifacts.find((a) => a.code === code);
  const dismissOrg = useDismissOrgNotice(project, code);

  // 项目路线: where this table sits in the stage, and how far its sub-steps are.
  const routeCodes = def.stage === "goal" ? ["S2-01", "S2-03"] : def.stage === "strategy" ? ["S1-01"] : [];
  const routeUpstream = useUpstreamPayloads(project, routeCodes.filter((c) => c !== code)).payloads;
  const route = useMemo(
    () =>
      buildRoute(
        def.stage,
        overview.artifacts,
        { code, zone: searchParams.get("zone"), sub: Number(searchParams.get("sub")) || null },
        { ...routeUpstream, [code]: draft },
      ),
    [def.stage, overview.artifacts, code, searchParams, routeUpstream, draft],
  );
  const collab = progress ? collaborationStatus({ ...progress, unlocked }, role, service) : null;

  // The digital consultant reads the live draft and proposes changes through a frontend
  // tool; the change is written (as an AI-suggested version) only after the user approves.
  const latest = useRef({
    draft,
    baseRev,
    readOnly,
    editable: EDITABLE_CODES.has(code),
    commit,
  });
  latest.current = {
    draft,
    baseRev,
    readOnly,
    editable: EDITABLE_CODES.has(code),
    commit,
  };
  const profile = useProfile(project);
  const tools = useMemo(
    () => [
      defineAIFrontendTool({
        name: PROPOSE_TOOL,
        title: "建议写入成果表",
        description:
          "出一张修改卡：把与用户在对话中达成一致的内容写入当前成果表的草稿。每条 change 的 path 用点号分隔，数组条目用 id 定位，追加用 +（如 goals.y3、battlefields.b1.mustWin、nodes.+）；label 是给用户看的格子名称。调结构用 op：set（默认，改一格或追加一条）、remove（删掉 path 指向的一条，路径/WBS 里连同下级）、split（把一条拆成几条同级，value 是每条的字段列表，如 [{path, metric, value}, …]，原来的下级跟第一条）、move（value 为 {parentId, goalId}，整枝移到新上级，层级自动调整）。路径的指标值要让下级合计推得回上级。卡片会给用户看原值→新值→合计核对，并在导图/表格里用琥珀色虚线预览，用户确认后才写入草稿，用户保存后生效。不要改用户没同意改的格子；已有内容只能通过修改卡替换。",
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
                  op: { type: "string", enum: ["set", "remove", "split", "move"] },
                  value: {},
                },
                required: ["path", "label"],
              },
            },
          },
          required: ["summary", "changes"],
        },
        execute: async (args: unknown) => {
          const {
            draft: current,
            readOnly: locked,
            editable,
            commit: write,
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
            const summary = (args as { summary?: string })?.summary;
            write(next, { via: "chat", label: summary ? `数字咨询师：${summary}` : undefined });
            toast.success("已写入草稿，记得保存", { description: "在右侧“修改”里可以看到并撤销这条修改" });
            return {
              status: "success",
              content: "用户已确认，内容已写入草稿（尚未保存，用户保存后生效）。",
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
      workflow: workflowContext({
        status,
        lastEvent: progress?.lastEvent,
        stale: artifact?.stale,
        staleReason: artifact?.staleReason,
        currentRev: latest.current.baseRev,
        stepDoneRev: artifact?.stepDoneVersion?.rev ?? null,
        lockedRev: artifact?.lockedVersion?.rev ?? null,
        comments: comments.data,
      }),
      enterpriseProfile: profileBrief(profile.data) || "（企业画像还没有内容）",
      materialsHint: `起草或核对数字时可用 ${SEARCH_MATERIALS_TOOL} 查阅企业资料`,
    }),
  });

  // Sub-steps that are fields (六分法) jump to the field: ?field=strategicGoals.
  const field = searchParams.get("field");
  useEffect(() => {
    if (!field || !detail.data) return;
    const timer = window.setTimeout(() => locateAnchor(field), 150);
    return () => window.clearTimeout(timer);
  }, [field, detail.data]);

  // ── Shell (design 10): route rail · header + canvas + status bar · four-tab panel ──
  const narrowRail = useMediaQuery("(max-width: 1279px)");
  const narrowPanel = useMediaQuery("(max-width: 1099px)");
  const [railPref, setRailPref] = usePersistentFlag("dingze:rail-collapsed");
  const railCollapsed = railPref ?? narrowRail;
  const [panelPref, setPanelPref] = usePersistentFlag("dingze:panel-open");
  const panelOpen = panelPref ?? !narrowPanel;
  useEffect(() => {
    if (highlightComment && narrowPanel) setPanelPref(true);
  }, [highlightComment, narrowPanel]);
  const chrome = chromeRef.current;
  const isEnterprise = !!role && ENTERPRISE_ROLES.includes(role) && !overview.isConsultAdmin;
  const base = `/projects/${project.id}`;
  const railLinks: RailLink[] = isEnterprise || role === "readonly"
    ? [
        { to: `${base}/overview`, label: "今天要做的", icon: "today" },
        { to: `${base}/materials`, label: "资料", icon: "materials" },
        { to: `${base}/materials#org`, label: "组织", icon: "org" },
        { to: `${base}/results`, label: "成果", icon: "artifacts" },
      ]
    : [
        { to: `${base}/overview`, label: "工作台", icon: "today" },
        { to: `${base}/materials`, label: "资料", icon: "materials" },
        { to: `${base}/materials#org`, label: "组织", icon: "org" },
        { to: `${base}/results`, label: "成果", icon: "artifacts" },
        { to: `${base}/expert`, label: "专家", icon: "expert" },
      ];
  const stageLinks = STAGES.map((st) => {
    const first = ARTIFACTS.find((a) => a.stage === st.key && a.priority !== "method")!;
    return { key: st.key, to: workspacePath(project.id, first.code), open: !!overview.artifacts.find((a) => a.code === first.code)?.unlock.unlocked };
  });
  const currentSub = route.current?.subs.find((x) => x.current);
  const crumbs = [route.stageName, route.current?.label ?? def.step, ...(currentSub ? [currentSub.label] : [])];
  const returned = progress?.status === "in_progress" && progress.lastEvent && ["returnToEdit", "forceReturn"].includes(progress.lastEvent.action);
  const headerStates: HeaderState[] = [];
  if (returned) headerStates.push({ tone: "warn", text: "已退回", detail: progress?.lastEvent?.reason || "顾问退回了这张表，请按批注修改后重新提交。" });
  else if (status === "locked") headerStates.push({ tone: "done", text: `已定版 v${artifact?.lockedVersion?.rev ?? ""} · 只读`, detail: service === "self" ? "修改需由企业项目负责人解锁重开（写原因），下游会标“上游已变更”。" : "修改需由主咨询师解锁重开，下游会标“上游已变更”。", detailLabel: "说明" });
  else if (collab) headerStates.push({ tone: collab.tone === "act" ? "act" : collab.tone === "done" ? "done" : collab.tone === "warn" ? "warn" : "wait", text: collab.text });
  else if (status === "in_progress") headerStates.push({ tone: "act", text: isEnterprise ? "企业共创中" : "进行中" });
  if (artifact?.stale)
    headerStates.push({
      tone: "warn",
      text: "上游已变更",
      detail:
        status === "locked"
          ? `${artifact.staleReason ?? "引用的上游表改过了"}。${staleAdvice(status, actor.service)}；重开后核对并保存，再重新定版。在那之前，这张表和它的导出仍是原定版内容。`
          : `${artifact.staleReason ?? "引用的上游表改过了"}。核对后保存一次，即视为已按新版本更新。`,
    });
  if (status === "pending_confirm" && !readOnly) headerStates.push({ tone: "wait", text: "现在修改需重新复核" });
  // 组织已变更（闭环第二批）：定版的部门表保留当时的部门，由主咨询师判断是否重开。
  const canJudgeOrg = overview.isConsultAdmin || role === "lead_consultant" || (service === "self" && role === "ent_lead");
  if (progress?.orgNotice && status === "locked") {
    headerStates.push({
      tone: "warn",
      text: "组织已变更",
      detailLabel: "看变化",
      detail: `${progress.orgNotice}\n\n表里保留定版时的部门，不会自动改。${canJudgeOrg ? "需要按新组织调整就点“解锁重开”；不影响就点“不需要重开”。" : service === "self" ? "由企业项目负责人判断是否需要重开。" : "由主咨询师判断是否需要重开。"}`,
      actions: canJudgeOrg ? (
        <Button
          size="sm"
          variant="outline"
          disabled={dismissOrg.isPending}
          onClick={() => {
            const note = window.prompt("说明一下为什么不需要重开（会记在审计里，可留空）：", "组织变更不影响这张表已定版的内容");
            if (note === null) return;
            dismissOrg.mutate(note, { onSuccess: () => toast.success("已确认不需要重开"), onError: (e) => toast.error(errorMessage(e)) });
          }}
        >
          不需要重开
        </Button>
      ) : null,
    });
  }
  const unsaved = dirty ? Math.max(1, edit.log.length) : 0;
  const hints: [string, string][] = chrome?.tools
    ? [["Tab", "下级"], ["Enter", "同级"], ["F2", "编辑"], ["Ctrl+Alt+M", "批注"]]
    : [["Ctrl+S", "保存"], ["Ctrl+Z", "撤销"], ["Ctrl+Alt+M", "批注"]];

  const tabs: [AsideTab, string, number][] = [
    ["coach", "对话", 0],
    ["comments", "批注", openThreads.length],
    ["changes", "修改", edit.log.length],
    ["book", "书中方法", 0],
  ];

  return (
    <EditSessionContext.Provider value={session}>
    <AIPageContextScope context={page.context}>
      <TopbarTitle
        slot={topbar?.main ?? null}
        projectId={project.id}
        title={`${route.current?.short ?? def.plain} · ${project.name}`}
        subtitle={`${project.enterprise?.shortName ?? project.enterprise?.name ?? ""} › ${route.stageName}`}
        items={topbarItems(route)}
      />
      <PanelToggle slot={topbar?.actions ?? null} open={panelOpen} onToggle={() => setPanelPref(!panelOpen)} count={openThreads.length} />
      <div className="flex min-h-0 flex-1">
        <aside className={cn("shrink-0 border-r bg-card", railCollapsed ? "w-14" : "w-[248px]")}>
          <RouteRail
            projectId={project.id}
            route={route}
            stages={stageLinks}
            links={railLinks}
            collapsed={railCollapsed}
            onToggle={() => setRailPref(!railCollapsed)}
                materials={materialList}
                onOpenMaterial={setViewingMaterial}
              />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b bg-background px-4 pt-1.5 md:px-5">
            <WhereRow
              crumbs={crumbs}
              states={headerStates}
              savedAt={artifact?.currentVersion?.createdAt ?? null}
              rev={artifact?.currentRev ?? 0}
              unsaved={unsaved}
              saving={save.isPending}
              canSave={canSave}
              onSave={onSave}
            />
            <div className="py-1.5">
              <TitleRow
                title={chrome?.title ?? def.name}
                chip={chrome?.chip ?? `${def.specId} · ${def.bookRef}`}
                chrome={chrome}
                revisionOn={revision.on}
                canRevise={versions.length > 0}
                onRevision={() => revisionToggle.current()}
                openComments={openThreads.length}
                onComments={() => {
                  setPanelPref(true);
                  setAsideTab("comments");
                }}
                exportMenu={
                  <ExportMenu>
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
                      variant="ghost"
                    />
                    <CharterDocxButton
                      code={code}
                      payload={artifact?.currentVersion?.payload}
                      rev={artifact?.currentRev ?? 0}
                      status={status}
                      enterprise={project.enterprise?.name ?? "企业"}
                      projectName={project.name}
                      year={project.year}
                      dirty={dirty}
                      onExported={recordExport}
                      variant="ghost"
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
                      variant="ghost"
                    />
                    <PlanBookExportButton
                      code={code}
                      project={project}
                      rev={artifact?.currentRev ?? 0}
                      enterprise={project.enterprise?.name ?? "企业"}
                      year={project.year}
                      dirty={dirty}
                      onExported={recordExport}
                      variant="ghost"
                    />
                  </ExportMenu>
                }
                actions={
                  detail.data ? (
                    <ArtifactActions project={project} code={code} title={def.name} detail={detail.data} actor={actor} dirty={dirty} blocking={blocking} warnings={issues.filter((i) => i.level !== "error").map((i) => i.message)} openComments={openThreads.length} />
                  ) : null
                }
              />
            </div>
            {EDITABLE_CODES.has(code) && unlocked ? (
              <div className="-mx-4 border-t px-3 md:-mx-5">
                <StructureToolbar
                  chrome={chrome}
                  readOnly={!canSave}
                  canUndo={edit.log.length > 0 || edit.saved.length > 0}
                  canRedo={edit.redo.length > 0}
                  onUndo={undo}
                  onRedo={redo}
                  onComment={() => {
                    setPanelPref(true);
                    session.commentOn(chrome?.tools?.selected ?? focusAnchor ?? "");
                  }}
                  selecting={selecting}
                  onLasso={() => {
                    setPanelPref(true);
                    session.setSelecting(!selecting);
                  }}
                  onShortcuts={() => setShortcutsOpen(true)}
                />
              </div>
            ) : null}
          </div>

          <main
            ref={page.ref}
            data-dingze-main
            data-dz-selecting={selecting || undefined}
            onFocusCapture={(event) => {
              const target = event.target as HTMLElement;
              if (target.matches?.("input, textarea, select")) lastField.current = target;
              const anchor = target.closest?.("[data-anchor]")?.getAttribute("data-anchor");
              if (anchor) setFocusAnchor(anchor);
            }}
            onContextMenu={(event) => {
              const anchor = (event.target as HTMLElement).closest?.("[data-anchor]")?.getAttribute("data-anchor");
              if (!anchor || !canComment || (event.target as HTMLElement).closest("input, textarea")) return;
              event.preventDefault();
              setAnchorMenu({ x: event.clientX, y: event.clientY, anchor });
            }}
            onClickCapture={(event) => {
              if (!selecting) return;
              const anchor = (event.target as HTMLElement).closest?.("[data-anchor]")?.getAttribute("data-anchor");
              if (!anchor) return;
              event.preventDefault();
              event.stopPropagation();
              session.toggleSelection(anchor);
            }}
            className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-[color:var(--dz-canvas)] p-4 md:p-5"
          >
            <EditMarkers
              changed={marks.changed}
              added={marks.added}
              before={marks.before}
              comments={openThreads.flatMap(threadAnchors)}
              preview={previewDraft ? previewDraft.items.map((i) => i.anchor) : previewAnchors}
              selection={selection}
            />
            {selecting ? (
              <LassoBar
                count={selection.length}
                onWrite={() => openComposer.current(selection)}
                onCancel={() => {
                  session.clearSelection();
                  session.setSelecting(false);
                }}
              />
            ) : null}
            <LassoOutlines
              groups={pins.filter((p) => !p.resolved && p.anchors.length > 1).map((p) => ({ id: p.id, no: p.no, anchors: p.anchors }))}
              onOpen={(id) => {
                setPanelPref(true);
                setAsideTab("comments");
                window.setTimeout(() => document.getElementById(`comment-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
              }}
            />
            {commentDraft ? (
              <CommentComposer
                project={project}
                code={code}
                team={overview.team ?? []}
                draft={commentDraft}
                onChange={(text) => setCommentDraft((d) => (d ? { ...d, text } : d))}
                onClose={() => setCommentDraft(null)}
                onSent={(id) => {
                  setCommentDraft(null);
                  setJustAdded(id);
                  if (selection.length) {
                    session.clearSelection();
                    session.setSelecting(false);
                  }
                  setPanelPref(true);
                  setAsideTab("comments");
                }}
              />
            ) : null}
            {anchorMenu ? (
              <AnchorMenu
                x={anchorMenu.x}
                y={anchorMenu.y}
                label={`${nameOf(anchorMenu.anchor)} 的菜单`}
                onClose={() => setAnchorMenu(null)}
                onComment={() => {
                  const at = anchorMenu.anchor;
                  setAnchorMenu(null);
                  setFocusAnchor(at);
                  openComposer.current([at]);
                }}
              />
            ) : null}
            {previewDraft ? (
              <>
                <div className="sticky top-0 z-30 -mb-2 flex items-center gap-2 self-center rounded-full border px-3 py-1 text-xs shadow-md" style={{ background: "var(--dz-ai-soft)", borderColor: "var(--dz-ai)" }} role="status">
                  <Sparkles className="size-3.5" style={{ color: "var(--dz-ai)" }} />
                  正在预览数字咨询师的修改建议：琥珀色虚线和序号对应修改卡，确认后才写入
                  <Button size="xs" variant="ghost" onClick={() => setPreviewDraft(null)}>
                    回到当前
                  </Button>
                </div>
                <CommentPins
                  pins={previewDraft.items.map((i) => ({ id: -i.no, no: i.no, anchors: [i.anchor], resolved: false, label: `修改建议第 ${i.no} 条` }))}
                  activeId={null}
                  onOpen={() => {
                    setPanelPref(true);
                    setAsideTab("coach");
                  }}
                  tone="var(--dz-ai)"
                  side="left"
                  what="修改建议"
                />
              </>
            ) : null}
            <CommentPins
              pins={pins}
              activeId={activeComment ?? highlightComment}
              onOpen={(id) => {
                setPanelPref(true);
                setAsideTab("comments");
                window.setTimeout(() => document.getElementById(`comment-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
              }}
            />

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
                {["step_done", "in_review", "pending_confirm", "locked"].includes(status) ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-background px-3 py-1.5 text-sm">
                    {next ? (
                      <>
                        <span className="text-muted-foreground">
                          这一步{status === "locked" ? "已定版" : status === "step_done" ? (actor.service === "self" ? "本步已完成（还没自查复核）" : "本步已完成（还没交给顾问复核）") : "已交出去"}，可以接着做：
                        </span>
                        <Link to={workspacePath(project.id, next.code)} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                          《{next.name}》 <ArrowRight className="size-4" />
                        </Link>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {ARTIFACTS.filter((a) => a.priority === "P0").every((a) => overview.artifacts.find((x) => x.code === a.code)?.status === "locked") ? (
                          <>
                            全部 P0 成果都已定版，可以到
                            <Link to={`${base}/results?tab=delivery`} className="mx-1 font-semibold text-brand underline">
                              导出
                            </Link>
                            页下载正式交付物。
                          </>
                        ) : (
                          "本阶段已解锁的表都做完了；下一阶段在本阶段 P0 全部定版后开启。"
                        )}
                      </span>
                    )}
                  </div>
                ) : null}

                {EDITABLE_CODES.has(code) ? (
                  <RegionErrorBoundary
                    title={previewDraft ? "这条修改建议预览不了" : "这张表显示出错"}
                    description={previewDraft ? "建议的内容不完整，表里没有任何改动。收起预览后可以在修改卡上不采纳。" : "可以刷新页面重试；未保存的修改在“修改”里。"}
                    action={previewDraft ? { label: "收起预览", onClick: () => setPreviewDraft(null) } : undefined}
                    resetKeys={[previewDraft, code]}
                  >
                  <ArtifactEditor
                    code={code}
                    value={previewDraft ? previewDraft.payload : draft}
                    onChange={previewDraft ? () => toast.info("正在预览修改建议：先在修改卡上确认或不采纳") : setDraft}
                    readOnly={readOnly || !!previewDraft}
                    issues={issues}
                    upstream={upstream}
                    projectYear={project.year}
                    keyProjectLevel={project.keyProjectLevel}
                    orgUnits={overview.orgUnits ?? []}
                    team={overview.team ?? []}
                    scheduleScale={project.scheduleScale}
                    enterprise={project.enterprise?.name ?? "企业"}
                  />
                  </RegionErrorBoundary>
                ) : (
                  <Alert>
                    <AlertTitle>这张表暂无在线编辑器</AlertTitle>
                    <AlertDescription>请按方法手册在线下完成，成果以附件形式由咨询师归档。</AlertDescription>
                  </Alert>
                )}

                {EDITABLE_CODES.has(code) ? <ValidationBar issues={issues} hasRules optional={def.priority === "P1"} /> : null}
                {detail.data && (status === "pending_confirm" || status === "locked" || detail.data.dissents.length > 0) ? (
                  <DissentList detail={detail.data} project={project} code={code} />
                ) : null}
              </>
            )}
            {activeComment ? (
              <div className="sticky bottom-2 z-20 flex flex-wrap items-center gap-2 self-start rounded-full border px-3 py-1 text-xs shadow-sm" style={{ borderColor: "var(--dz-comment)", background: "color-mix(in oklab, var(--dz-comment) 10%, var(--background))" }}>
                正在按批注 {circled(numberOf(activeComment) ?? 0)} 修改：改动会关联到这条批注，保存后自动回复
                <Button size="xs" variant="ghost" onClick={() => setActiveComment(null)}>
                  结束
                </Button>
              </div>
            ) : null}
          </main>
          {EDITABLE_CODES.has(code) && unlocked ? (
            <StatusBar
              summary={previewDraft ? [{ tone: "warn", text: "修改建议待确认" }, ...(chrome?.summary ?? []).map((x) => ({ ...x, text: `预览：${x.text}` }))] : chrome?.summary}
              errors={blocking}
              optional={def.priority === "P1"}
              warnings={issues.length - blocking}
              openComments={openThreads.length}
              revisionOn={revision.on}
              revisionLabel={revision.baseRev ? `v${revision.baseRev}` : undefined}
              selected={chrome?.tools?.selectedLabel ?? (focusAnchor ? nameOf(focusAnchor) : null)}
              hints={hints}
              onIssues={() => document.querySelector("[data-dingze-validation]")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              onComments={() => {
                setPanelPref(true);
                setAsideTab("comments");
              }}
              onRevision={() => revisionToggle.current()}
              onShortcuts={() => setShortcutsOpen(true)}
            />
          ) : null}
          <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
          <MaterialViewer id={viewingMaterial} onClose={() => setViewingMaterial(null)} />
        </div>

        <aside
          aria-label="对话、批注、修改与书中方法"
          data-dingze-coach
          className={cn(
            "flex min-h-0 w-[380px] shrink-0 flex-col border-l bg-card",
            narrowPanel && "fixed top-14 right-0 bottom-0 z-40 max-w-[92vw] shadow-2xl",
            !panelOpen && "hidden",
          )}
        >
          <div role="tablist" aria-label="右栏" className="flex shrink-0 items-end gap-1 border-b px-3 pt-2">
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={asideTab === key}
                onClick={() => setAsideTab(key)}
                className={cn(
                  "flex items-center gap-1 border-b-2 px-2.5 pb-2 text-sm",
                  asideTab === key ? "border-brand font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {count ? (
                  <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: key === "comments" ? "var(--dz-comment)" : "var(--dz-changed)" }}>
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className={cn("flex min-h-0 flex-1 flex-col", asideTab !== "coach" && "hidden")}>
            <CoachPanel stage={def.stage} chatId={`dingze-${project.id}-${code}`} />
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", asideTab !== "comments" && "hidden")}>
            <CommentsPanel
              project={project}
              code={code}
              team={overview.team ?? []}
              canComment={canComment}
              canResolveAny={overview.isConsultAdmin || role === "ent_lead" || role === "lead_consultant"}
              currentUserId={identity.data?.id ?? null}
              highlightId={justAdded ?? highlightComment}
              numberOf={numberOf}
              draft={commentDraft}
              onOpenDraft={() => setCommentDraft((d) => (d ? { ...d } : d))}
              onNew={() => openComposer.current([])}
            />
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", asideTab !== "changes" && "hidden")}>
            <ChangesPanel project={project} code={code} commentNo={numberOf} />
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto bg-book p-4 text-sm text-book-foreground", asideTab !== "book" && "hidden")}>
            <BookMethod def={def} sub={Number(searchParams.get("sub")) || null} zone={searchParams.get("zone")} />
            {overview.isConsultAdmin || (!!role && CONSULTANT_ROLES.includes(role)) ? (
              <div className="mt-4 border-t border-book-border pt-3">
                <GuidanceGapButton project={project} code={code} artifactName={def.name} />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </AIPageContextScope>
    </EditSessionContext.Provider>
  );
}
