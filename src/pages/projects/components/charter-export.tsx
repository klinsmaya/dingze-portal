import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ArtifactStatus, type ProjectCharterSet } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/dingze/errors";
import { downloadPlanBookDocx } from "@/lib/dingze/export/docx";
import { buildCharterBook } from "@/lib/dingze/plan-book";
import type { ExportInfo } from "@/lib/dingze/records-api";

const safe = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_");

/** S3-02 项目任务书 as its own Word file (验收 D08), from the saved version; drafts are marked. */
export function CharterDocxButton({
  code,
  payload,
  rev,
  status,
  enterprise,
  projectName,
  year,
  dirty,
  onExported,
  variant = "outline",
  size = "default",
}: {
  code: string;
  payload: unknown;
  rev: number;
  status: ArtifactStatus;
  enterprise: string;
  projectName: string;
  year: number;
  dirty: boolean;
  onExported?: (info: ExportInfo) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const [pending, setPending] = useState(false);
  if (code !== "S3-02" || rev === 0 || !payload) return null;
  const draft = status !== "locked";
  const run = async () => {
    setPending(true);
    try {
      const fileName = safe(`${enterprise}-${year}年度项目任务书-${draft ? "草稿" : "定版"}v${rev}.docx`);
      const model = buildCharterBook({ enterprise, year, charters: (payload as ProjectCharterSet).charters ?? [] });
      await downloadPlanBookDocx(
        fileName,
        {
          ...model,
          provenance: {
            lines: [
              `项目：${enterprise} · ${projectName}（${year} 年度）`,
              `本文件：${draft ? `草稿 v${rev}（未定版，仅供讨论）` : `定版 v${rev}`}`,
              `生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
            ],
            sources: [],
          },
        },
        draft,
      );
      onExported?.({ code, rev, format: "docx", fileName, draft });
      if (dirty) toast.info("已导出最近一次保存的版本，未保存的修改不在文件里");
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    } finally {
      setPending(false);
    }
  };
  return (
    <Button variant={variant} size={size} onClick={run} disabled={pending}>
      <FileText /> {pending ? "导出中…" : "导出 Word"}
    </Button>
  );
}
