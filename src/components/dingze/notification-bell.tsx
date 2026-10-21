import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTime } from "@/lib/dingze/records";
import type { NotificationItem } from "@/lib/dingze/records-api";
import { useMarkNotificationsRead, useMyNotifications } from "@/lib/dingze/records-queries";
import { cn } from "@/lib/utils";

/** 站内通知：待复核、待确认、退回、定版、上游已变更和项目分派，点击直达对应成果。 */
export function NotificationBell({ className }: { className?: string }) {
  const notifications = useMyNotifications();
  const markRead = useMarkNotificationsRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = notifications.data?.unread ?? 0;
  const items = notifications.data?.items ?? [];

  const openItem = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate({ ids: [item.id] });
    setOpen(false);
    navigate(item.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={unread ? `通知（${unread} 条未读）` : "通知"} className={cn("relative", className)}>
            <Bell />
            {unread ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-semibold">通知</span>
          <Button variant="ghost" size="sm" disabled={!unread || markRead.isPending} onClick={() => markRead.mutate({ all: true })}>
            <CheckCheck /> 全部已读
          </Button>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="border-b last:border-b-0">
              <button type="button" onClick={() => openItem(item)} className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted">
                <span className="flex items-center gap-2">
                  {!item.readAt ? <span aria-label="未读" className="size-2 shrink-0 rounded-full bg-destructive" /> : null}
                  <span className={cn("text-sm", !item.readAt && "font-semibold")}>{item.title}</span>
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.content}</span>
                <span className="text-[11px] text-muted-foreground">
                  {item.projectName} · {formatTime(item.createdAt)}
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 ? <li className="px-3 py-8 text-center text-sm text-muted-foreground">暂无通知</li> : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
