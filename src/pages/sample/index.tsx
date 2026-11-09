import { Eye } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";

import { STAGES, getArtifactDef } from "@dingze/shared";

import { RegionErrorBoundary } from "@/components/dingze/region-error-boundary";
import { SAMPLE, SAMPLE_CODES, SAMPLE_ORG_UNITS, hasSample, samplePath } from "@/lib/dingze/sample";
import { samplePayloads } from "@/lib/dingze/sample-data";
import { cn } from "@/lib/utils";

import { ArtifactEditor } from "../projects/editors/artifact-editor";

const noop = () => {};

/** One sample table, read-only. Exported for the component test. */
export function SampleTable({ code }: { code: string }) {
  const payloads = samplePayloads();
  return (
    <ArtifactEditor
      code={code}
      value={payloads[code]}
      onChange={noop}
      readOnly
      issues={[]}
      upstream={payloads}
      projectYear={SAMPLE.year}
      keyProjectLevel={SAMPLE.keyProjectLevel}
      orgUnits={SAMPLE_ORG_UNITS}
      team={[]}
      scheduleScale={SAMPLE.scheduleScale}
      enterprise={SAMPLE.enterprise}
    />
  );
}

/**
 * 示例项目：虚构企业瀚川燃气 2026 年从战略解码到计划制定的完整一套表，只能看。
 * 填写页的“看示例”按钮打开同一张表。
 */
export default function SamplePage() {
  const { code: raw } = useParams();
  const code = raw ? decodeURIComponent(raw) : SAMPLE_CODES[0];
  if (!hasSample(code)) return <Navigate to={samplePath()} replace />;
  const def = getArtifactDef(code);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-bold text-brand">示例：{SAMPLE.shortName}</h1>

      <div className="flex flex-col gap-5 lg:flex-row">
        <nav aria-label="示例的表" className="flex shrink-0 flex-col gap-4 lg:w-60">
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex flex-col gap-1">
              <div className="px-2 text-xs font-bold text-muted-foreground">
                第 {i + 2} 步 · {s.flow}
              </div>
              {SAMPLE_CODES.filter((c) => getArtifactDef(c).stage === s.key).map((c) => {
                const d = getArtifactDef(c);
                return (
                  <Link
                    key={c}
                    to={samplePath(c)}
                    aria-current={c === code ? "page" : undefined}
                    className={cn("rounded-md px-2 py-1.5 text-sm hover:bg-muted", c === code && "bg-accent font-semibold")}
                    title={`${d.specId} ${d.name}`}
                  >
                    {d.plain}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <section className="min-w-0 flex-1 rounded-xl border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3">
            <h2 className="font-heading text-xl font-bold" title={`${def.specId} ${def.name}（${def.bookRef}）`}>
              {def.plain}
            </h2>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Eye className="size-3.5" /> 示例 · 只读
            </span>
          </div>
          <RegionErrorBoundary title="这张示例表没能显示" description="可以先看别的表。" resetKeys={[code]}>
            <SampleTable code={code} />
          </RegionErrorBoundary>
        </section>
      </div>
    </div>
  );
}
