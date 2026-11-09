import { MessagesSquare } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import { useExpertRequests } from "@/lib/dingze/expert-api";

import { ExpertRequestTable } from "./components/request-list";

/** 专家咨询: every request the caller may see, across their projects (or the ones assigned to them). */
export default function ExpertListPage() {
  const requests = useExpertRequests();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-brand">专家咨询</h1>
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
          </EmptyHeader>
        </Empty>
      ) : (
        <ExpertRequestTable rows={requests.data} showProject />
      )}
    </div>
  );
}
