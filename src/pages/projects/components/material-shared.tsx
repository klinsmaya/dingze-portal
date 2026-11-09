import { useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { nextAction } from "@dingze/shared";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/dingze/errors";
import { SPREADSHEET_EXTENSIONS, UnsupportedFileError, extractText } from "@/lib/dingze/extract-text";
import { uploadOriginal, useAddMaterial, useMaterial } from "@/lib/dingze/materials-api";
import { askCoachLater } from "@/lib/dingze/coach-later";
import { nextActionPath, progressOf } from "@/lib/dingze/progress";

import { useProjectContext } from "../project-context";

// 资料 used outside the 资料 page too: the workspace's 本步参考资料 and the chat's 上传资料.

/**
 * Upload files as project materials: the text is read in the browser for the digital
 * consultants and the original is stored as well. Returns the new materials.
 */
export function useMaterialUpload({ offerFill = false }: { offerFill?: boolean } = {}) {
  const { project, overview } = useProjectContext();
  const add = useAddMaterial(project);
  const navigate = useNavigate();
  // 上传成功后 toast 带「去填表」：跳到现在该填的那张表，并把刚传的资料写进数字咨询师的输入框。
  const fillPath = () => {
    const service = (overview.project.service ?? project.service) === "self" ? "self" : "guided";
    return nextActionPath(project.id, nextAction(progressOf(overview.artifacts), overview.projectRole, service));
  };
  return useCallback(
    async (files: FileList | File[] | null) => {
      const added: { id: number; title: string }[] = [];
      const extracted: string[] = [];
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
            extracted.push(file.name);
            if (result.truncated) toast.warning(`《${file.name}》文字过长，检索只用前 15 万字`);
          }
        } catch (error) {
          toast.error(`《${file.name}》：${errorMessage(error)}`);
        }
      }
      if (extracted.length) {
        const what = extracted.length === 1 ? `《${extracted[0]}》` : `${extracted.length} 份资料`;
        toast.success(
          `已上传${what}，数字咨询师可以检索了`,
          offerFill
            ? {
                action: {
                  label: "去填表",
                  onClick: () => {
                    askCoachLater(`请参考资料${added.map((m) => `《${m.title}》（资料编号 ${m.id}）`).join("、")}，结合这张表，告诉我哪些内容能用上。`);
                    navigate(fillPath());
                  },
                },
              }
            : undefined,
        );
      }
      return added;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [add, offerFill, navigate, project.id, overview.artifacts, overview.projectRole]
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

