import type { SheetModel } from "./sheets";

const HEADER_FILL = "FFE8EEF1";
const BRAND = "FF0C3D52";
const SECTION_FILL = "FFFFF8EB";

/** Excel limits sheet names to 31 characters and forbids a few symbols. */
function safeSheetName(name: string, used: Set<string>) {
  const base = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Sheet";
  let candidate = base;
  for (let i = 2; used.has(candidate); i++) candidate = `${base} ${i}`;
  used.add(candidate);
  return candidate;
}

export type WorkbookMeta = {
  title: string;
  /** e.g. “DZ测试燃气 · 2026 年度战略落地 · 已定版 v3 · 导出于 2026-10-09 16:00”. */
  subtitle: string;
  /** Drafts are marked so a printed copy is never mistaken for the confirmed version. */
  draft: boolean;
};

/** Build the workbook in the browser (exceljs is loaded on demand) and download it. */
export async function downloadXlsx(fileName: string, meta: WorkbookMeta, sheets: SheetModel[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "自驱战略 · 定三责";
  workbook.created = new Date();
  const used = new Set<string>();

  for (const model of sheets) {
    const ws = workbook.addWorksheet(safeSheetName(model.name, used), {
      views: [{ state: "frozen", ySplit: 3 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const width = Math.max(model.columns.length, 1);
    ws.columns = model.columns.map((c) => ({ width: c.width }));

    ws.mergeCells(1, 1, 1, width);
    const title = ws.getCell(1, 1);
    title.value = meta.title;
    title.font = { bold: true, size: 14, color: { argb: BRAND } };
    ws.mergeCells(2, 1, 2, width);
    const subtitle = ws.getCell(2, 1);
    subtitle.value = meta.draft ? `草稿（未定版，仅供讨论） · ${meta.subtitle}` : meta.subtitle;
    subtitle.font = { size: 10, color: { argb: meta.draft ? "FFB42318" : "FF5B6B73" } };

    const header = ws.getRow(3);
    model.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: BRAND } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    });

    model.rows.forEach((row, r) => {
      const excelRow = ws.getRow(r + 4);
      row.forEach((value, c) => {
        excelRow.getCell(c + 1).value = value ?? null;
      });
      if (model.sectionRows?.includes(r)) {
        excelRow.font = { bold: true };
        excelRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_FILL } };
      }
    });
    for (const [r1, c1, r2, c2] of model.merges) ws.mergeCells(r1 + 4, c1 + 1, r2 + 4, c2 + 1);

    const lastRow = model.rows.length + 3;
    for (let r = 3; r <= lastRow; r++) {
      for (let c = 1; c <= width; c++) {
        const cell = ws.getCell(r, c);
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD0D7DC" } },
          bottom: { style: "thin", color: { argb: "FFD0D7DC" } },
          left: { style: "thin", color: { argb: "FFD0D7DC" } },
          right: { style: "thin", color: { argb: "FFD0D7DC" } },
        };
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** “DZ测试燃气-S1-07-战略 KPI 3—5 年年度分解表-v3.xlsx”, safe on every OS. */
export function exportFileName(enterprise: string, code: string, name: string, rev: number) {
  return `${enterprise}-${code}-${name}-v${rev}.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
}
