import type { PropsWithChildren, ReactNode } from "react";

import { Brand } from "@/components/app-shell/brand";

// 客户从注册到拿到计划书的五步（与项目里的流程条一致）。
export const CUSTOMER_FLOW = [
  { name: "注册开通", hint: "填企业名称和手机号，马上开好试用项目" },
  { name: "上传资料", hint: "企业简介、组织架构、上年经营复盘" },
  { name: "战略解码", hint: "把战略说清楚、能衡量" },
  { name: "目标分解", hint: "年度目标找到路径，责任分到部门" },
  { name: "计划制定", hint: "任务、节点、资源落到人，生成年度经营计划书" },
];

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
            从注册到拿到年度经营计划书，五步走完。每一步都有数字咨询师陪你填。
          </p>

          <ol className="mt-8 flex max-w-md flex-col gap-2.5">
            {CUSTOMER_FLOW.map((stage, index) => (
              <li
                key={stage.name}
                className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/5 px-5 py-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold font-heading text-lg font-bold text-brand dark:text-brand-foreground">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-heading text-lg font-bold">
                    {stage.name}
                  </span>
                  <span className="text-sm text-brand-foreground/70">
                    {stage.hint}
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
