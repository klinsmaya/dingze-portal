import { STAGES, type StageKey } from "@dingze/shared";

import type { StageProgress } from "./progress";

// 客户流程（2026-11 甲方反馈）：注册 → 上传资料 → 战略解码 → 目标分解 → 计划制定 → 下载成果。
// 注册在登录前完成；登录后项目里走后面五步。三个阶段的表、解锁和定版规则不变，这里只把它们
// 按客户的顺序排成一条线，告诉他现在在哪一步。步骤卡只放编号和名字（界面梳理 2026-11：解释性文字一律去掉）。

export type FlowKey = "materials" | StageKey | "deliver";
export type FlowState = "done" | "current" | "todo" | "locked";

export type FlowStep = {
  key: FlowKey;
  /** 1-based number shown to the customer. */
  no: number;
  label: string;
  state: FlowState;
};

export type FlowInput = {
  stages: StageProgress[];
  /** 资料与画像这一项已就绪（至少一份资料，画像有确认的条目）。 */
  materialsReady: boolean;
  /** 任一张表已经开始填。 */
  started: boolean;
};

/**
 * The five steps a customer walks through inside a project, and which one they are on.
 * 资料可以先跳过：已经开始填表时，“当前”落到第一个没做完的阶段上，资料只标“未完成”。
 */
export function flowSteps({ stages, materialsReady, started }: FlowInput): FlowStep[] {
  const steps: FlowStep[] = [
    {
      key: "materials",
      no: 1,
      label: "上传资料",
      state: materialsReady ? "done" : "todo",
    },
    ...STAGES.map((stage, i): FlowStep => {
      const p = stages.find((s) => s.stage === stage.key);
      const state: FlowState = !p ? "locked" : p.complete ? "done" : p.open ? "todo" : "locked";
      return {
        key: stage.key,
        no: i + 2,
        label: stage.flow,
        state,
      };
    }),
  ];
  const allLocked = stages.length > 0 && stages.every((s) => s.complete);
  steps.push({
    key: "deliver",
    no: 5,
    label: "下载成果",
    state: allLocked ? "todo" : "locked",
  });

  // 当前步：资料没好且还没开始填表 → 资料；否则第一个没做完、已开启的步骤。
  const current =
    !materialsReady && !started
      ? steps[0]
      : steps.find((s) => s.key !== "materials" && s.state === "todo") ?? (!materialsReady ? steps[0] : null);
  if (current) current.state = "current";
  return steps;
}

