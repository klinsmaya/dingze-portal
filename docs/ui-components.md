# 界面组件速查

门户里同一类东西只用一个组件（走查第三批）。新页面先翻这页，别再手写一份。组件源码在 `src/components/ui/`（shadcn / Base UI）和 `src/components/dingze/`（业务封装）。

| 要做什么 | 用哪个 | 不要用 |
|---|---|---|
| 页面标题 | `<h1 className="font-heading text-2xl font-bold text-brand">`，副标题一行 `text-sm text-muted-foreground` 写元信息 | `text-3xl`、两行副标题 |
| 表的生命周期状态 | `StatusBadge`（`status` + `stale`）、小圆点 `StatusDot`，还没解锁的表 `LockedStepBadge` | 自己写颜色映射、裸文字“待解锁” |
| 下拉选择（少于 8 项、表单里） | `NativeSelect` + `NativeSelectOption`（`size="sm"` 放工具栏） | 原生 `<select>`、`Select` 弹层 |
| 下拉菜单（动作列表） | `DropdownMenu` | 自己写 popover 列表 |
| 页签 | `Tabs` / `TabsList variant="line"` / `TabsTrigger` / `TabsContent`；资料页的页签要配 URL 时用 `role="tablist"` 的按钮组，也是同一套样式 | 别处再自定义页签样式 |
| 弹层 | 表单、看详情用 `Dialog`；要确认、不可撤销用 `useConfirm`（`AlertDialog`）；侧边看长内容用 `Sheet` | 自己写遮罩 |
| 进度 | 文字 “已定版 n / 总数”（总览阶段卡）；只有看板需要条形时用 `Progress` | 条形和文字并排 |
| 空状态 | `EmptyState`（`text` 一句话，`action` 最多一个主按钮） | 虚线框 `<p>`、带插图的空状态 |
| 提示（toast） | 自动保存不弹；普通操作 `toast.success("已保存")`；定版、退回、删除、解锁重开用 `importantToast(title, { icon, description, action })`（8 秒，带查看 / 撤销） | 每个动作都弹两条 |
| 错误文案 | `errorMessage(error)`：插件写的中文原因照用，HTTP 状态码映射成中文，不认识的一律“没成功，请重试” | 直接显示 `error.message` |
| 按钮层级 | 一页一个实心主按钮（`default`），次要 `outline`，再次要 `ghost` | 并排两个实心按钮 |

相关文件：`src/components/dingze/status-badge.tsx`、`src/components/dingze/empty-state.tsx`、`src/lib/dingze/toasts.ts`、`src/lib/dingze/errors.ts`。
