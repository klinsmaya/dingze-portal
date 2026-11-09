import { FileText, Image as ImageIcon, Paperclip, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { attachmentPrompt, canManageLibrary, getArtifactDef } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/lib/dingze/api";
import { ATTACHMENT_ACCEPT, prepareAttachment } from "@/lib/dingze/attachments";
import { errorMessage } from "@/lib/dingze/errors";
import { type MaterialSummary, downloadOriginal, uploadOriginal, useAddMaterial, useAttachments, useDeleteMaterial, useSetMaterialLibrary } from "@/lib/dingze/materials-api";
import { formatTime } from "@/lib/dingze/records";
import { ConfirmAction } from "@/pages/ops/components/confirm-action";

import { useProjectContext } from "../project-context";
import { askCoach } from "./coach-panel";

// 填表附件（会议纪要 2026-11）：员工把手头的 Word / PDF / Excel / 图片传上来，数字咨询师抽取后出修改卡，
// 确认后才写进表。附件挂在这张表下，不自动进资料库；企业管理员可以在这里“加入资料库”。

/**
 * Upload the files as attachments of this table, then hand each one to the digital consultant:
 * text goes in the message, pictures (and scanned PDFs rendered to pictures) go as chat attachments.
 */
export function useAttachmentFill(project: ProjectSummary, code: string) {
  const add = useAddMaterial(project);
  const table = getArtifactDef(code).plain;
  return useCallback(
    async (files: FileList | File[] | null) => {
      for (const file of Array.from(files ?? [])) {
        try {
          const prepared = await prepareAttachment(file);
          const original = await uploadOriginal(file);
          await add.mutateAsync({ title: file.name.replace(/\.[^.]+$/, ""), kind: "attachment", artifactCode: code, fileName: file.name, size: file.size, text: prepared.text, fileId: original.id });
          const prompt = attachmentPrompt({ fileName: file.name, table, text: prepared.text, pages: prepared.pages });
          askCoach(prompt, true, prepared.images);
          if (prepared.images.length) {
            toast.success(`《${file.name}》已交给数字咨询师识图${prepared.pages > prepared.images.length ? `（只看前 ${prepared.images.length} 页）` : ""}`);
          } else {
            toast.success(`《${file.name}》已交给数字咨询师抽取，修改卡出来后逐项确认`);
          }
        } catch (error) {
          toast.error(`《${file.name}》：${errorMessage(error)}`);
        }
      }
    },
    [add, code, table],
  );
}

/** The table's attachments, under the editor: who uploaded what, re-extract, delete, and (管理员) 加入资料库. */
export function Attachments({ code, canUpload }: { code: string; canUpload: boolean }) {
  const { project, overview } = useProjectContext();
  const list = useAttachments(project, code);
  const remove = useDeleteMaterial(project);
  const setLibrary = useSetMaterialLibrary(project);
  const fill = useAttachmentFill(project, code);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const manager = canManageLibrary(overview.projectRole, overview.isConsultAdmin);
  const items = list.data ?? [];
  if (!canUpload && !items.length) return null;
  const table = getArtifactDef(code).plain;
  const again = (m: MaterialSummary) => {
    if (!m.chars) return void toast.info("这份附件没有文字，请重新上传让数字咨询师识图");
    askCoach(`请再看一遍附件《${m.title}》（资料编号 ${m.id}），把能填进《${table}》的内容用修改卡给我。`);
  };
  return (
    <section aria-label="这张表的附件" className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Paperclip className="size-4 text-muted-foreground" />
        <span className="font-semibold">附件{items.length ? ` · ${items.length}` : ""}</span>
        {canUpload ? (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              aria-label="上传附件填这张表"
              onChange={async (e) => {
                setBusy(true);
                await fill(e.target.files);
                setBusy(false);
                if (input.current) input.current.value = "";
              }}
            />
            <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={() => input.current?.click()}>
              <Sparkles /> {busy ? "处理中…" : "上传附件填这张表"}
            </Button>
          </>
        ) : null}
      </div>
      {items.length ? (
        <ul className="flex flex-col divide-y">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              {m.chars ? <FileText className="size-4 shrink-0 text-muted-foreground" /> : <ImageIcon className="size-4 shrink-0 text-muted-foreground" />}
              <button type="button" onClick={() => m.hasFile && downloadOriginal(project, m)} className="min-w-0 flex-1 truncate text-left hover:underline" title={m.fileName}>
                {m.title}
              </button>
              <span className="text-xs text-muted-foreground">
                {[m.by, formatTime(m.at), m.inLibrary ? "已在资料库" : null].filter(Boolean).join(" · ")}
              </span>
              {canUpload ? (
                <Button size="xs" variant="ghost" onClick={() => again(m)}>
                  再抽取
                </Button>
              ) : null}
              {manager ? (
                <Button size="xs" variant="ghost" disabled={setLibrary.isPending} onClick={() => setLibrary.mutate({ id: m.id, inLibrary: !m.inLibrary }, { onError: (e) => toast.error(errorMessage(e)) })}>
                  {m.inLibrary ? "移出资料库" : "加入资料库"}
                </Button>
              ) : null}
              {canUpload ? (
                <ConfirmAction
                  trigger={<Button size="icon-xs" variant="ghost" aria-label={`删除附件 ${m.title}`}><Trash2 /></Button>}
                  title={`删除附件《${m.title}》？`}
                  description="已经写进表里的内容不受影响。"
                  confirmLabel="删除"
                  destructive
                  onConfirm={() =>
                    remove.mutateAsync(m.id).catch((e) => {
                      toast.error(errorMessage(e));
                      throw e;
                    })
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
