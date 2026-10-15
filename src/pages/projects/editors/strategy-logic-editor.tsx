import {
  type Issue,
  type StrategyContent,
  type StrategyLine,
  type StrategyLogic,
  newRowId,
  type StrategyMap,
  seedStrategyLogic,
  strategiesFromMap,
} from "@dingze/shared";

import { errorAnchors, moveById, patchById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell, UpstreamNote } from "./kit";

type Props = {
  value: StrategyLogic;
  onChange: (next: StrategyLogic) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S1-01"?: StrategyContent; "S1-02"?: StrategyMap };
};

/** S1-03 (表 2-7): 使命 → 愿景 → 战略（做不做 / 做什么）→ 策略（动词＋宾语），路径可选。 */
export function StrategyLogicEditor({ value, onChange, readOnly, issues, upstream }: Props) {
  const invalid = errorAnchors(issues);
  const strategies = value.strategies ?? [];
  const content = upstream["S1-01"];
  const seed = content ? seedStrategyLogic(content) : null;
  // 战略地图（S1-02）的目标逐条带成战略，记下来源目标，地图改名或删除时会提示（客户反馈：各表要可承接）。
  const fromMap = strategiesFromMap(upstream["S1-02"], strategies);
  const setStrategies = (next: StrategyLine[]) => onChange({ ...value, strategies: next });
  const setLine = (id: string, patch: Partial<StrategyLine>) => setStrategies(patchById(strategies, id, patch));

  return (
    <section aria-label="企业战略、策略逻辑表" className="flex flex-col gap-4">
      {content ? (
        <UpstreamNote title="来自《战略简约六分法表 / 战略屋》（S1-01）">
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[4rem_1fr]">
            <dt className="opacity-80">使命</dt>
            <dd>{content.mission || "—"}</dd>
            <dt className="opacity-80">愿景</dt>
            <dd>{content.vision || "—"}</dd>
          </dl>
        </UpstreamNote>
      ) : null}

      <EditorToolbar hint="战略回答“做不做、做什么”，策略回答“怎么做”，写成“动词＋宾语”。路径为可选层，在定目标责展开。">
        {upstream["S1-02"] ? <ImportButton label="从战略地图带入目标" count={fromMap.length} readOnly={readOnly} onClick={() => setStrategies([...strategies, ...fromMap])} /> : null}
        {strategies.length === 0 && seed && !fromMap.length ? (
          <ImportButton label="按主要战场带入战略" count={seed.strategies.length} readOnly={readOnly} onClick={() => onChange({ ...seed, levelNote: value.levelNote })} />
        ) : null}
        {!readOnly ? (
          <AddButton
            label="添加战略"
            onClick={() => setStrategies([...strategies, { id: newRowId("s"), statement: "", tactics: [{ id: newRowId("t"), text: "", path: "" }] }])}
          />
        ) : null}
      </EditorToolbar>

      {strategies.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">还没有导出战略</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="grid min-w-[720px] grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] border-b bg-muted text-xs font-semibold text-muted-foreground">
            <div className="px-3 py-2">战略（做不做 / 做什么）</div>
            <div className="px-3 py-2">策略（动词＋宾语）</div>
            <div className="px-3 py-2">路径（可选）</div>
          </div>
          {strategies.map((line, index) => (
            <div
              key={line.id}
              data-anchor={line.id}
              className={cn(
                "grid min-w-[720px] grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] border-b last:border-b-0",
                invalid.has(line.id) && "bg-destructive/5"
              )}
            >
              <div className="flex flex-col gap-2 border-r p-3">
                <div className="text-xs text-muted-foreground">战略 {index + 1}</div>
                <TextCell
                  label={`战略 ${index + 1}`}
                  multiline
                  placeholder="如：聚焦城市燃气，做强车用气"
                  value={line.statement}
                  onChange={(statement) => setLine(line.id, { statement })}
                  readOnly={readOnly}
                  anchor={line.id} invalid={invalid.has(line.id)}
                />
                <RowActions
                  label={`战略 ${index + 1}`}
                  readOnly={readOnly}
                  onRemove={() => setStrategies(removeById(strategies, line.id))}
                  onMove={(delta) => setStrategies(moveById(strategies, line.id, delta))}
                />
              </div>
              <div className="flex flex-col gap-2 p-3">
                {(line.tactics ?? []).map((tactic, t) => (
                  <div key={tactic.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] items-start gap-2">
                    <TextCell
                      label={`战略 ${index + 1} 的策略 ${t + 1}`}
                      placeholder="动词＋宾语，如“加密城区加气站网络”"
                      value={tactic.text}
                      onChange={(text) => setLine(line.id, { tactics: patchById(line.tactics, tactic.id, { text }) })}
                      readOnly={readOnly}
                      anchor={tactic.id} invalid={invalid.has(tactic.id)}
                    />
                    <TextCell
                      label={`策略 ${t + 1} 的路径`}
                      placeholder="选填"
                      value={tactic.path}
                      onChange={(path) => setLine(line.id, { tactics: patchById(line.tactics, tactic.id, { path }) })}
                      readOnly={readOnly}
                    />
                    <RowActions
                      label={`策略 ${t + 1}`}
                      readOnly={readOnly}
                      onRemove={() => setLine(line.id, { tactics: removeById(line.tactics, tactic.id) })}
                    />
                  </div>
                ))}
                {!readOnly ? (
                  <div>
                    <AddButton
                      label="添加策略"
                      onClick={() => setLine(line.id, { tactics: [...(line.tactics ?? []), { id: newRowId("t"), text: "", path: "" }] })}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground">层级相对性说明</div>
        <TextCell
          label="层级相对性说明"
          multiline
          placeholder="集团的策略到业务单元可能成为单元战略：说明哪些策略需要在下级展开为战略"
          value={value.levelNote}
          onChange={(levelNote) => onChange({ ...value, levelNote })}
          readOnly={readOnly}
        />
      </div>
    </section>
  );
}
