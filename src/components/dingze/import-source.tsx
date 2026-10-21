import { Download, FileUp } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type ImportTemplate, downloadTemplate, readTableFile } from "@/lib/dingze/import-templates";

/** 导入的来源：下载 Excel 模板，或直接上传填好的表；也可以在下面的框里粘贴。 */
export function ImportSource({ template, onText }: { template: ImportTemplate; onText: (text: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Button type="button" size="sm" variant="outline" onClick={() => downloadTemplate(template).catch(() => toast.error("模板生成失败"))}>
        <Download /> 下载模板
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => file.current?.click()}>
        <FileUp /> 上传填好的 Excel
      </Button>
      <span>或在 Excel 里选中这些列复制，粘贴到下面。</span>
      <input
        ref={file}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        aria-label="上传填好的 Excel"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            onText(await readTableFile(f));
          } catch {
            toast.error("读不了这个文件，请另存为 xlsx 后再试");
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
