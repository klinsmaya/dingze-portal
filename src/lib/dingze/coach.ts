import type { StageKey } from "@dingze/shared";

/** The digital consultant (AI employee from @ziqu/plugin-dingze) that coaches each stage. */
export const COACH_BY_STAGE: Record<StageKey, string> = {
  strategy: "dingze-strategy-coach",
  goal: "dingze-goal-coach",
  action: "dingze-action-coach",
};

/** Frontend tool the consultants call to propose writing agreed content into the open artifact. */
export const PROPOSE_TOOL = "dingzeProposeChanges";

/** What each consultant brings, mirrored from the plugin's AI employee and Skill files. */
export const COACHES: { username: string; stage: StageKey; name: string; skills: { name: string; summary: string }[] }[] = [
  {
    username: COACH_BY_STAGE.strategy,
    stage: "strategy",
    name: "定战略责咨询师",
    skills: [
      { name: "内容共识", summary: "战略屋 / 战略简约六分法（S1-01），使命五要素与愿景三法底稿" },
      { name: "逻辑共识", summary: "战略地图（S1-02），双二四与业务战略逻辑作为提问脚手架" },
      { name: "衡量共识", summary: "战略策略逻辑表、IPOOC、KPI 筛选与 3—5 年分解（S1-03～S1-07）" },
    ],
  },
  {
    username: COACH_BY_STAGE.goal,
    stage: "goal",
    name: "定目标责咨询师",
    skills: [
      { name: "找路径", summary: "定目标、解码地图四个层面找路径、路径系统到三四级、立项目（含引导规则包）" },
      { name: "横向到边 · 纵向到底", summary: "RACI 责任分解、部门目标承接、部门级路径、绩效计分卡" },
    ],
  },
  {
    username: COACH_BY_STAGE.action,
    stage: "action",
    name: "定行动责咨询师",
    skills: [{ name: "三明确与计划书", summary: "项目任务书与 WBS、计划实施推进表、资源匹配、年度经营计划书" }],
  },
];
