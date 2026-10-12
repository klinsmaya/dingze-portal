import { useSearchParams } from "react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ArtifactsPage from "./artifacts";
import DeliveryPage from "./delivery";

/**
 * 成果 (闭环第一批): one place for what the project produced — the 成果清单 (state, versions,
 * history, compare) and the 交付包 (计划书 Word, Excel, images, export records).
 */
export default function ResultsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "delivery" ? "delivery" : "list";
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand">成果</h1>
        <p className="mt-1 text-sm text-muted-foreground">每张表的状态、版本和修改记录在“成果清单”；计划书 Word、Excel 和图片在“交付包”。定版的表同时进入资料里的“已确认成果”。</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams(v === "delivery" ? { tab: "delivery" } : {}, { replace: true })}>
        <TabsList>
          <TabsTrigger value="list">成果清单</TabsTrigger>
          <TabsTrigger value="delivery">交付包</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="pt-3">
          <ArtifactsPage embedded />
        </TabsContent>
        <TabsContent value="delivery" className="pt-3">
          <DeliveryPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
