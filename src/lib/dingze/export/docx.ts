import { diagramPng } from "../diagram-image";
import type { PlanBookModel } from "../plan-book";

const BRAND = "0C3D52";

/** Write a plan book to .docx in the browser (the docx library loads on demand). */
export async function downloadPlanBookDocx(fileName: string, model: PlanBookModel, draft: boolean) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D1D6" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (value: string, header = false) =>
    new TableCell({
      borders,
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "E8EEF1" } : undefined,
      children: (value || "").split("\n").map(
        (line) => new Paragraph({ children: [new TextRun({ text: line, bold: header, size: 20, color: header ? BRAND : undefined })] })
      ),
    });

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: model.title, bold: true, size: 40, color: BRAND })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: draft ? `${model.subtitle} · 草稿（未定版，仅供讨论）` : model.subtitle, size: 22, color: draft ? "B42318" : "5B6B73" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: `编制时间：${new Date().toLocaleDateString("zh-CN")}`, size: 20, color: "5B6B73" })],
    }),
  ];

  // 版本与来源 (验收 D01 / D08): which version this file is and which table versions it was built from.
  if (model.provenance) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: "版本与来源", color: BRAND })] }));
    for (const line of model.provenance.lines) children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: line, size: 20 })] }));
    if (model.provenance.sources.length) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: ["编号", "引用的成果", "版本"].map((h) => cell(h, true)) }),
            ...model.provenance.sources.map((x) => new TableRow({ children: [cell(x.specId), cell(x.name), cell(x.version)] })),
          ],
        })
      );
    }
  }

  for (const chapter of model.chapters) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 120 }, children: [new TextRun({ text: `${chapter.no}、${chapter.title}`, color: BRAND })] }));
    for (const block of chapter.blocks) {
      if (block.kind === "heading") {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: block.text })] }));
      } else if (block.kind === "text" || block.kind === "note") {
        for (const line of block.text.split("\n")) {
          children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: line, italics: block.kind === "note", color: block.kind === "note" ? "5B6B73" : undefined })] }));
        }
      } else if (block.kind === "figure") {
        // Word 2016+ shows the vector SVG; older readers fall back to the PNG.
        const png = await (await diagramPng(block.diagram)).arrayBuffer();
        const width = 600;
        const height = Math.round((block.diagram.height / block.diagram.width) * width);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 },
            children: [
              new ImageRun({
                type: "svg",
                data: new TextEncoder().encode(block.diagram.svg),
                fallback: { type: "png", data: png },
                transformation: { width, height },
                altText: { name: block.caption, title: block.caption, description: block.caption },
              }),
            ],
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: block.caption, size: 18, color: "5B6B73" })] })
        );
      } else if (block.rows.length) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ tableHeader: true, children: block.headers.map((h) => cell(h, true)) }), ...block.rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) }))],
          }),
          new Paragraph({ children: [] })
        );
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: "（无）", italics: true, color: "5B6B73" })] }));
      }
    }
  }

  const doc = new Document({
    creator: "自驱战略 · 定三责",
    title: model.title,
    styles: { default: { document: { run: { font: "Microsoft YaHei", size: 21 } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.replace(/[\\/:*?"<>|]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
