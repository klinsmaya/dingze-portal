import { ArrowRight, FileSpreadsheet, FileText, Target } from "lucide-react";
import { Link } from "react-router";

import { BrandWordmark } from "@/components/app-shell/brand";
import { CUSTOMER_FLOW } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";

// 未登录时的首页：一句话、五步、三样成果，免费试用 / 登录。

const OUTCOMES = [
  { icon: Target, title: "战略一页纸和战略地图" },
  { icon: FileSpreadsheet, title: "部门计分卡和关键项目" },
  { icon: FileText, title: "年度经营计划书" },
];

export function WelcomePage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 md:px-6">
        <BrandWordmark />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link to="/login" />}>
            登录
          </Button>
          <Button nativeButton={false} render={<Link to="/trial" />}>免费试用</Button>
        </div>
      </header>

      <section className="bg-brand text-brand-foreground">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <h1 className="max-w-3xl font-heading text-4xl font-bold leading-tight md:text-5xl">把战略落到每个部门、每个人</h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="bg-gold text-brand hover:bg-gold/90" nativeButton={false} render={<Link to="/trial" />}>
              免费试用 <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-brand-foreground hover:bg-white/10" nativeButton={false} render={<Link to="/login" />}>
              登录
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h2 className="font-heading text-2xl font-bold text-brand">五步走完</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CUSTOMER_FLOW.map((name, i) => (
            <li key={name} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold font-heading font-bold text-brand">{i + 1}</span>
              <span className="font-heading text-lg font-bold">{name}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
        <h2 className="font-heading text-2xl font-bold text-brand">做完你会得到</h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {OUTCOMES.map(({ icon: Icon, title }) => (
            <li key={title} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <Icon className="size-5 shrink-0 text-brand" />
              <span className="font-semibold">{title}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
