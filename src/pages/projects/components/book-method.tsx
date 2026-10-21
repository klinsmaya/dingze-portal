import { type ArtifactDef, bookNote, taskGuide } from "@dingze/shared";

/**
 * 书中方法 for one artifact (甲方方法复核意见): first what this step is for, how to do it and how to
 * tell it is done; preparation, examples, the book's points and the sources unfold below. S2-01
 * follows its sub-step and S2-03 its zone.
 */
export function BookMethod({ def, sub, zone }: { def: ArtifactDef; sub?: number | null; zone?: string | null }) {
  const note = bookNote(def.code);
  const current = taskGuide(def.code, { sub, zone });
  const g = current?.guide;
  return (
    <div className="mt-2 flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="opacity-70">工作任务</dt>
        <dd>{def.task}</dd>
        <dt className="opacity-70">实施步骤</dt>
        <dd>{def.step}</dd>
        <dt className="opacity-70">工具 / 成果</dt>
        <dd>{def.bookRef}</dd>
      </dl>
      {g ? (
        <>
          {current.title ? <div className="text-xs font-semibold">{current.title}</div> : null}
          <section>
            <h4 className="text-xs font-semibold opacity-80">本步目的</h4>
            <p className="mt-1">{g.purpose}</p>
          </section>
          <section>
            <h4 className="text-xs font-semibold opacity-80">怎么做</h4>
            <p className="mt-1">{g.how}</p>
          </section>
          <section>
            <h4 className="text-xs font-semibold opacity-80">完成检查</h4>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {g.check.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] opacity-70">这里是方法自检；必须改的地方以下方校验提示为准，定版还要经复核和企业确认。</p>
          </section>
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold opacity-80">准备 · 示例与反例 · 书中要点 · 来源</summary>
            <div className="mt-2 flex flex-col gap-3">
              <section>
                <h4 className="text-xs font-semibold opacity-80">准备</h4>
                <p className="mt-1">{g.prepare}</p>
              </section>
              <section>
                <h4 className="text-xs font-semibold opacity-80">示例与反例（教学用，不是企业事实）</h4>
                <p className="mt-1">示例：{g.example}</p>
                <p className="mt-1">反例：{g.counter}</p>
              </section>
              {note ? (
                <>
                  <section>
                    <h4 className="text-xs font-semibold opacity-80">书中要点</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {note.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h4 className="text-xs font-semibold opacity-80">常见的坑</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {note.pitfalls.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}
              <section>
                <h4 className="text-xs font-semibold opacity-80">来源与下一步</h4>
                <p className="mt-1">{g.source}</p>
                {g.next ? <p className="mt-1">下一步：{g.next}</p> : null}
                {note?.ref ? <p className="mt-1 text-xs opacity-70">表图：{note.ref.replace(/；?pdf≈[^；]*/g, "")}</p> : null}
              </section>
              <p className="text-[11px] opacity-70">【书】出自《自驱战略落地》；【平台】已批准的平台规则；【建议】补充的专业解释；【待确认】尚待方法论与产品签认。</p>
            </div>
          </details>
        </>
      ) : note ? (
        <>
          <section>
            <h4 className="text-xs font-semibold opacity-80">要点</h4>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {note.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="text-xs font-semibold opacity-80">常见的坑</h4>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {note.pitfalls.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="text-xs font-semibold opacity-80">完成检查</h4>
            <p className="mt-1">{note.gate}</p>
          </section>
          <p className="text-xs opacity-70">表图：{note.ref.replace(/；?pdf≈[^；]*/g, "")}</p>
        </>
      ) : null}
    </div>
  );
}
