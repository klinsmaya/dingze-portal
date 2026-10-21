// What a comment can be pinned to: every row with an `id` inside the artifact payload (goals,
// paths, charters, WBS packages, scorecard items …), labelled by its most telling text field.

export type AnchorOption = { id: string; label: string; group: string };

const LABEL_KEYS = ["name", "title", "path", "task", "statement", "text", "metric", "item", "deptName", "code", "risk", "need", "renamed"];
const GROUP_LABELS: Record<string, string> = {
  objectives: "战略目标",
  links: "连线",
  strategies: "战略",
  tactics: "策略",
  battlefields: "主要战场",
  sheets: "IPOOC",
  candidates: "候选指标",
  kpis: "战略 KPI",
  rows: "行",
  goals: "年度目标",
  themes: "解码主题",
  nodes: "路径 / 节点",
  projects: "关键项目",
  cards: "计分卡",
  items: "计分项",
  screening: "项目化判定",
  charters: "任务书",
  wbs: "WBS",
  risks: "风险",
  depts: "部门计划书",
  columns: "部门 / 岗位",
};

const clip = (text: string) => (text.length > 28 ? `${text.slice(0, 28)}…` : text);

function labelOf(item: Record<string, unknown>): string {
  for (const key of LABEL_KEYS) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) return clip(v.trim());
  }
  return "";
}

/** Single fields worth commenting on (战略屋 / 六分法 cells, worksheet sentences, review notes). */
const FIELD_LABELS: Record<string, string> = {
  mission: "使命",
  vision: "愿景",
  values: "价值观",
  "goals.y1": "一年目标",
  "goals.y3": "三年目标",
  "goals.y5": "五年目标",
  "foundation.organization": "落地保障 · 组织",
  "foundation.mechanism": "落地保障 · 机制",
  "foundation.talent": "落地保障 · 人才",
  strategicGoals: "战略目标",
  strategyChoice: "策略选择",
  stepsAndMeasures: "步骤举措",
  indicatorSystem: "指标体系",
  statement: "合成句",
  levelNote: "层级相对性说明",
  strategyReview: "往上看 · 回顾公司战略",
  lastPeriodIssues: "往回看 · 上期问题",
  basis: "预算编制说明",
};

function fieldOptions(payload: unknown): AnchorOption[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const get = (path: string) => path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), payload);
  return Object.entries(FIELD_LABELS)
    .filter(([path]) => typeof get(path) === "string")
    .map(([id, label]) => ({ id, label, group: "字段" }));
}

export function anchorOptions(payload: unknown): AnchorOption[] {
  const out: AnchorOption[] = fieldOptions(payload);
  const seen = new Set<string>(out.map((o) => o.id));
  const walk = (value: unknown, key: string) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
          const id = (item as { id: string }).id;
          const label = labelOf(item as Record<string, unknown>);
          if (!seen.has(id) && label) {
            seen.add(id);
            out.push({ id, label, group: GROUP_LABELS[key] ?? key });
          }
        }
        walk(item, key);
      }
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(payload, "");
  return out;
}
