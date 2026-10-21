import { Plus, Tent } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/dingze/errors";
import { useCamps } from "@/lib/dingze/ops-queries";

import { CampFormDialog } from "./components/camp-dialogs";
import { CAMP_STATUS_LABELS } from "./components/labels";
import { OpsPageHeader } from "./components/page-header";

export default function CampsPage() {
  const camps = useCamps();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-6">
      <OpsPageHeader
        title="训练营批次"
        description="按期组织训练营：批量加企业、批量发账号，营前看准备情况，现场看各企业进度，结营后转为企业内训继续做。"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> 新建批次
          </Button>
        }
      />
      {camps.error ? (
        <Alert variant="destructive">
          <AlertTitle>批次加载失败</AlertTitle>
          <AlertDescription>{errorMessage(camps.error)}</AlertDescription>
        </Alert>
      ) : camps.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !camps.data?.length ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Tent />
            </EmptyMedia>
            <EmptyTitle>还没有训练营批次</EmptyTitle>
            <EmptyDescription>新建一期训练营后，可以批量加入企业并开通账号。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>批次</TableHead>
                <TableHead className="hidden sm:table-cell">日期</TableHead>
                <TableHead className="hidden md:table-cell">地点</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>企业项目</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {camps.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {c.startDate || "—"}
                    {c.endDate ? ` ～ ${c.endDate}` : ""}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{c.location || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "running" ? "default" : c.status === "closed" ? "secondary" : "outline"}>{CAMP_STATUS_LABELS[c.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.projectCount ?? 0} 个</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" nativeButton={false} render={<Link to={`/ops/camps/${c.id}`} />}>
                      进入
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {creating ? <CampFormDialog open onClose={() => setCreating(false)} onSaved={(c) => navigate(`/ops/camps/${c.id}`)} /> : null}
    </div>
  );
}
