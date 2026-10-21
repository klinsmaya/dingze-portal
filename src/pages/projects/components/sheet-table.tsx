import type { SheetModel } from "@/lib/dingze/export/sheets";
import { cn } from "@/lib/utils";

/** A sheet model as an HTML table, with its merged ranges and section rows, the way the Excel export lays it out. */
export function SheetTable({ sheet, className }: { sheet: SheetModel; className?: string }) {
  const covered = new Set<string>();
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const [r0, c0, r1, c1] of sheet.merges) {
    spans.set(`${r0}:${c0}`, { rowSpan: r1 - r0 + 1, colSpan: c1 - c0 + 1 });
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r !== r0 || c !== c0) covered.add(`${r}:${c}`);
  }
  return (
    <div className={cn("overflow-x-auto rounded-lg border bg-card", className)}>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {sheet.columns.map((c, i) => (
              <th key={i} className="border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap" style={{ minWidth: `${Math.max(c.width, 6) * 0.5}rem` }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, r) => (
            <tr key={r} className={cn("align-top", sheet.sectionRows?.includes(r) && "bg-muted/50 font-semibold text-brand")}>
              {sheet.columns.map((_, c) => {
                if (covered.has(`${r}:${c}`)) return null;
                const span = spans.get(`${r}:${c}`);
                return (
                  <td key={c} rowSpan={span?.rowSpan} colSpan={span?.colSpan} className="border-t border-l px-2 py-1.5 whitespace-pre-wrap first:border-l-0">
                    {row[c] ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
