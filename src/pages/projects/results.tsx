import { useSearchParams } from "react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ArtifactsPage from "./artifacts";
import DeliveryPage from "./delivery";

const TABS = ["deliver", "list", "tables", "records"] as const;
type ResultsTab = (typeof TABS)[number];

/** 成果：交付成果（计划书、计分卡）、成果清单、单表与图片导出、导出记录四个页签，页签固定在标题旁。 */
export default function ResultsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: ResultsTab = TABS.includes(raw as ResultsTab) ? (raw as ResultsTab) : "deliver";
  return (
    <Tabs value={tab} onValueChange={(v) => setParams(v === "deliver" ? {} : { tab: String(v) }, { replace: true })} className="flex w-full flex-col gap-0">
      <div className="sticky top-0 z-20 border-b bg-background shadow-[0_1px_0_var(--border)]">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-end gap-x-6 gap-y-2 px-4 pt-4 md:px-6">
          <h1 className="pb-2 font-heading text-2xl font-bold text-brand">成果</h1>
          <TabsList variant="line" className="h-auto flex-wrap gap-1 p-0">
            <TabsTrigger value="deliver" className="px-3 py-2 font-semibold">
              交付成果
            </TabsTrigger>
            <TabsTrigger value="list" className="px-3 py-2">
              成果清单
            </TabsTrigger>
            <TabsTrigger value="tables" className="px-3 py-2">
              单表与图片导出
            </TabsTrigger>
            <TabsTrigger value="records" className="px-3 py-2">
              导出记录
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <TabsContent value="deliver">
          <DeliveryPage embedded part="deliver" />
        </TabsContent>
        <TabsContent value="list">
          <ArtifactsPage embedded />
        </TabsContent>
        <TabsContent value="tables">
          <DeliveryPage embedded part="tables" />
        </TabsContent>
        <TabsContent value="records">
          <DeliveryPage embedded part="records" />
        </TabsContent>
      </div>
    </Tabs>
  );
}
