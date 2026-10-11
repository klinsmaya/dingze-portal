import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ArtifactStatus, type CompanyPlanBook, type DeptPlanBook, emptyPlanBookText } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/dingze/errors";
import { downloadPlanBookDocx } from "@/lib/dingze/export/docx";
import type { ExportInfo } from "@/lib/dingze/records-api";
import { type PlanBookUpstream, buildCompanyPlanBook, buildDeptPlanBook, deptText } from "@/lib/dingze/plan-book";

const safe = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_");

/** Plan books (S3-07 / S3-08) export to Word from the saved version; S3-08 writes one file per department. */
export function PlanBookExportButton({
  code,
  payload,
  rev,
  status,
  enterprise,
  year,
  upstream,
  dirty,
  onExported,
  variant = "outline",
  size = "default",
  label,
}: {
  code: string;
  payload: unknown;
  rev: number;
  status: ArtifactStatus;
  enterprise: string;
  year: number;
  upstream: Record<string, unknown>;
  dirty: boolean;
  onExported?: (info: ExportInfo) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  if ((code !== "S3-07" && code !== "S3-08") || rev === 0 || !payload) return null;
  const u = upstream as PlanBookUpstream;
  const draft = status !== "locked";

  const run = async () => {
    setPending(true);
    try {
      if (code === "S3-07") {
        const text = (payload as CompanyPlanBook).text ?? emptyPlanBookText();
        const fileName = safe(`${enterprise}-${year}年度经营计划书-v${rev}.docx`);
        await downloadPlanBookDocx(fileName, buildCompanyPlanBook({ enterprise, year, text, upstream: u }), draft);
        onExported?.({ code, rev, format: "docx", fileName, draft });
      } else {
        const depts = (payload as DeptPlanBook).depts ?? [];
        if (depts.length === 0) {
          toast.info("还没有部门计划书可导出");
          return;
        }
        for (const d of depts) {
          const { deptId, deptName } = d;
          const text = deptText(d);
          const fileName = safe(`${enterprise}-${deptName}-${year}年度经营计划书-v${rev}.docx`);
          await downloadPlanBookDocx(fileName, buildDeptPlanBook({ enterprise, year, dept: { deptId, deptName }, text, upstream: u }), draft);
          onExported?.({ code, rev, format: "docx", fileName, draft });
        }
      }
      if (dirty) toast.info("已导出最近一次保存的版本，未保存的修改不在文件里");
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
