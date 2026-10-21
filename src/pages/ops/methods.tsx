import { Bot, Lock } from "lucide-react";
import { useSearchParams } from "react-router";

import { ARTIFACTS, STAGES, bookNote } from "@dingze/shared";

import { BookMethod } from "@/pages/projects/components/book-method";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAI } from "@/extensions/nocobase-ai/providers";
import { COACHES } from "@/lib/dingze/coach";
import { useGuidanceGaps } from "@/lib/dingze/guidance-api";

import { GuidanceGapsSection } from "./components/guidance-gaps";
import { OpsPageHeader } from "./components/page-header";

const PRIORITY_LABELS = { P0: "必做", P1: "选做", method: "方法底稿" } as const;

/** The artifact catalog and consultants that ship with the plugin (read-only), and the guidance gaps under review. */
export default function MethodsPage() {
  const [params, setParams] = useSearchParams();
  const gaps = useGuidanceGaps();
  const open = (gaps.data ?? []).filter((g) => g.status === "open").length;
  const tab = params.get("tab") === "gaps" ? "gaps" : "pack";

  return (
    <div className="flex flex-col gap-6">
      <OpsPageHeader
        title="方法与规则包"
        description="成果目录和数字咨询师的引导规则随定责插件发布；修改规则即发布新版插件，可回退。"
      />
      <Tabs value={tab} onValueChange={(v) => setParams(v === "gaps" ? { tab: "gaps" } : {}, { replace: true })}>
        <TabsList>
          <TabsTrigger value="pack">规则包</TabsTrigger>
          <TabsTrigger value="gaps">引导缺口{open ? ` · ${open}` : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value="pack" className="pt-4">
          <RulePack />
        </TabsContent>
        <TabsContent value="gaps" className="pt-4">
          <GuidanceGapsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RulePack() {
  const ai = useAI();
  const available = new Set(ai.employees.map((e) => e.username));

  return (
    <div className="flex flex-col gap-8">

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">数字咨询师</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {COACHES.map((coach) => (
            <Card key={coach.username}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-4" /> {coach.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span className="font-mono text-xs">{coach.username}</span>
                  {available.has(coach.username) ? (
                    <Badge className="bg-status-done text-status-done-foreground">已上线</Badge>
                  ) : (
                    <Badge variant="outline">当前账号不可用</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {coach.skills.map((skill) => (
                    <li key={skill.name}>
                      <div className="font-medium">{skill.name}</div>
                      <div className="text-muted-foreground">{skill.summary}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {STAGES.map((stage) => {
        const items = ARTIFACTS.filter((a) => a.stage === stage.key);
        return (
          <section key={stage.key} className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-bold">
              {stage.name} <span className="text-sm font-normal text-muted-foreground">· {stage.goal}</span>
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <ul>
                {items.map((a) => (
                  <li key={a.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 last:border-b-0">
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{a.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{a.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.task} › {a.step} · {a.bookRef}
                      </span>
                    </span>
                    {a.unlockAfter.length ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" /> {a.unlockAfter.join("、")}
                      </span>
                    ) : null}
                    <Badge variant={a.priority === "P0" ? "default" : "outline"}>{PRIORITY_LABELS[a.priority]}</Badge>
                    {bookNote(a.code) ? (
                      <details className="basis-full text-sm">
                        <summary className="cursor-pointer text-xs text-muted-foreground">书中方法：目的 · 怎么做 · 完成检查</summary>
                        <div className="mt-2 rounded-lg border border-book-border bg-book px-4 py-2 text-book-foreground">
                          <BookMethod def={a} />
                        </div>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
