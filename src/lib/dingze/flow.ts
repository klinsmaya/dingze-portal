import { STAGES, type StageKey } from "@dingze/shared";

import type { StageProgress } from "./progress";

// 客户流程（2026-11 甲方反馈）：注册 → 上传资料 → 战略解码 → 目标分解 → 计划制定 → 下载成果。
// 注册在登录前完成；登录后项目里走后面五步。三个阶段的表、解锁和定版规则不变，这里只把它们
// 按客户的顺序排成一条线，告诉他现在在哪一步。

export type FlowKey = "materials" | StageKey | "deliver";
export type FlowState = "done" | "current" | "todo" | "locked";

export type FlowStep = {
  key: FlowKey;
  /** 1-based number shown to the customer. */
  no: number;
  label: string;
  /** One short line: what this step is for. */
  hint: string;
  /** The book's name (定战略责 …) for the three stages. */
  bookName?: string;
  state: FlowState;
  /** e.g. "已定版 3 / 7" or "2 份资料 · 画像已确认". */
  detail: string;
};

const STAGE_HINTS: Record<StageKey, string> = {
  strategy: "把战略说清楚、能衡量",
  goal: "定年度目标，找路径，责任分到部门",
  action: "落实任务、节点和资源，生成年度经营计划书",
};

export type FlowInput = {
  stages: StageProgress[];
  /** 资料与画像这一项已就绪（至少一份资料，画像有确认的条目）。 */
  materialsReady: boolean;
  materialCount: number;
  /** 任一张表已经开始填。 */
  started: boolean;
};

/**
 * The five steps a customer walks through inside a project, and which one they are on.
 * 资料可以先跳过：已经开始填表时，“当前”落到第一个没做完的阶段上，资料只标“未完成”。
 */
export function flowSteps({ stages, materialsReady, materialCount, started }: FlowInput): FlowStep[] {
  const steps: FlowStep[] = [
    {
      key: "materials",
      no: 1,
      label: "上传资料",
      hint: "企业简介、组织架构、上年经营复盘",
      state: materialsReady ? "done" : "todo",
      detail: materialsReady ? `${materialCount} 份资料 · 画像已确认` : materialCount ? `${materialCount} 份资料 · 画像待确认` : "还没有资料",
    },
    ...STAGES.map((stage, i): FlowStep => {
      const p = stages.find((s) => s.stage === stage.key);
      const state: FlowState = !p ? "locked" : p.complete ? "done" : p.open ? "todo" : "locked";
      return {
        key: stage.key,
        no: i + 2,
        label: stage.flow,
        bookName: stage.name,
        hint: STAGE_HINTS[stage.key],
        state,
        detail: p ? `必做表已定版 ${p.locked} / ${p.gateTotal}` : "",
      };
    }),
  ];
  const allLocked = stages.length > 0 && stages.every((s) => s.complete);
  steps.push({
    key: "deliver",
    no: 5,
    label: "下载成果",
    hint: "计划书 Word、各表 Excel 和图片",
    state: allLocked ? "todo" : "locked",
    detail: allLocked ? "可以下载定版成果" : "计划制定定版后可下载",
  });

  // 当前步：资料没好且还没开始填表 → 资料；否则第一个没做完、已开启的步骤。
  const current =
    !materialsReady && !started
      ? steps[0]
      : steps.find((s) => s.key !== "materials" && s.state === "todo") ?? (!materialsReady ? steps[0] : null);
  if (current) current.state = "current";
  return steps;
}

