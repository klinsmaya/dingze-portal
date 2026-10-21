import { JapaneseYen, type LucideIcon, Sprout, UsersRound, Workflow } from "lucide-react";

import type { Perspective } from "@dingze/shared";

/** 四个层面的图标和颜色 (design 10)：导图的层面节点、表 3-10 的层面列共用。 */
export const PERSPECTIVE_STYLE: Record<Perspective, { icon: LucideIcon; tone: string; soft: string }> = {
  financial: { icon: JapaneseYen, tone: "var(--dz-fin)", soft: "var(--dz-fin-soft)" },
  customer: { icon: UsersRound, tone: "var(--dz-cus)", soft: "var(--dz-cus-soft)" },
  process: { icon: Workflow, tone: "var(--dz-pro)", soft: "var(--dz-pro-soft)" },
  learning: { icon: Sprout, tone: "var(--dz-lrn)", soft: "var(--dz-lrn-soft)" },
};

export function PerspectiveIcon({ perspective, className }: { perspective: Perspective; className?: string }) {
  const { icon: Icon, tone, soft } = PERSPECTIVE_STYLE[perspective];
  return (
    <span aria-hidden className={className ?? "flex size-7 shrink-0 items-center justify-center rounded-md"} style={{ background: soft, color: tone }}>
      <Icon className="size-4" />
    </span>
  );
}
