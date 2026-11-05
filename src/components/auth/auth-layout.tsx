import type { PropsWithChildren, ReactNode } from "react";

import { Brand } from "@/components/app-shell/brand";

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  description?: string;
  footer?: ReactNode;
}>;

export function AuthLayout({
  title,
  description,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh place-items-center bg-card px-6 py-10">
      <main className="w-full max-w-sm">
        <Brand className="mb-14" logoClassName="h-10" />
        <h1
          className={
            description
              ? "text-3xl font-semibold tracking-[-0.035em]"
              : "mb-8 text-3xl font-semibold tracking-[-0.035em]"
          }
        >
          {title}
        </h1>
        {description ? (
          <p className="mb-8 mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
        {footer && <div className="mt-8 text-sm">{footer}</div>}
      </main>
    </div>
  );
}
