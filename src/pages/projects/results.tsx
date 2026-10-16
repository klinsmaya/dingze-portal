import { useSearchParams } from "react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ArtifactsPage from "./artifacts";
import DeliveryPage from "./delivery";

const PROCESS_TABS = ["list", "tables", "records"] as const;
type ProcessTab = (typeof PROCESS_TABS)[number];

/**
 * 成果（2026-10-16 调整）：先突出交付成果——年度经营计划书（公司 / 部门）和各部门绩效计分卡；
 * 其次是过程资料与成果——每张表的状态、版本与历史，单表 Excel / 图片导出，导出记录。
 */
export default function ResultsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: ProcessTab = PROCESS_TABS.includes(raw as ProcessTab) ? (raw as ProcessTab) : "list";
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand">成果</h1>
        <p className="mt-1 text-sm text-muted-foreground">先看交付成果：年度经营计划书和各部门绩效计分卡；往下是过程资料与成果：每张表的状态、版本和修改记录，单张表的导出，导出记录。</p>
      </div>

      <section aria-labelledby="deliver" className="flex flex-col gap-3">
        <h2 id="deliver" className="font-heading text-lg font-bold text-brand">
          交付成果
        </h2>
        <DeliveryPage embedded part="deliver" />
      </section>

      <section aria-labelledby="process" className="flex flex-col gap-3 border-t pt-5">
        <div>
          <h2 id="process" className="font-heading text-lg font-bold text-brand">
            过程资料与成果
          </h2>
          <p className="text-sm text-muted-foreground">三阶段每张表的定版状态、版本与历史（可查看任意一版、对比），以及单张表的 Excel、任务书 Word、战略图 / 解码地图图片。</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setParams(v === "list" ? {} : { tab: String(v) }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="list">成果清单</TabsTrigger>
            <TabsTrigger value="tables">单表与图片导出</TabsTrigger>
            <TabsTrigger value="records">导出记录</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="pt-3">
            <ArtifactsPage embedded />
          </TabsContent>
          <TabsContent value="tables" className="pt-3">
            <DeliveryPage embedded part="tables" />
          </TabsContent>
          <TabsContent value="records" className="pt-3">
            <DeliveryPage embedded part="records" />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
