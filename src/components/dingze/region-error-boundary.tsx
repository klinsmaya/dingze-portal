import { TriangleAlert } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Button } from "@/components/ui/button";

/**
 * Keeps one broken region (a suggestion card, an editor showing a preview) from taking the whole
 * workspace down. `resetKeys` re-tries the region when its input changes.
 */
export function RegionErrorBoundary({
  title,
  description,
  action,
  resetKeys,
  children,
}: PropsWithChildren<{ title: string; description?: string; action?: { label: string; onClick: () => void }; resetKeys?: unknown[] }>) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onError={(error) => console.error(`[dingze] ${title}`, error)}
      fallbackRender={({ resetErrorBoundary }): ReactNode => (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-[color:var(--dz-warn)] bg-card p-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-[color:var(--dz-warn)]">
            <TriangleAlert className="size-4" /> {title}
          </span>
          {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
          <div className="flex gap-2">
            {action ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  action.onClick();
                  resetErrorBoundary();
                }}
              >
                {action.label}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={resetErrorBoundary}>
              重试
            </Button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
