import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type CompanyPlanBook, type DeptPlanBook, emptyPlanBookText } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/dingze/errors";
import { downloadPlanBookDocx } from "@/lib/dingze/export/docx";
import type { ProjectSummary } from "@/lib/dingze/api";
import { planBookProvenance } from "@/lib/dingze/plan-book-provenance";
import { type ExportInfo, getPlanBookSources } from "@/lib/dingze/records-api";
import { type PlanBookUpstream, buildCompanyPlanBook, buildDeptPlanBook, deptText } from "@/lib/dingze/plan-book";

const safe = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_");

/**
 * Plan books (S3-07 / S3-08) export to Word. The server picks the version: the locked one with the
 * exact upstream versions recorded when it was locked (验收 D01), otherwise the saved draft. S3-08
 * writes one file per department. Every file carries a 版本与来源 page.
 */
export function PlanBookExportButton({
  code,
  project,
  rev,
  enterprise,
  year,
  dirty,
  onExported,
  variant = "outline",
  size = "default",
  label,
}: {
  code: string;
  project: Pick<ProjectSummary, "id" | "name" | "spaceName">;
  /** Hides the button until there is a saved version. */
  rev: number;
  enterprise: string;
  year: number;
  dirty: boolean;
  onExported?: (info: ExportInfo) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  if ((code !== "S3-07" && code !== "S3-08") || rev === 0) return null;

  const run = async () => {
    setPending(true);
    try {
      const s = await getPlanBookSources(project.id, project.spaceName, code);
      const u = s.payloads as PlanBookUpstream;
      const draft = !s.locked;
      const provenance = planBookProvenance(s, { enterprise, year, name: project.name });
      if (code === "S3-07") {
        const text = (s.payload as CompanyPlanBook | null)?.text ?? emptyPlanBookText();
        const fileName = safe(`${enterprise}-${year}年度经营计划书-${draft ? "草稿" : "定版"}v${s.rev}.docx`);
        await downloadPlanBookDocx(fileName, { ...buildCompanyPlanBook({ enterprise, year, text, upstream: u }), provenance }, draft);
        onExported?.({ code, rev: s.rev, format: "docx", fileName, draft });
      } else {
        const depts = (s.payload as DeptPlanBook | null)?.depts ?? [];
        if (depts.length === 0) {
          toast.info("还没有部门计划书可导出");
          return;
        }
        for (const d of depts) {
          const { deptId, deptName } = d;
          const text = deptText(d);
          const fileName = safe(`${enterprise}-${deptName}-${year}年度经营计划书-${draft ? "草稿" : "定版"}v${s.rev}.docx`);
          await downloadPlanBookDocx(fileName, { ...buildDeptPlanBook({ enterprise, year, dept: { deptId, deptName }, text, upstream: u }), provenance }, draft);
          onExported?.({ code, rev: s.rev, format: "docx", fileName, draft });
        }
      }
      if (s.locked && s.stale) toast.info(`导出的是定版 v${s.rev} 批准时的内容；之后上游的改动不在文件里`);
      else if (dirty) toast.info("已导出最近一次保存的版本，未保存的修改不在文件里");
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={run} disabled={pending}>
      <FileText /> {pending ? "导出中…" : (label ?? "导出 Word")}
    </Button>
  );
}
