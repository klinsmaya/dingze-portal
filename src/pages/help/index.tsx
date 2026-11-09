import { useGetIdentity } from "@refinedev/core";

import { ROLE_GUIDES, faqFor } from "@/lib/dingze/guide";
import { PORTAL_ROLE_LABELS, portalRoleFromSystem } from "@/lib/dingze/portal-role";

type Identity = { roles?: { name: string }[] };

/** 使用指南：按账号角色只显示自己那份（八条以内），再加常见问题。 */
export default function HelpPage() {
  const identity = useGetIdentity<Identity>();
  const role = portalRoleFromSystem((identity.data?.roles ?? []).map((r) => r.name));
  const faq = faqFor(role);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-brand">
        使用指南 <span className="text-base font-normal text-muted-foreground">· {PORTAL_ROLE_LABELS[role]}</span>
      </h1>
      <ol className="flex flex-col gap-2">
        {ROLE_GUIDES[role].map((item, i) => (
          <li key={item} className="flex gap-4 rounded-xl border bg-card px-4 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gold font-heading text-sm font-bold text-brand">{i + 1}</span>
            <span className="text-sm leading-7">{item}</span>
          </li>
        ))}
      </ol>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-heading text-lg font-bold">{faq.title}</h2>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm">
          {faq.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
