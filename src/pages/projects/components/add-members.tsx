import { UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProjectSummary } from "@/lib/dingze/api";

import { ProjectMembersDialog } from "./project-members-dialog";

/**
 * 「我的项目」的添加成员：把本企业已有的账号加进项目，不是开通账号（HUPO-37）。只有一个进行中的项目
 * 时直接打开它的项目成员窗口，多个时先选项目。`projects` 为 undefined 表示列表还没拿到。
 */
export function AddProjectMembers({ projects }: { projects: Pick<ProjectSummary, "id" | "name" | "year">[] | undefined }) {
  const [picking, setPicking] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  return (
    <>
      <Button variant="outline" disabled={!projects} onClick={() => (projects?.length === 1 ? setProjectId(projects[0].id) : setPicking(true))}>
        <UserPlus /> 添加成员
      </Button>
      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择项目</DialogTitle>
            <DialogDescription>{projects?.length ? "把本企业已有的账号加进哪个项目？" : "没有进行中的项目。先新建项目，或恢复已归档的项目。"}</DialogDescription>
          </DialogHeader>
          {projects?.length ? (
            <ul className="flex flex-col gap-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <Button
                    variant="ghost"
                    className="h-auto w-full justify-between gap-3 py-2 text-left whitespace-normal"
                    onClick={() => {
                      setPicking(false);
                      setProjectId(p.id);
                    }}
                  >
                    <span className="min-w-0 font-medium">{p.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.year} 年度</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>
      <ProjectMembersDialog projectId={projectId} onClose={() => setProjectId(null)} />
    </>
  );
}
