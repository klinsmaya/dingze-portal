import {
  type ArtifactStatus,
  type DecodeMap,
  type GoalPathSystem,
  SIXFOLD_FIELDS,
  type StageKey,
  STAGES,
  type StrategyContent,
  getArtifactDef,
} from "@dingze/shared";

import type { ArtifactOverview } from "./api";

// 项目路线 (design 10 / 09 shell): each stage as 工作任务 → 实施步骤 → 子步骤, in book order.
// The left rail shows the tree; the top bar shows the sub-steps of the current step (or the
// steps of the current task). A step points at a table (and, for S2-03, at one of its zones).

export type RouteTarget = { code: string; search?: string };

type SubDef = "find-path" | "sixfold" | { phases: string[] };

type StepDef = {
  key: string;
  label: string;
  /** Short name for the top bar title, e.g. “找路径”. */
  short: string;
  codes: string[];
  /** S2-03 has two zones; the step shows one of them. */
  zone?: "targets" | "paths";
  subs?: SubDef;
  method?: boolean;
  optional?: boolean;
};

type TaskDef = { label: string; steps: StepDef[] };

const ROUTE: Record<StageKey, TaskDef[]> = {
  strategy: [
    {
      label: "内容共识：纷繁战略简约化",
      steps: [{ key: "s1-content", label: "战略简约六分法 / 战略屋", short: "内容共识", codes: ["S1-01"], subs: "sixfold" }],
    },
    {
      label: "逻辑共识：简约战略逻辑化",
      steps: [
        { key: "s1-mission", label: "使命共识", short: "使命共识", codes: ["M-MISSION"], method: true },
        { key: "s1-vision", label: "愿景共识", short: "愿景共识", codes: ["M-VISION"], method: true },
        { key: "s1-map", label: "战略内容的逻辑共识", short: "战略地图", codes: ["S1-02"] },
      ],
    },
    {
      label: "衡量共识：逻辑战略指标化",
      steps: [
        { key: "s1-logic", label: "第一步 导出战略和策略", short: "导出战略和策略", codes: ["S1-03"] },
        { key: "s1-ipooc", label: "第二步 设定衡量指标", short: "设定衡量指标", codes: ["S1-04"], optional: true },
        { key: "s1-kpi", label: "第三步 筛选战略 KPI", short: "筛选战略 KPI", codes: ["S1-05", "S1-06"] },
        { key: "s1-years", label: "第四步 分解到 3—5 年", short: "分解到 3—5 年", codes: ["S1-07"] },
      ],
    },
  ],
  goal: [
    {
      label: "路径支撑，确保结果必赢",
      steps: [
        { key: "s2-target", label: "第一步 定目标", short: "定目标", codes: ["S2-03", "M-BUDGET"], zone: "targets" },
        { key: "s2-path", label: "第二步 找路径", short: "找路径", codes: ["S2-01", "S2-03"], zone: "paths", subs: "find-path" },
        { key: "s2-key", label: "第三步 抓关键 · 立项目", short: "抓关键 · 立项目", codes: ["S2-08"] },
      ],
    },
    {
      label: "横向到边，责任全域协同",
      steps: [{ key: "s2-raci", label: "RACI 责任分解", short: "责任分解", codes: ["S2-04"], subs: { phases: ["列出责任者", "构建 RACI", "验证与优化"] } }],
    },
    {
      label: "纵向到底，目标层层击穿",
      steps: [
        { key: "s2-dept", label: "分部门", short: "分部门", codes: ["S2-05"] },
        { key: "s2-dept-path", label: "部门级再找路径", short: "部门找路径", codes: ["S2-06"] },
        { key: "s2-score", label: "挂考核", short: "挂考核", codes: ["S2-07"] },
      ],
    },
  ],
  action: [
    {
      label: "任务明确，全局可视",
      steps: [{ key: "s3-charter", label: "项目与项目制管理", short: "任务明确", codes: ["S3-02"], subs: { phases: ["项目化判定", "写任务书", "拆 WBS"] } }],
    },
    {
      label: "节点明确，进程可控",
      steps: [{ key: "s3-plan", label: "划分节点 · 推进表", short: "节点明确", codes: ["S3-05"], subs: { phases: ["划分节点", "输出推进表"] } }],
    },
    {
      label: "资源明确，支撑可见",
      steps: [{ key: "s3-res", label: "资源匹配", short: "资源明确", codes: ["S3-06"], subs: { phases: ["算清需求", "核对存量", "补齐缺口"] } }],
    },
    {
      label: "年度经营计划书",
      steps: [
        { key: "s3-company", label: "公司计划", short: "公司计划书", codes: ["S3-07"] },
        { key: "s3-dept", label: "部门计划", short: "部门计划书", codes: ["S3-08"] },
      ],
    },
  ],
};

