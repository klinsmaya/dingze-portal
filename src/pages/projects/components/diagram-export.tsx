import { ChevronDown, ImageDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { STATUS_LABELS, type ArtifactStatus } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadDiagram } from "@/lib/dingze/diagram-image";
import { artifactDiagrams } from "@/lib/dingze/diagram-svg";
import { errorMessage } from "@/lib/dingze/errors";
import type { ExportInfo } from "@/lib/dingze/records-api";

/** Saves the saved version's diagram as SVG or PNG; drafts carry 草稿 in the subtitle. */
export function DiagramExportButton({
  code,
  name,
  payload,
  rev,
  status,
  enterprise,
  dirty,
  onExported,
  variant = "outline",
  size = "default",
}: {
  code: string;
  name: string;
  payload: unknown;
  rev: number;
  status: ArtifactStatus;
  enterprise: string;
  dirty: boolean;
  onExported?: (info: ExportInfo) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const [pending, setPending] = useState(false);
  const available = artifactDiagrams(code, payload);
  if (rev === 0 || available.length === 0) return null;
  const draft = status !== "locked";

  const run = async (key: string, format: "svg" | "png") => {
    setPending(true);
    try {
      const subtitle = `${enterprise} · ${STATUS_LABELS[status]} v${rev}${draft ? " · 草稿（未定版，仅供讨论）" : ""}`;
      const { label, diagram } = artifactDiagrams(code, payload, subtitle).find((d) => d.key === key)!;
      const baseName = `${enterprise}-${code}-${available.length > 1 ? label : name}-v${rev}`.replace(/[\\/:*?"<>|]/g, "_");
      await downloadDiagram(diagram, baseName, format);
      onExported?.({ code, rev, format, fileName: `${baseName}.${format}`, draft });
      if (dirty) toast.info("已导出最近一次保存的版本，未保存的修改不在图片里");
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant={variant} size={size} disabled={pending}>
            <ImageDown /> {pending ? "导出中…" : "导出图片"} <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        {available.flatMap((d) =>
          (["png", "svg"] as const).map((format) => (
            <DropdownMenuItem key={`${d.key}-${format}`} onClick={() => run(d.key, format)}>
              {available.length > 1 ? `${d.label} · ` : ""}
              {format === "png" ? "PNG 图片（汇报、文档）" : "SVG 矢量图（可再编辑）"}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
