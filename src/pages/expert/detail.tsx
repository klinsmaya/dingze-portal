import { ArrowLeft, CalendarClock, FileCheck2, UserRoundCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { EXPERT_TOPICS, type ExpertAction } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/dingze/errors";
import { type ExpertRequestDetail, useExpertAction, useExpertRequest } from "@/lib/dingze/expert-api";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

import { CitationTables } from "./components/citation";
import { ExpertStatusBadge } from "./components/request-list";

/** `datetime-local` value for a stored time, in the viewer's time zone. */
function localInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-brand [&_svg]:size-4">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Actions({ request }: { request: ExpertRequestDetail }) {
  const act = useExpertAction();
  const [expertId, setExpertId] = useState(request.expertId ? String(request.expertId) : "");
  const [scheduledAt, setScheduledAt] = useState(localInput(request.scheduledAt));
  const [channel, setChannel] = useState(request.channel);
  const [minutes, setMinutes] = useState(request.minutes);
  const [opinion, setOpinion] = useState(request.opinion);
  const [note, setNote] = useState("");
  const run = (action: ExpertAction, values: Record<string, unknown>, done: string) =>
    act.mutate(
      { id: request.id, action, ...values },
      { onSuccess: () => toast.success(done), onError: (error) => toast.error(errorMessage(error)) }
    );
  const { can } = request;
  if (!Object.values(can).some(Boolean)) return null;

  return (
    <div className="flex flex-col gap-4">
      {can.assign ? (
        <Section title={request.expertId ? "改派专家" : "受理并分派"} icon={<UserRoundCheck />}>
          {request.candidates.length ? (
            <>
              <NativeSelect aria-label="承接专家" value={expertId} onChange={(e) => setExpertId(e.target.value)}>
                <NativeSelectOption value="">选择本企业空间里的咨询师…</NativeSelectOption>
                {request.candidates.map((c) => (
                  <NativeSelectOption key={c.id} value={String(c.id)}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button disabled={!expertId || act.isPending} onClick={() => run("assign", { expertId: Number(expertId) }, "已分派，已通知专家和申请人")}>
                {request.expertId ? "改派" : "受理并分派"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">本企业空间里还没有咨询师。先在“运营管理 › 企业与开通”里把咨询师加为企业成员。</p>
          )}
        </Section>
      ) : null}

      {can.schedule ? (
        <Section title="预约沟通" icon={<CalendarClock />}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expert-at">时间</Label>
            <Input id="expert-at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expert-channel">方式 / 地点</Label>
            <Input id="expert-channel" value={channel} maxLength={200} onChange={(e) => setChannel(e.target.value)} placeholder="如：腾讯会议号、会议室" />
          </div>
          <Button
            disabled={!scheduledAt || act.isPending}
            onClick={() => run("schedule", { scheduledAt: new Date(scheduledAt).toISOString(), channel: channel.trim() }, "已预约，已通知申请人")}
          >
            {request.scheduledAt ? "更新预约" : "预约"}
          </Button>
        </Section>
      ) : null}

      {can.answer ? (
        <Section title="纪要与专家意见" icon={<FileCheck2 />}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expert-minutes">会议纪要</Label>
            <Textarea id="expert-minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="min-h-28" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expert-opinion">专家意见（必填）</Label>
            <Textarea id="expert-opinion" value={opinion} onChange={(e) => setOpinion(e.target.value)} className="min-h-28" placeholder="结论、理由，以及建议调整的成果和下一步。" />
          </div>
          <Button disabled={!opinion.trim() || act.isPending} onClick={() => run("answer", { minutes: minutes.trim(), opinion: opinion.trim() }, "意见已提交，已通知申请人和企业项目负责人")}>
            {request.opinion ? "更新意见" : "提交意见"}
          </Button>
        </Section>
      ) : null}

      {can.close || can.cancel ? (
        <Section title={can.close ? "确认收到并关闭" : "撤回申请"}>
          <Textarea aria-label={can.close ? "关闭说明" : "撤回原因"} value={note} onChange={(e) => setNote(e.target.value)} placeholder={can.close ? "如何采纳（选填），例如：纳入下季度复盘。" : "撤回原因（选填）"} className="min-h-16" />
          {can.close ? (
            <Button disabled={act.isPending} onClick={() => run("close", { closeNote: note.trim() }, "已关闭")}>
              确认并关闭
            </Button>
          ) : (
            <Button variant="outline" disabled={act.isPending} onClick={() => run("cancel", { closeNote: note.trim() }, "已撤回")}>
              撤回申请
            </Button>
          )}
        </Section>
      ) : null}
    </div>
  );
}

export default function ExpertDetailPage() {
  const { requestId } = useParams();
  const request = useExpertRequest(Number(requestId) || 0);
  const r = request.data;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/expert" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" /> 专家咨询
      </Link>
      {request.error ? (
        <Alert variant="destructive">
          <AlertTitle>打不开这条咨询</AlertTitle>
          <AlertDescription>{errorMessage(request.error)}</AlertDescription>
        </Alert>
      ) : request.isLoading || !r ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">
              {r.enterprise} · {r.projectName} · {EXPERT_TOPICS[r.topic] ?? r.topic}
            </div>
            <h1 className="flex flex-wrap items-center gap-3 font-heading text-2xl font-bold text-brand">
              {r.title} <ExpertStatusBadge status={r.status} />
            </h1>
            <div className="text-xs text-muted-foreground">
              {r.applicant || "—"} 申请于 {formatTime(r.at)} · 专家：{r.expert || "待分派"}
              {r.scheduledAt ? ` · 沟通：${formatTime(r.scheduledAt)}${r.channel ? `（${r.channel}）` : ""}` : ""}
            </div>
          </div>

          <div className={cn("grid gap-6", Object.values(r.can).some(Boolean) && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
            <div className="flex flex-col gap-4">
              <Section title="问题">
                <p className="text-sm whitespace-pre-wrap">{r.question}</p>
              </Section>
              {r.opinion || r.minutes ? (
                <Section title="专家意见" icon={<FileCheck2 />}>
                  {r.opinion ? <p className="rounded-lg border-l-4 border-gold bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">{r.opinion}</p> : null}
                  {r.minutes ? (
                    <div>
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">会议纪要</div>
                      <p className="text-sm whitespace-pre-wrap">{r.minutes}</p>
                    </div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">给出于 {formatTime(r.answeredAt)}</div>
                </Section>
              ) : null}
              {r.status === "closed" || r.status === "cancelled" ? (
                <Section title={r.status === "closed" ? "已关闭" : "已撤回"}>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {formatTime(r.closedAt)}
                    {r.closeNote ? `：${r.closeNote}` : ""}
                  </p>
                </Section>
              ) : null}
              <Section title={`授权查阅的定版成果（${r.citations.length}）`}>
                {r.citations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">申请时没有引用成果。</p>
                ) : (
                  r.citations.map((c) => (
                    <details key={c.code} className="rounded-lg border px-3 py-2" open={r.citations.length === 1}>
                      <summary className="cursor-pointer text-sm font-medium">
                        <span className="font-mono text-xs text-muted-foreground">{c.code}</span> {c.name}
                        <span className="ml-2 text-xs text-muted-foreground">定版 v{c.rev}</span>
                      </summary>
                      <div className="mt-3">{c.payload ? <CitationTables code={c.code} payload={c.payload} upstream={r.upstream} /> : <p className="text-sm text-muted-foreground">版本已不可用。</p>}</div>
                    </details>
                  ))
                )}
              </Section>
            </div>
            <Actions key={`${r.status}-${r.expertId}`} request={r} />
          </div>
        </>
      )}
    </div>
  );
}