export const FIND_PATH_SUBS: { no: number; label: string; short: string; perspective?: "financial" | "customer" | "process" | "learning" }[] = [
  { no: 1, label: "股东价值差距", short: "股东价值差距", perspective: "financial" },
  { no: 2, label: "客户价值主张", short: "客户价值主张", perspective: "customer" },
  { no: 3, label: "关键价值创造流程", short: "关键流程", perspective: "process" },
  { no: 4, label: "战略资产准备度", short: "资产准备度", perspective: "learning" },
  { no: 5, label: "导入路径系统表", short: "导入表 3-10" },
];

export type RouteSub = { key: string; label: string; short: string; done: boolean; current: boolean; to?: RouteTarget; icon?: string };
export type StepState = "locked" | "todo" | "doing" | "review" | "returned" | "done" | "final";
export type RouteStep = {
  key: string;
  label: string;
  short: string;
  to: RouteTarget;
  state: StepState;
  /** Short text at the right: 已定版 / 待复核 / 3/5 … */
  badge: string;
  current: boolean;
  method: boolean;
  optional: boolean;
  codes: string[];
  subs: RouteSub[];
  stale: boolean;
};
export type RouteTask = { label: string; steps: RouteStep[]; locked: boolean; current: boolean };
export type Route = { stage: StageKey; stageName: string; tasks: RouteTask[]; done: number; total: number; current: RouteStep | null; currentTask: RouteTask | null };

export type Where = { code: string; zone?: string | null; sub?: number | null };

const REVIEWED: ArtifactStatus[] = ["step_done", "in_review", "pending_confirm", "locked"];

function stateOf(a: ArtifactOverview | undefined): StepState {
  if (!a || !a.unlock.unlocked) return "locked";
  if (a.status === "locked") return "final";
  if (a.status === "pending_confirm" || a.status === "in_review") return "review";
  if (a.status === "step_done") return "done";
  if (a.status === "in_progress" && a.lastEvent && ["returnToEdit", "forceReturn"].includes(a.lastEvent.action)) return "returned";
  if (a.status === "in_progress") return "doing";
  return "todo";
}

const BADGE: Record<StepState, string> = { locked: "", todo: "未开始", doing: "进行中", review: "", done: "本步完成", returned: "已退回", final: "已定版" };

/** One state for a step that spans several tables. */
function combine(states: StepState[]): StepState {
  if (states.length === 0) return "todo";
  if (states.every((s) => s === "locked")) return "locked";
  if (states.every((s) => s === "final")) return "final";
  for (const s of ["returned", "doing", "review", "done"] as StepState[]) if (states.includes(s)) return s;
  return states.includes("final") ? "doing" : "todo";
}

function filled(v: unknown) {
  return typeof v === "string" && v.trim() !== "" && v.trim() !== "待补";
}

/** Sub-steps of 找路径 and the six parts of 六分法, with what is already done. */
function subsOf(def: StepDef, where: Where, byCode: Map<string, ArtifactOverview>, payloads: Record<string, unknown>): RouteSub[] {
  if (def.subs === "find-path") {
    const map = payloads["S2-01"] as DecodeMap | undefined;
    const paths = payloads["S2-03"] as GoalPathSystem | undefined;
    return FIND_PATH_SUBS.map((s) => {
      const done = s.perspective ? (map?.themes ?? []).some((t) => t.perspective === s.perspective) : (paths?.nodes ?? []).length > 0;
      const current = s.perspective ? where.code === "S2-01" && (where.sub ?? 1) === s.no : where.code === "S2-03" && where.zone === "paths";
      const to: RouteTarget = s.perspective ? { code: "S2-01", search: `sub=${s.no}` } : { code: "S2-03", search: "zone=paths" };
      return { key: `fp${s.no}`, label: s.label, short: s.short, done, current, to, icon: s.perspective ?? "import" };
    });
  }
  if (def.subs === "sixfold") {
    const content = payloads["S1-01"] as StrategyContent | undefined;
    return SIXFOLD_FIELDS.map((f) => ({
      key: String(f.key),
      label: f.label,
      short: f.label.replace(/（.*）/, ""),
      done: filled(content?.[f.key]),
      current: false,
      to: { code: "S1-01", search: `field=${String(f.key)}` },
    }));
  }
  if (def.subs && typeof def.subs === "object") {
    const a = byCode.get(def.codes[0]);
    const finished = !!a && REVIEWED.includes(a.status);
    return def.subs.phases.map((p, i) => ({ key: `${def.key}-${i}`, label: p, short: p, done: finished, current: false }));
  }
  return [];
}

