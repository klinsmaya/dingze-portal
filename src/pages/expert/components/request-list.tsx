import { Link } from "react-router";

import { EXPERT_STATUSES, EXPERT_TOPICS, type ExpertStatus } from "@dingze/shared";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExpertRequestSummary } from "@/lib/dingze/expert-api";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ExpertStatus, string> = {
  submitted: "border-gold text-brand",
  accepted: "border-brand text-brand",
  scheduled: "border-brand bg-brand/10 text-brand",
  answered: "border-status-done-foreground text-status-done-foreground",
  closed: "text-muted-foreground",
  cancelled: "text-muted-foreground line-through",
};

export function ExpertStatusBadge({ status }: { status: ExpertStatus }) {
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_TONE[status])}>
      {EXPERT_STATUSES[status] ?? status}
    </Badge>
  );
}

export function ExpertRequestTable({ rows, showProject }: { rows: ExpertRequestSummary[]; showProject: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>议题</TableHead>
            {showProject ? <TableHead>企业 / 项目</TableHead> : null}
            <TableHead>状态</TableHead>
            <TableHead className="hidden md:table-cell">申请人</TableHead>
            <TableHead className="hidden md:table-cell">专家</TableHead>
            <TableHead className="hidden lg:table-cell">沟通时间</TableHead>
            <TableHead className="hidden lg:table-cell">申请时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link to={`/expert/${r.id}`} className="font-medium text-brand hover:underline">
                  {r.title}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {EXPERT_TOPICS[r.topic] ?? r.topic}
                  {r.refs.length ? ` · 引用 ${r.refs.join("、")}` : ""}
                </div>
              </TableCell>
              {showProject ? (
                <TableCell className="text-sm">
                  <div className="text-xs text-muted-foreground">{r.enterprise}</div>
                  {r.projectName}
                </TableCell>
              ) : null}
              <TableCell>
                <ExpertStatusBadge status={r.status} />
              </TableCell>
              <TableCell className="hidden text-sm md:table-cell">{r.applicant || "—"}</TableCell>
              <TableCell className="hidden text-sm md:table-cell">{r.expert || "待分派"}</TableCell>
              <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{formatTime(r.scheduledAt)}</TableCell>
              <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{formatTime(r.at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
