import { useCallback } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import { SPREADSHEET_EXTENSIONS, UnsupportedFileError, extractText } from "@/lib/dingze/extract-text";
import { uploadOriginal, useAddMaterial, useMaterial } from "@/lib/dingze/materials-api";

import { useProjectContext } from "../project-context";

// 资料 used outside the 资料 page too: the workspace's 本步参考资料 and the chat's 上传资料.

/**
 * Upload files as project materials: the text is read in the browser for the digital
 * consultants and the original is stored as well. Returns the new materials.
 */
export function useMaterialUpload() {
  const { project } = useProjectContext();
  const add = useAddMaterial(project);
  return useCallback(
    async (files: FileList | File[] | null) => {
      const added: { id: number; title: string }[] = [];
      for (const file of Array.from(files ?? [])) {
        try {
          const text = await extractText(file).catch((error) => {
            if (error instanceof UnsupportedFileError) throw error;
            return "";
          });
          const original = await uploadOriginal(file);
          const title = file.name.replace(/\.[^.]+$/, "");
          const result = await add.mutateAsync({ title, kind: "file", fileName: file.name, size: file.size, text, fileId: original.id });
          added.push({ id: (result as { id?: number }).id ?? 0, title });
          if (!result.searchable) {
            toast.warning(
              SPREADSHEET_EXTENSIONS.some((e) => file.name.toLowerCase().endsWith(`.${e}`))
                ? `已上传《${file.name}》原件，但表格里没有内容可供检索`
                : `已上传《${file.name}》原件，但没有读到文字（可能是扫描件）：数字咨询师检索不到它，可以再“粘贴文字”补一份`
            );
          } else {
            toast.success(`已上传《${file.name}》原件并提取文字${result.truncated ? "（文字过长，检索只用前 15 万字）" : ""}`);
          }
        } catch (error) {
          toast.error(`《${file.name}》：${errorMessage(error)}`);
        }
      }
      return added;
    },
    [add]
  );
}

export function MaterialViewer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { project } = useProjectContext();
  const material = useMaterial(project, id);
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{material.data?.title ?? "资料"}</SheetTitle>
          <SheetDescription>
            资料编号 {id} · {material.data?.chars ?? 0} 字{material.data && material.data.chars > material.data.text.length ? "（显示前 20000 字）" : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 text-sm whitespace-pre-wrap">{material.isLoading ? <Skeleton className="h-64" /> : material.data?.text}</div>
      </SheetContent>
    </Sheet>
  );
}

