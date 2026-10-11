import { artifactDiagrams } from "@/lib/dingze/diagram-svg";
import { artifactSheets } from "@/lib/dingze/export/sheets";

/** A cited locked table, laid out as its export sheets (read-only). */
export function CitationTables({ code, payload, upstream }: { code: string; payload: unknown; upstream: Record<string, unknown> }) {
  const sheets = artifactSheets(code, payload, upstream);
  const diagrams = artifactDiagrams(code, payload);
  if (!sheets.length) return <p className="text-sm text-muted-foreground">这张表没有可显示的内容。</p>;
  return (
    <div className="flex flex-col gap-4">
      {diagrams.map((d) => (
        <img key={d.key} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(d.diagram.svg)}`} alt={`${code} ${d.label}`} className="w-full max-w-3xl self-center rounded-lg border bg-white" />
      ))}
      {sheets.map((sheet) => (
        <div key={sheet.name} className="flex flex-col gap-1">
          {sheets.length > 1 ? <div className="text-xs font-semibold text-muted-foreground">{sheet.name}</div> : null}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {sheet.columns.map((c, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, r) =>
                  sheet.sectionRows?.includes(r) ? (
                    <tr key={r} className="border-t bg-muted/50">
                      <td colSpan={sheet.columns.length} className="px-2 py-1.5 font-semibold text-brand">
                        {row.find((v) => v !== null && v !== "") ?? ""}
                      </td>
                    </tr>
                  ) : (
                    <tr key={r} className="border-t align-top">
                      {sheet.columns.map((_, c) => (
                        <td key={c} className="px-2 py-1.5 whitespace-pre-wrap">
                          {row[c] ?? ""}
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
