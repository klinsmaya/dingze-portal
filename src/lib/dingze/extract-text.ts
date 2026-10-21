// Turn an uploaded file into plain text in the browser; only the text is stored. The parsers
// load on demand so they stay out of the main bundle.

/** Spreadsheet formats read with SheetJS: Excel 2007+ and 97–2003, macro / binary workbooks, OpenDocument. */
export const SPREADSHEET_EXTENSIONS = ["xlsx", "xls", "xlsm", "xlsb", "ods"];
export const MATERIAL_ACCEPT = [".txt", ".md", ".csv", ".docx", ".pdf", ...SPREADSHEET_EXTENSIONS.map((e) => `.${e}`)].join(",");
export const MATERIAL_MAX_BYTES = 20 * 1024 * 1024;

export class UnsupportedFileError extends Error {}

const extension = (name: string) => name.toLowerCase().split(".").pop() ?? "";

export async function extractText(file: File): Promise<string> {
  if (file.size > MATERIAL_MAX_BYTES) throw new UnsupportedFileError("文件超过 20 MB，请拆分或只上传关键部分");
  const ext = extension(file.name);
  if (["txt", "md", "csv"].includes(ext)) return file.text();
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(""));
    }
    return pages.join("\n\n");
  }
  if (SPREADSHEET_EXTENSIONS.includes(ext)) return spreadsheetText(await file.arrayBuffer());
  throw new UnsupportedFileError("暂不支持这种格式：请上传 txt、md、csv、docx、pdf 或 Excel（xlsx、xls 等），或把文字粘贴进来");
}

/**
 * Every sheet as a 【name】 heading followed by its rows, cells joined by tabs. Cells show
 * their formatted text as Excel would (formula results, dates, percentages); empty rows and
 * trailing empty cells are dropped.
 */
export async function spreadsheetText(data: ArrayBuffer | Uint8Array): Promise<string> {
  const XLSX = await import("xlsx");
  let book: import("xlsx").WorkBook;
  try {
    book = XLSX.read(data, { type: "array", cellDates: true, dense: true });
  } catch {
    throw new UnsupportedFileError("读不了这个表格文件，可能已损坏或设了打开密码；请另存为 xlsx 后再上传");
  }
  const parts: string[] = [];
  for (const name of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, raw: false, defval: "", blankrows: false });
    const lines = rows
      .map((row) => {
        const cells = row.map((v) => String(v ?? "").replace(/\s*\n\s*/g, " ").trim());
        while (cells.length && !cells[cells.length - 1]) cells.pop();
        return cells.join("\t");
      })
      .filter((line) => line.trim());
    if (lines.length) parts.push(`【${name}】`, ...lines);
  }
  return parts.join("\n");
}
