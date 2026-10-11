import { CircleAlert, CircleCheck, GitCompareArrows, Keyboard, MessageSquareText, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** Bottom status line of the workspace (design 10): checks, comments, save state, shortcuts. */
export function StatusBar({
  errors,
  warnings,
  openComments,
  saving,
  dirty,
  savedLabel,
  revisionOn,
  selected,
  onIssues,
  onComments,
  onRevision,
  onShortcuts,
}: {
  errors: number;
  warnings: number;
  openComments: number;
  saving: boolean;
  dirty: boolean;
  savedLabel: string;
  revisionOn: boolean;
  selected: string | null;
  onIssues: () => void;
  onComments: () => void;
  onRevision: () => void;
  onShortcuts: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky bottom-0 z-20 -mx-4 -mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-background/95 px-4 py-1.5 text-xs backdrop-blur md:-mx-6 md:-mb-6 md:px-6"
    >
      <button type="button" onClick={onIssues} className={cn("flex items-center gap-1", errors ? "text-destructive" : "text-status-done-foreground")}>
        {errors ? <CircleAlert className="size-3.5" /> : <CircleCheck className="size-3.5" />}
        {errors ? `${errors} 处必须改` : "校验通过"}
        {warnings ? <span className="text-muted-foreground">· {warnings} 条建议</span> : null}
      </button>
      <button type="button" onClick={onComments} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
        <MessageSquareText className="size-3.5" style={{ color: openComments ? "var(--dz-comment)" : undefined }} />
        批注 {openComments} 未解决
      </button>
      <button type="button" onClick={onRevision} className={cn("flex items-center gap-1", revisionOn ? "font-semibold" : "text-muted-foreground hover:text-foreground")} style={revisionOn ? { color: "var(--dz-changed)" } : undefined}>
        <GitCompareArrows className="size-3.5" /> 修订 {revisionOn ? "开" : "关"}
      </button>
      {selected ? <span className="hidden truncate text-muted-foreground sm:inline">选中：{selected}</span> : null}
      <span className="ml-auto flex items-center gap-1 text-muted-foreground">
        <Save className="size-3.5" />
        {saving ? "保存中…" : dirty ? "有未保存的修改" : savedLabel}
      </span>
      <Button size="xs" variant="ghost" onClick={onShortcuts} aria-label="快捷键（?）">
        <Keyboard /> ?
      </Button>
    </div>
  );
}

const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: "通用",
    items: [
      ["Ctrl / ⌘ + S", "保存"],
      ["Ctrl / ⌘ + Z", "撤销"],
      ["Ctrl / ⌘ + Shift + Z 或 Ctrl + Y", "重做"],
      ["Ctrl / ⌘ + Shift + E", "修订开关（对比任意一版）"],
      ["Ctrl / ⌘ + Alt + M", "给选中的格子 / 行写批注"],
      ["?", "打开这个面板"],
      ["Esc", "关闭浮层，焦点回到原处"],
    ],
  },
  {
    group: "表格",
    items: [
      ["点格子", "直接改，改完自动记一条修改"],
      ["Tab / Shift + Tab", "下一格 / 上一格"],
      ["行右侧按钮", "上移、下移、删除（删除后可撤销）"],
    ],
  },
  {
    group: "思维导图 / 树形表（路径、WBS）",
    items: [
      ["F2 或双击", "编辑节点"],
      ["Tab", "新增下级"],
      ["Enter", "新增同级"],
      ["Alt + Shift + ← / →", "升一级 / 降一级"],
      ["Alt + Shift + ↑ / ↓", "上移 / 下移"],
      ["Shift + F10", "移动到…（拖动的替代）"],
      ["Delete", "删除（可撤销）"],
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
          <DialogDescription>Mac 上 Ctrl 换成 ⌘、Alt 换成 ⌥。光标在输入框里时，只响应 Enter、Tab、Esc 和撤销。</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {SHORTCUTS.map((g) => (
            <section key={g.group}>
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{g.group}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {g.items.map(([keys, what]) => (
                  <li key={keys} className="flex items-center justify-between gap-3">
                    <span>{what}</span>
                    <Kbd>{keys}</Kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