export function buildRoute(stage: StageKey, artifacts: ArtifactOverview[], where: Where, payloads: Record<string, unknown> = {}): Route {
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  let current: RouteStep | null = null;
  let currentTask: RouteTask | null = null;
  const tasks: RouteTask[] = ROUTE[stage].map((t) => {
    const steps: RouteStep[] = t.steps.map((def) => {
      // A step spanning an optional P1 table and a P0 one (筛选 KPI: S1-05 + S1-06) links to the first
      // table that is open; a P1 table still locked behind a skipped one is never the target (验收 E D04).
      const tables = def.codes.filter((c) => getArtifactDef(c).priority !== "method");
      const main =
        tables.find((c) => stateOf(byCode.get(c)) !== "locked") ??
        tables.find((c) => getArtifactDef(c).priority === "P0") ??
        tables[0] ??
        def.codes[0];
      // A step is “now” when it owns the open table (and zone, for S2-03).
      const isCurrent =
        def.codes.includes(where.code) &&
        (where.code !== "S2-03" || !def.zone || (where.zone ?? "targets") === def.zone);
      const state = combine(def.codes.filter((c) => getArtifactDef(c).priority !== "method" || def.method).map((c) => stateOf(byCode.get(c))));
      const subs = subsOf(def, where, byCode, payloads);
      const a = byCode.get(main);
      let badge = BADGE[state];
      if (state === "review") badge = a?.status === "pending_confirm" ? "待确认" : "待复核";
      if (def.subs === "find-path" && state !== "final" && state !== "locked") badge = `${subs.filter((s) => s.done).length}/${subs.length}`;
      if (def.method && state !== "locked") badge = "方法底稿";
      const target: RouteTarget = def.zone ? { code: "S2-03", search: `zone=${def.zone}` } : { code: main };
      if (def.subs === "find-path") {
        const firstOpen = subs.find((s) => !s.done) ?? subs[subs.length - 1];
        if (firstOpen?.to) Object.assign(target, firstOpen.to);
      }
      const step: RouteStep = {
        key: def.key,
        label: def.label,
        short: def.short,
        to: target,
        state,
        badge,
        current: isCurrent,
        method: !!def.method,
        optional: !!def.optional,
        codes: def.codes,
        subs,
        stale: def.codes.some((c) => byCode.get(c)?.stale),
      };
      if (isCurrent && (!current || def.codes[0] === where.code)) current = step;
      return step;
    });
    const task: RouteTask = { label: t.label, steps, locked: steps.every((s) => s.state === "locked"), current: steps.some((s) => s.current) };
    if (task.current && current && steps.includes(current)) currentTask = task;
    return task;
  });
  const counted = tasks.flatMap((t) => t.steps).filter((s) => !s.method);
  return {
    stage,
    stageName: STAGES.find((s) => s.key === stage)!.name,
    tasks,
    done: counted.filter((s) => s.state === "final").length,
    total: counted.length,
    current,
    currentTask,
  };
}

/** What the top bar shows: the current step's sub-steps, or the steps of its task. */
export function topbarItems(route: Route): RouteSub[] {
  const step = route.current;
  if (!step) return [];
  if (step.subs.length) return step.subs;
  const task = route.currentTask;
  if (task && task.steps.filter((s) => !s.method).length > 1) {
    return task.steps
      .filter((s) => !s.method)
      .map((s) => ({ key: s.key, label: s.label, short: s.short, done: s.state === "final" || s.state === "done" || s.state === "review", current: s.current, to: s.state === "locked" ? undefined : s.to }));
  }
  return [];
}

export function routePath(projectId: number, to: RouteTarget) {
  return `/projects/${projectId}/workspace/${to.code}${to.search ? `?${to.search}` : ""}`;
}
