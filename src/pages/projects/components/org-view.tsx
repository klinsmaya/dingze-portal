import { Building2, Network, UserRound } from "lucide-react";
import { Link } from "react-router";

import { PROJECT_ROLE_LABELS } from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import type { ProjectOrgUnit, ProjectTeamMember } from "@/lib/dingze/api";
import { flattenOrgUnits } from "@/lib/dingze/org-units";

const KIND = { company: "公司", department: "部门", team: "团队" } as const;

/**
 * 组织与职责 (闭环第一批): the enterprise's departments as the project sees them — who heads each
 * one and which project members sit in it. Maintained by the enterprise admin in 「本企业」; the
 * tables that use departments (RACI, 部门承接, 部门计划书) keep their own copy once filled.
 */
export function OrgView({ orgUnits, team }: { orgUnits: ProjectOrgUnit[]; team: ProjectTeamMember[] }) {
  const nodes = flattenOrgUnits(orgUnits);
  const name = (id: number | null) => (id ? (team.find((m) => m.userId === id)?.nickname ?? null) : null);
  const unplaced = team.filter((m) => !m.orgUnitId && m.projectRole !== "lead_consultant" && m.projectRole !== "co_consultant");
  return (
    <section aria-labelledby="org" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="org" className="font-heading text-lg font-bold text-brand">
          组织与职责
        </h2>
        <span className="text-xs text-muted-foreground">
          由企业管理员在
          <Link to="/enterprise" className="mx-1 text-primary hover:underline">
            「本企业 › 组织部门」
          </Link>
          维护。责任分工矩阵、部门承接、部门计划书会用到这里的部门；表定版后保留当时的部门，组织再变只提示、不自动改。
        </span>
      </div>
      {nodes.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          还没有组织部门。定目标责的责任分工和部门承接要先有部门，请企业管理员建好。
        </p>
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
                  <Badge variant="outline">{KIND[node.kind]}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">负责人：{head ?? (node.headId ? "（不在本项目）" : <span className="text-[color:var(--dz-warn)]">未设</span>)}</span>
                {members.length ? (
                  <span className="ml-auto flex flex-wrap gap-1">
                    {members.map((m) => (
                      <Badge key={m.userId} variant="secondary" className="gap-1 font-normal">
                        <UserRound className="size-3" /> {m.nickname} · {PROJECT_ROLE_LABELS[m.projectRole]}
                      </Badge>
                    ))}
                  </span>
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
