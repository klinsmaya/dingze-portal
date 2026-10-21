import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { MATERIAL_ACCEPT, UnsupportedFileError, spreadsheetText } from "@/lib/dingze/extract-text";

function workbook(bookType: XLSX.BookType): Uint8Array {
  const book = XLSX.utils.book_new();
  const sales = XLSX.utils.aoa_to_sheet([
    ["业务", "2025 销量（万方）", "占比"],
    ["车用气", 360, 0.4],
    [],
    ["工商业", 540, 0.6],
  ]);
  sales["C2"].z = "0%";
  sales["C4"].z = "0%";
  // A formula with its cached result, as Excel saves it.
  sales["B5"] = { t: "n", f: "SUM(B2:B4)", v: 900 };
  sales["A5"] = { t: "s", v: "合计" };
  sales["!ref"] = "A1:C5";
  XLSX.utils.book_append_sheet(book, sales, "销量");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["事项", "日期"], ["站点开工", new Date(Date.UTC(2026, 2, 15))]], { cellDates: true, dateNF: "yyyy-mm-dd" }), "节点");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), "空表");
  return new Uint8Array(XLSX.write(book, { type: "array", bookType }));
}

describe("spreadsheet materials", () => {
  for (const bookType of ["xlsx", "xls", "ods"] as const) {
    it(`reads every sheet of a .${bookType} as text`, async () => {
      const text = await spreadsheetText(workbook(bookType));
      const lines = text.split("\n");
      expect(lines[0]).toBe("【销量】");
      // ODS as written here keeps the value but not the percent format.
      expect(lines).toContain(bookType === "ods" ? "车用气\t360\t0.4" : "车用气\t360\t40%");
      expect(lines).toContain("合计\t900");
      expect(lines).not.toContain("");
      expect(text).toContain("【节点】");
      expect(text).toMatch(/站点开工\t2026-03-15/);
      expect(text).not.toContain("【空表】");
    });
  }

  it("explains a damaged file instead of storing garbage", async () => {
    await expect(spreadsheetText(workbook("xlsx").slice(0, 200))).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(spreadsheetText(workbook("xls").slice(0, 600))).rejects.toBeInstanceOf(UnsupportedFileError);
  });

  it("reads the HTML tables that business systems export with an .xls name", async () => {
    const html = "<html><body><table><tr><td>项目</td><td>金额</td></tr><tr><td>光伏</td><td>120</td></tr></table></body></html>";
    expect(await spreadsheetText(new TextEncoder().encode(html))).toBe("【Sheet1】\n项目\t金额\n光伏\t120");
  });

  it("offers the Excel formats in the file picker", () => {
    for (const ext of [".xlsx", ".xls", ".xlsm", ".xlsb", ".ods", ".docx", ".pdf"]) expect(MATERIAL_ACCEPT.split(",")).toContain(ext);
  });
});
