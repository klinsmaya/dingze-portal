import { Archive, ArchiveRestore, MoreHorizontal, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { deleteConfirmed, isArchivedProject } from "@dingze/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/dingze/errors";
import { opsApi } from "@/lib/dingze/ops-api";
import { useOpsMutation } from "@/lib/dingze/ops-queries";

// 项目的归档、恢复、删除（2026-11-17 客户反馈）：企业管理员在「我的项目」的卡片上操作，运营在
// 「企业 › 项目与分派」里也能删。谁能操作由服务端定（myProjects 返回的 manageable）。

export type ManagedProject = { id: number; name: string; status: string };

/** 卡片右上角的「⋯」：归档 / 恢复、删除。 */
export function ProjectManageMenu({ project, lockedCount, className }: { project: ManagedProject; lockedCount?: number; className?: string }) {
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  const archived = isArchivedProject(project);
  const setArchived = useOpsMutation(opsApi.setProjectArchived);
  const restore = () =>
    setArchived.mutate(
      { projectId: project.id, archived: false },
      { onSuccess: () => toast.success("已恢复为进行中"), onError: (error) => toast.error(errorMessage(error)) },
    );
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className={className} aria-label={`管理项目：${project.name}`} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {archived ? (
            <DropdownMenuItem disabled={setArchived.isPending} onClick={restore}>
              <ArchiveRestore /> 恢复为进行中
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setDialog("archive")}>
              <Archive /> 归档
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            <Trash2 /> 删除…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ArchiveProjectDialog project={dialog === "archive" ? project : null} onClose={() => setDialog(null)} />
      <DeleteProjectDialog project={dialog === "delete" ? project : null} lockedCount={lockedCount} onClose={() => setDialog(null)} />
    </>
  );
}

function ArchiveProjectDialog({ project, onClose }: { project: ManagedProject | null; onClose: () => void }) {
  const setArchived = useOpsMutation(opsApi.setProjectArchived);
  const [shown, setShown] = useState(project);
  if (project && project !== shown) setShown(project);
  return (
    <AlertDialog open={!!project} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>归档「{shown?.name}」？</AlertDialogTitle>
          <AlertDialogDescription>归档后项目收进「已归档」，内容保留、成员仍可打开，随时可以恢复。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={setArchived.isPending}
            onClick={() =>
              project &&
              setArchived.mutate(
                { projectId: project.id, archived: true },
                {
                  onSuccess: () => {
                    toast.success("已归档");
                    onClose();
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            归档
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** 删除不可恢复：写明删掉什么，原样输入项目名称后才能点。 */
export function DeleteProjectDialog({
  project,
  lockedCount = 0,
  onClose,
  onDeleted,
}: {
  project: ManagedProject | null;
  /** 已定版的必做表数，有的话提醒一句。 */
  lockedCount?: number;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [typed, setTyped] = useState("");
  // 关闭动画期间 project 已经是 null，标题里的名称用最后一次打开的。
  const [shown, setShown] = useState<ManagedProject | null>(null);
  if (project && project !== shown) {
    setShown(project);
    setTyped("");
  }
  const remove = useOpsMutation(opsApi.deleteProject);
  const ready = !!project && deleteConfirmed(project.name, typed);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!project || !ready) return;
    remove.mutate(
      { projectId: project.id, confirmName: typed.trim() },
      {
        onSuccess: (result) => {
          if (result.filesFailed) toast.warning(`项目已删除，有 ${result.filesFailed} 份资料原件没能从存储里清掉，请联系运营处理`);
          else toast.success("项目已删除");
          onClose();
          onDeleted?.();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <Dialog open={!!project} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>删除「{shown?.name}」？</DialogTitle>
            <DialogDescription>
              项目和它的全部表、历史版本、批注、资料与企业画像、成员关系会一起删除，所有人都不能再打开，<strong className="text-foreground">无法恢复</strong>。
              {shown && !isArchivedProject(shown) ? "只是不想再看到它，可以改用归档。" : null}
            </DialogDescription>
          </DialogHeader>
          {lockedCount > 0 ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>这个项目已有 {lockedCount} 张必做表定版，删除后定版内容也一起消失。</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="delete-project-name">输入项目名称确认：{shown?.name}</FieldLabel>
            <Input id="delete-project-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready || remove.isPending}>
              {remove.isPending ? "删除中…" : "删除项目"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
