import { MATERIAL_ACCEPT, UnsupportedFileError, extractText } from "./extract-text";

// 填表时上传的附件：文字型文件（Word / PDF / Excel / 文本）在浏览器里抽出文字；图片和扫描件 PDF
// 转成图片交给多模态模型识图。两条路最后都走“数字咨询师 → 修改卡 → 确认写入”。

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
export const ATTACHMENT_ACCEPT = [MATERIAL_ACCEPT, ...IMAGE_EXTENSIONS.map((e) => `.${e}`)].join(",");
/** 扫描件最多转这么多页给模型看。 */
export const MAX_SCAN_PAGES = 8;
/** 抽出的文字少于这个数就当扫描件处理。 */
const SCAN_TEXT_THRESHOLD = 40;

export type PreparedAttachment = {
  /** 抽出的文字；图片或扫描件为空串。 */
  text: string;
  /** 交给模型识图的图片（原图，或扫描件逐页渲染出来的 PNG）。 */
  images: File[];
  /** 扫描件总页数（超过 MAX_SCAN_PAGES 时只转前几页）。 */
  pages: number;
};

const extOf = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isImage = (file: File) => file.type.startsWith("image/") || IMAGE_EXTENSIONS.includes(extOf(file));

/** Render the first pages of a PDF to PNG files (scanned documents have no text layer). */
async function pdfPagesToImages(file: File): Promise<{ images: File[]; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const images: File[] = [];
  const base = file.name.replace(/\.[^.]+$/, "");
  for (let i = 1; i <= Math.min(doc.numPages, MAX_SCAN_PAGES); i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持画布，转不了扫描件");
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) images.push(new File([blob], `${base}-第${i}页.png`, { type: "image/png" }));
  }
  return { images, pages: doc.numPages };
}

/** Text or pictures for one uploaded file; throws UnsupportedFileError for formats nobody can read. */
export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  if (isImage(file)) return { text: "", images: [file], pages: 1 };
  const text = await extractText(file).catch((error) => {
    if (error instanceof UnsupportedFileError) throw error;
    return "";
  });
  if (text.trim().length >= SCAN_TEXT_THRESHOLD || extOf(file) !== "pdf") return { text, images: [], pages: 0 };
  const scan = await pdfPagesToImages(file);
  return { text: "", ...scan };
}
