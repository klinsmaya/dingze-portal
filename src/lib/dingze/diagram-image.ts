import type { SvgDiagram } from "./diagram-svg";

// Browser-only helpers around the SVG diagrams: rasterize to PNG and save files.

/** Draw the SVG on a canvas at `scale`× and return PNG bytes. */
export async function diagramPng(diagram: SvgDiagram, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([diagram.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(diagram.width * scale);
    canvas.height = Math.round(diagram.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持画布");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("生成图片失败"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.replace(/[\\/:*?"<>|]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadDiagram(diagram: SvgDiagram, baseName: string, format: "svg" | "png") {
  const blob = format === "svg" ? new Blob([diagram.svg], { type: "image/svg+xml;charset=utf-8" }) : await diagramPng(diagram);
  saveBlob(blob, `${baseName}.${format}`);
}
