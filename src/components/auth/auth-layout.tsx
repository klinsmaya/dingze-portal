import type { PropsWithChildren, ReactNode } from "react";
import { STAGES } from "@dingze/shared";

import { Brand } from "@/components/app-shell/brand";

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  description: string;
  footer?: ReactNode;
}>;

export function AuthLayout({
  title,
  description,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh md:grid-cols-[minmax(420px,44%)_1fr]">
      <main className="grid place-items-center bg-card px-6 py-10 sm:px-12">
        <div className="w-full max-w-sm">
          <Brand className="mb-14" logoClassName="h-10" />
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">
            {title}
          </h1>
          <p className="mb-8 mt-2 text-sm text-muted-foreground">
            {description}
          </p>
          {children}
          {footer && <div className="mt-8 text-sm">{footer}</div>}
        </div>
      </main>

      <section className="relative hidden overflow-hidden bg-brand p-12 text-brand-foreground md:grid md:place-items-center">
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="relative w-full max-w-xl">
          <div className="text-xs font-semibold tracking-[0.3em] text-gold">
            企业战略咨询平台
          </div>
          <h2 className="mt-4 font-heading text-5xl font-bold leading-[1.15] tracking-wide">
            自驱战略 · 定三责
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-brand-foreground/75">
            咨询师与企业团队在同一张表上达成共识：战略说得清，目标对得上，行动落到人。
          </p>

          <ol className="mt-10 flex max-w-md flex-col gap-3">
            {STAGES.map((stage, index) => (
              <li
                key={stage.key}
                className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/5 px-5 py-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold font-heading text-lg font-bold text-brand dark:text-brand-foreground">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-heading text-lg font-bold">
                    {stage.name}
                  </span>
                  <span className="text-sm text-brand-foreground/70">
                    {stage.goal}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
