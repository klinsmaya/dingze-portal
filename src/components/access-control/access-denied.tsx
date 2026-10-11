import { FolderKanban, ShieldX } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AccessDenied({
  className,
  title = "无权访问",
  description = "当前账号没有查看这个页面的权限。如果你需要它，请联系运营管理员开通。",
}: {
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-background/70 p-8 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
        <ShieldX className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Button className="mt-5" nativeButton={false} render={<Link to="/projects" />}>
        <FolderKanban /> 回我的项目
      </Button>
    </div>
  );
}
