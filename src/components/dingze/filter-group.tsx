import type { ComponentProps } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// 单选筛选 / 视图切换（测试反馈 8）：总有一项选中，再点已选中的那一项不会被取消（以前会悄悄跳回“全部”）；
// 选中项用主色底，一眼看得出选的是哪一项。

type GroupProps = Omit<ComponentProps<typeof ToggleGroup>, "value" | "defaultValue" | "onValueChange" | "onChange" | "variant" | "multiple">;

export function FilterGroup<T extends string>({ value, onChange, ...props }: GroupProps & { value: T; onChange: (value: T) => void }) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next: string[]) => {
        if (next[0] !== undefined) onChange(next[0] as T);
      }}
      variant="outline"
      {...props}
    />
  );
}

export function FilterItem({ className, ...props }: ComponentProps<typeof ToggleGroupItem>) {
  return (
    <ToggleGroupItem
      className={cn(
        "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}
