import { type Actor, type ArtifactStatus, type LifecycleAction, canPerform } from "@dingze/shared";

// 表头流程按钮（开营前 UX 改版 F1–F5、F11）：每种状态一个主动作；当前角色不能做时，
// 待复核写“等主咨询师复核”，其余显示灰按钮并说明谁可以点。

export type FlowAction = Exclude<LifecycleAction, "save">;

const FROM: Partial<Record<FlowAction, ArtifactStatus[]>> = {
  stepDone: ["in_progress"],
  submitReview: ["step_done"],
  selfReview: ["step_done"],
  approve: ["in_review"],
  returnToEdit: ["in_review", "pending_confirm"],
  confirm: ["pending_confirm"],
  reopen: ["locked"],
};

const LABELS: Partial<Record<FlowAction, string>> = {
  stepDone: "本步完成",
  submitReview: "提交复核",
  selfReview: "自查复核",
  approve: "复核通过，提交企业确认",
  returnToEdit: "退回修改",
  confirm: "确认定版",
  reopen: "解锁重开",
};

const ENTERPRISE_SIDE = ["ent_lead", "dept_head", "member", "readonly"];

export function flowLabel(action: FlowAction, status: ArtifactStatus, actor: Actor): string {
  // 企业在待复核时把表拉回来叫“撤回修改”，免得和顾问的“退回修改”混淆（F2）。
  if (action === "returnToEdit" && status === "in_review" && actor.projectRole && ENTERPRISE_SIDE.includes(actor.projectRole)) return "撤回修改";
  return LABELS[action] ?? action;
}

export function mainAction(status: ArtifactStatus, actor: Actor): FlowAction | null {
  switch (status) {
    case "in_progress":
      return "stepDone";
    case "step_done":
      return actor.service === "self" ? "selfReview" : "submitReview";
    case "in_review":
      return "approve";
    case "pending_confirm":
      return "confirm";
    case "locked":
      return "reopen";
    default:
      return null;
  }
}

export function whoCan(action: FlowAction, actor: Actor): string {
  switch (action) {
    case "stepDone":
      return "企业项目负责人或部门负责人可以点“本步完成”";
    case "submitReview":
      return "企业项目负责人、部门负责人或咨询师可以提交复核";
    case "selfReview":
      return "企业项目负责人做自查复核";
    case "approve":
      return "主咨询师复核通过";
    case "returnToEdit":
      return "主咨询师（待复核时）或企业项目负责人可以退回 / 撤回，要写原因";
    case "confirm":
      return "仅企业项目负责人可以确认定版";
    case "reopen":
      return actor.service === "self" ? "企业项目负责人可以解锁重开，要写原因" : "企业项目负责人或主咨询师可以解锁重开，要写原因，咨询师会收到通知";
    default:
      return "";
  }
}

export type FlowPlan = {
  /** The state's main action when this actor may take it. */
  primary: FlowAction | null;
  /** Other actions this actor may take now (outline buttons). */
  others: FlowAction[];
  /** The main action shown greyed when this actor may not take it. */
  blocked: FlowAction | null;
  /** Shown instead of a greyed button (待复核 for the enterprise). */
  waiting: string | null;
};

export function flowPlan(status: ArtifactStatus, actor: Actor): FlowPlan {
  const allowed = (Object.keys(FROM) as FlowAction[]).filter((a) => FROM[a]!.includes(status) && canPerform(a, actor));
  const main = mainAction(status, actor);
  const primary = main && allowed.includes(main) ? main : null;
  const others = allowed.filter((a) => a !== primary);
  if (primary || !main) return { primary, others, blocked: null, waiting: null };
  if (status === "in_review") return { primary: null, others, blocked: null, waiting: "等主咨询师复核" };
  return { primary: null, others, blocked: main, waiting: null };
}
