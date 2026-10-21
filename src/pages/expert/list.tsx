import { MessagesSquare } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import { useExpertRequests } from "@/lib/dingze/expert-api";

import { ExpertRequestTable } from "./components/request-list";

/** 专家咨询: every request the caller may see, across their projects (or the ones assigned to them). */
export default function ExpertListPage() {
  const requests = useExpertRequests();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand">专家咨询</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          战略取舍、路径合理性、责任冲突、资源约束等关键问题，由人工咨询师受理、预约沟通并给出意见。在项目的“专家咨询”页发起申请。
        </p>
      </div>
      {requests.error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{errorMessage(requests.error)}</AlertDescription>
        </Alert>
      ) : requests.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !requests.data?.length ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquare />
            </EmptyMedia>
            <EmptyTitle>还没有专家咨询</EmptyTitle>
            <EmptyDescription>进入项目，在“专家咨询”页提出需要人工判断的问题。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ExpertRequestTable rows={requests.data} showProject />
      )}
    </div>
  );
}
