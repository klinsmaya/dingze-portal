import type { PropsWithChildren, ReactNode } from "react";

import { Brand } from "@/components/app-shell/brand";

// 客户从注册到拿到计划书的五步（与项目里的流程条一致）。
export const CUSTOMER_FLOW = ["注册开通", "上传资料", "战略解码", "目标分解", "计划制定"] as const;

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  footer?: ReactNode;
}>;

export function AuthLayout({ title, footer, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh md:grid-cols-[minmax(420px,44%)_1fr]">
      <main className="grid place-items-center bg-card px-6 py-10 sm:px-12">
        <div className="w-full max-w-sm">
          <Brand className="mb-14" logoClassName="h-10" />
          <h1 className="mb-8 text-3xl font-semibold tracking-[-0.035em]">{title}</h1>
          {children}
          {footer && <div className="mt-8 text-sm">{footer}</div>}
        </div>
      </main>

      <section className="relative hidden overflow-hidden bg-brand p-12 text-brand-foreground md:grid md:place-items-center">
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="relative w-full max-w-xl">
          <h2 className="font-heading text-5xl font-bold leading-[1.15] tracking-wide">自驱战略 · 定三责</h2>
          <ol className="mt-10 flex max-w-md flex-col gap-2.5">
            {CUSTOMER_FLOW.map((name, index) => (
              <li key={name} className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/5 px-5 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold font-heading text-lg font-bold text-brand dark:text-brand-foreground">
                  {index + 1}
                </span>
                <span className="font-heading text-lg font-bold">{name}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
