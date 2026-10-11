import { Badge } from "@/components/ui/badge";
import type { EnterpriseStatus } from "@/lib/dingze/ops-api";

export const SIZE_LABELS = { sme: "中小企业", large: "大型企业" } as const;
export const SCENE_LABELS = { camp: "训练营", inhouse: "企业内训" } as const;
export const SCHEDULE_LABELS = { month: "按月", quarter: "按季度" } as const;
export const ORG_KIND_LABELS = { company: "公司", department: "部门", team: "团队" } as const;

export function EnterpriseStatusBadge({ status }: { status: EnterpriseStatus }) {
  return status === "suspended" ? (
    <Badge variant="destructive">已停用</Badge>
  ) : (
    <Badge className="bg-status-done text-status-done-foreground">使用中</Badge>
  );
}
