import { Building2, Network, UserRound } from "lucide-react";

import { PROJECT_ROLE_LABELS, orgKindLabel } from "@dingze/shared";

import { EmptyState } from "@/components/dingze/empty-state";
import { Badge } from "@/components/ui/badge";
import type { ProjectOrgUnit, ProjectTeamMember } from "@/lib/dingze/api";
import { flattenOrgUnits } from "@/lib/dingze/org-units";

/**
 * 组织与职责 (闭环第一批): the enterprise's departments as the project sees them — who heads each
 * one and which project members sit in it. Maintained on this page by those who may edit it; the
 * tables that use departments (RACI, 部门承接, 部门计划书) keep their own copy once filled.
 */
export type OrgViewProps = {
  orgUnits: ProjectOrgUnit[];
  team: ProjectTeamMember[];
  /** 默认 true。放进工作台的「组织与职责」Sheet 时传 false：标题与可访问名称由 SheetTitle 给。 */
  showHeading?: boolean;
};

export function OrgView({ orgUnits, team, showHeading = true }: OrgViewProps) {
  const nodes = flattenOrgUnits(orgUnits);
  const name = (id: number | null) => (id ? (team.find((m) => m.userId === id)?.nickname ?? null) : null);
  const unplaced = team.filter((m) => !m.orgUnitId && m.projectRole !== "consultant");
  return (
    <section aria-labelledby={showHeading ? "org" : undefined} className="flex flex-col gap-3">
      {showHeading ? (
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 id="org" className="font-heading text-lg font-bold text-brand">
            ③ 组织与职责
          </h2>
          <span className="text-xs text-muted-foreground">
            由企业管理员、企业项目负责人、咨询师在这里维护。责任分工矩阵、部门承接、部门计划书会用到这里的部门；表定版后保留当时的部门，组织再变只提示、不自动改。
          </span>
        </div>
      ) : null}
      {nodes.length === 0 ? (
        <EmptyState text="还没有组织部门。定目标责的责任分工和部门承接要先有部门，请企业项目负责人或企业管理员建好。" />
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {nodes.map((node) => {
            const members = team.filter((m) => m.orgUnitId === node.id);
            const head = name(node.headId);
            return (
              <li key={node.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm last:border-b-0">
                <span style={{ paddingLeft: `${node.depth * 1.5}rem` }} className="flex min-w-0 items-center gap-2">
                  {node.kind === "company" ? <Building2 className="size-4 text-muted-foreground" /> : <Network className="size-4 text-muted-foreground" />}
                  <span className="font-medium">{node.name}</span>
                  <Badge variant="outline">{orgKindLabel(node)}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  负责人：{head ?? (node.headId ? "（不在本项目）" : node.headName ? `${node.headName}（无账号）` : "未设")}
                </span>
                {members.length ? (
                  <span className="ml-auto flex flex-wrap gap-1">
                    {members.map((m) => (
                      <Badge key={m.userId} variant="secondary" className="gap-1 font-normal">
                        <UserRound className="size-3" /> {m.nickname} · {PROJECT_ROLE_LABELS[m.projectRole]}
                      </Badge>
                    ))}
                  </span>
                ) : null}
                {node.duty ? (
                  <p className="w-full text-xs text-muted-foreground" style={{ paddingLeft: `${node.depth * 1.5 + 1.5}rem` }}>
                    职责：{node.duty}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {unplaced.length ? (
        <p className="text-xs text-[color:var(--dz-warn)]">
          还没归到部门的项目成员：{unplaced.map((m) => m.nickname).join("、")}（运营在“项目与分派”里设置所属部门）
        </p>
      ) : null}
    </section>
  );
}
