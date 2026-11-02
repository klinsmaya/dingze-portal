import { Link } from "react-router";

import { GUIDE_FAQ, GUIDE_INTRO, GUIDE_STEPS } from "@/lib/dingze/guide";
import { samplePath } from "@/lib/dingze/sample";

/** 使用指南：五步走完的简明说明，和发给客户的《三分钟上手》同一份内容。 */
export default function HelpPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand">使用指南</h1>
        <p className="mt-1 text-sm text-muted-foreground">{GUIDE_INTRO}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {GUIDE_STEPS.map((step) => (
          <li key={step.title} className="flex gap-4 rounded-xl border bg-card p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold font-heading font-bold text-brand">{step.no}</span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-bold">{step.title}</h2>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm">
                {step.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-heading text-lg font-bold">{GUIDE_FAQ.title}</h2>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm">
          {GUIDE_FAQ.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-muted-foreground">
        想先看一套填好的表？打开<Link to={samplePath()} className="text-primary hover:underline">示例项目</Link>。
      </p>
    </div>
  );
}
