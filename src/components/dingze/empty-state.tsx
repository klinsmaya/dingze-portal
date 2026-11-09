import type { ReactNode } from "react";

import { Empty, EmptyContent, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/**
 * 空状态只有一种：一句话 + 最多一个主按钮，不配插图（走查第三批）。
 * `action` 放一个 Button 或 Link；次要动作做成文字按钮也放这里。
 */
export function EmptyState({ text, action, className }: { text: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Empty className={cn("gap-3 border py-6", className)}>
      <EmptyTitle className="text-sm font-normal text-muted-foreground">{text}</EmptyTitle>
      {action ? <EmptyContent className="flex-row justify-center">{action}</EmptyContent> : null}
    </Empty>
  );
}
