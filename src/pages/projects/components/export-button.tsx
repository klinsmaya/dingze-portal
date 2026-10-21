import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { STATUS_LABELS, type ArtifactStatus } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { artifactSheets } from "@/lib/dingze/export/sheets";
import { downloadXlsx, exportFileName } from "@/lib/dingze/export/xlsx";
import { errorMessage } from "@/lib/dingze/errors";
import type { ExportInfo } from "@/lib/dingze/records-api";

/**
 * Exports the saved version (not unsaved edits) to Excel. Anything short of 已定版 is
 * marked as a draft in the file so it is never mistaken for the confirmed table.
 */
export function ExportButton({
  code,
  name,
  payload,
  rev,
  status,
  enterprise,
  projectName,
  upstream,
  dirty,
  onExported,
  label = "导出 Excel",
  variant = "outline",
  size = "default",
}: {
  code: string;
  name: string;
  payload: unknown;
  rev: number;
  status: ArtifactStatus;
  enterprise: string;
  projectName: string;
  upstream: Record<string, unknown>;
  dirty: boolean;
  onExported?: (info: ExportInfo) => void;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const [pending, setPending] = useState(false);
  const sheets = artifactSheets(code, payload, upstream);
  if (sheets.length === 0 || rev === 0) return null;

  const run = async () => {
    setPending(true);
    try {
      const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
      const fileName = exportFileName(enterprise, code, name, rev);
      await downloadXlsx(
        fileName,
        {
          title: `《${name}》`,
          subtitle: `${enterprise} · ${projectName} · ${STATUS_LABELS[status]} v${rev} · 导出于 ${stamp}`,
          draft: status !== "locked",
        },
        sheets
      );
      onExported?.({ code, rev, format: "xlsx", fileName, draft: status !== "locked" });
      if (dirty) toast.info("已导出最近一次保存的版本，未保存的修改不在文件里");
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={run} disabled={pending}>
      <FileSpreadsheet /> {pending ? "导出中…" : label}
    </Button>
  );
}
