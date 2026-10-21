import { MessagesSquare, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ARTIFACTS, EXPERT_TOPICS, type ExpertTopic, canRequestExpert } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/dingze/errors";
import { useCreateExpertRequest, useExpertRequests } from "@/lib/dingze/expert-api";
import { ExpertRequestTable } from "@/pages/expert/components/request-list";

import { useProjectContext } from "./project-context";

function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { project, overview } = useProjectContext();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<ExpertTopic>("tradeoff");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const create = useCreateExpertRequest(project);
  const locked = ARTIFACTS.filter((a) => overview.artifacts.some((x) => x.code === a.code && x.status === "locked"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>申请专家咨询</DialogTitle>
          <DialogDescription>由人工咨询师受理并预约沟通。勾选的已定版成果会授权给承接专家查阅（以申请时的定版为准），避免重复收集信息。</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expert-topic">议题类型</Label>
              <NativeSelect id="expert-topic" value={topic} onChange={(e) => setTopic(e.target.value as ExpertTopic)}>
                {Object.entries(EXPERT_TOPICS).map(([key, label]) => (
                  <NativeSelectOption key={key} value={key}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expert-title">议题（必填）</Label>
              <Input id="expert-title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="一句话说清要判断的问题" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expert-question">问题描述（必填）</Label>
            <Textarea id="expert-question" value={question} onChange={(e) => setQuestion(e.target.value)} className="min-h-28" placeholder="背景、分歧点、你倾向的做法和顾虑。" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">授权专家查阅的已定版成果</legend>
            {locked.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有已定版的成果，可以先不引用。</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {locked.map((a) => (
                  <label key={a.code} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={refs.includes(a.code)} onCheckedChange={(on) => setRefs(on ? [...refs, a.code] : refs.filter((c) => c !== a.code))} />
                    <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                    {a.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!title.trim() || !question.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { topic, title: title.trim(), question: question.trim(), refs },
                {
                  onSuccess: ({ id }) => {
                    toast.success("已提交，咨询管理员受理后会通知你");
                    navigate(`/expert/${id}`);
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                }
              )
            }
          >
            提交申请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The project's expert requests, and where new ones are filed. */
export default function ProjectExpertPage() {
  const { project, overview } = useProjectContext();
  const requests = useExpertRequests(project.id);
  const [open, setOpen] = useState(false);
  const canRequest = canRequestExpert(project.projectRole, overview.isConsultAdmin);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand">专家咨询</h1>
          <p className="mt-1 text-sm text-muted-foreground">战略取舍、路径合理性、责任冲突、资源约束等需要人工判断的问题。年度经营计划质询在线下进行。</p>
          {(overview.project.service ?? project.service) === "self" ? (
            <p className="mt-1 text-sm font-medium text-[color:var(--dz-warn)]">这是自助项目：专家咨询需付费，提交后由运营联系你报价，确认后再受理。</p>
          ) : null}
        </div>
        {canRequest ? (
          <Button onClick={() => setOpen(true)}>
            <Plus /> 申请专家咨询
          </Button>
        ) : null}
      </div>
      {requests.error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{errorMessage(requests.error)}</AlertDescription>
        </Alert>
      ) : requests.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !requests.data?.length ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquare />
            </EmptyMedia>
            <EmptyTitle>还没有咨询申请</EmptyTitle>
            <EmptyDescription>遇到方法流程解决不了的关键分歧时，申请专家咨询。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ExpertRequestTable rows={requests.data} showProject={false} />
      )}
      {open ? <NewRequestDialog open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}
