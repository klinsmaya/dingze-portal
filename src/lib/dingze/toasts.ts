import type { ReactNode } from "react";
import { toast } from "sonner";

// 走查第三批：提示分三档。
// 1. 自动保存：不弹，顶部状态字说话。
// 2. 普通操作：`toast.success("已保存")` 一句话，默认时长。
// 3. 定版、退回、删除、解锁重开这类要紧的：带图标、一句说明和一个动作（查看 / 撤销），停 8 秒。

export const IMPORTANT_TOAST_MS = 8000;

export function importantToast(
  title: string,
  { icon, description, action }: { icon?: ReactNode; description?: string; action?: { label: string; onClick: () => void } } = {},
) {
  return toast(title, { icon, description, action, duration: IMPORTANT_TOAST_MS });
}
