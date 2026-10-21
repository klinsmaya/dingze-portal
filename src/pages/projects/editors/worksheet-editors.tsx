import type { Issue, MissionWorksheet, VisionWorksheet } from "@dingze/shared";

import { errorAnchors } from "@/lib/dingze/rows";

import { TextCell } from "./kit";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold text-muted-foreground">
        {label}
        {hint ? <span className="ml-2 font-normal">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** M-MISSION (表 2-3): extract five elements, then compose the mission statement. */
export function MissionWorksheetEditor({
  value,
  onChange,
  readOnly,
  issues,
}: {
  value: MissionWorksheet;
  onChange: (next: MissionWorksheet) => void;
  readOnly: boolean;
  issues: Issue[];
}) {
  const invalid = errorAnchors(issues);
  const set = (patch: Partial<MissionWorksheet>) => onChange({ ...value, ...patch });
  return (
    <section aria-label="使命五要素萃取" className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="w-28 px-3 py-2 text-left" />
              <th className="px-3 py-2 text-left font-semibold">是谁？</th>
              <th className="px-3 py-2 text-left font-semibold">痛点与核心需求是什么？</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["coreUser", "核心用户"],
                ["coreCustomer", "核心客户"],
              ] as const
            ).map(([key, label]) => (
              <tr key={key} className="border-t align-top">
                <th scope="row" className="px-3 py-2 text-left font-semibold text-brand">
                  {label}
                </th>
                <td className="px-1 py-1">
                  <TextCell label={`${label} 是谁`} value={value[key]?.who ?? ""} onChange={(who) => set({ [key]: { ...value[key], who } })} readOnly={readOnly} />
                </td>
                <td className="px-1 py-1">
                  <TextCell label={`${label} 痛点与需求`} value={value[key]?.need ?? ""} onChange={(need) => set({ [key]: { ...value[key], need } })} readOnly={readOnly} />
                </td>
              </tr>
            ))}
            {(
              [
                ["differentiation", "独特差异化"],
                ["advantage", "核心竞争优势"],
              ] as const
            ).map(([key, label]) => (
              <tr key={key} className="border-t align-top">
                <th scope="row" className="px-3 py-2 text-left font-semibold text-brand">
                  {label}
                </th>
                <td className="px-1 py-1" colSpan={2}>
                  <TextCell label={label} value={value[key]} onChange={(v) => set({ [key]: v })} readOnly={readOnly} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Field label="事业的哲学意义" hint="五个要素共同指向的意义">
        <TextCell label="事业的哲学意义" multiline value={value.philosophy} onChange={(philosophy) => set({ philosophy })} readOnly={readOnly} />
      </Field>
      <Field label="合成使命句" hint="短、可传播、有辨识度；定稿后写回战略屋的“使命”">
        <TextCell
          label="合成使命句"
          multiline
          value={value.statement}
          onChange={(statement) => set({ statement })}
          readOnly={readOnly}
          anchor={"statement"} invalid={invalid.has("statement")}
        />
      </Field>
    </section>
  );
}

/** M-VISION: 战略推导法、对标一流（选标 → 对标 → 定标）、引以为傲法 → 7—10 年愿景句. */
export function VisionWorksheetEditor({
  value,
  onChange,
  readOnly,
  issues,
}: {
  value: VisionWorksheet;
  onChange: (next: VisionWorksheet) => void;
  readOnly: boolean;
  issues: Issue[];
}) {
  const invalid = errorAnchors(issues);
  const set = (patch: Partial<VisionWorksheet>) => onChange({ ...value, ...patch });
  const benchmark = value.benchmark ?? { select: "", compare: "", set: "" };
  return (
    <section aria-label="愿景三法" className="flex flex-col gap-4">
      <Field label="战略推导法" hint="从使命和战略方向推出未来要成为什么">
        <TextCell label="战略推导法" multiline value={value.derivation} onChange={(derivation) => set({ derivation })} readOnly={readOnly} />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            ["select", "选标", "选谁作为标杆"],
            ["compare", "对标", "差距在哪里"],
            ["set", "定标", "要达到什么水平"],
          ] as const
        ).map(([key, label, hint]) => (
          <Field key={key} label={`对标一流 · ${label}`} hint={hint}>
            <TextCell
              label={`对标一流 ${label}`}
              multiline
              value={benchmark[key]}
              onChange={(v) => set({ benchmark: { ...benchmark, [key]: v } })}
              readOnly={readOnly}
            />
          </Field>
        ))}
      </div>
      <Field label="引以为傲法" hint="十年后最想让员工、客户为之骄傲的是什么">
        <TextCell label="引以为傲法" multiline value={value.pride} onChange={(pride) => set({ pride })} readOnly={readOnly} />
      </Field>
      <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
        <Field label="时间跨度">
          <TextCell label="愿景时间跨度" placeholder="通常 7—10 年" value={value.horizon} onChange={(horizon) => set({ horizon })} readOnly={readOnly} />
        </Field>
        <Field label="愿景句" hint="定稿后写回战略屋的“愿景”">
          <TextCell label="愿景句" multiline value={value.statement} onChange={(statement) => set({ statement })} readOnly={readOnly} anchor={"statement"} invalid={invalid.has("statement")} />
        </Field>
      </div>
    </section>
  );
}
