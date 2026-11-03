/** Browser-only: loads pdf.js on demand and reads text from PDFs. */
import { tableFromItems, type TextItem } from "./pdf-table";

export interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number; scale: number; transform: number[] };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
  getTextContent(): Promise<{ items: { str?: string; transform: number[]; width: number; height: number }[] }>;
}
export interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
export interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(o: { data: ArrayBuffer }): { promise: Promise<PdfDoc> };
  Util: { transform(a: number[], b: number[]): number[] };
}

// pdf.js (v3.11, Apache-2.0) is served from /public/pdfjs and loaded as a plain script, so
// the bundler never has to process it.
let pdfjs: Promise<PdfJs> | null = null;
export const loadPdfJs = () =>
  (pdfjs ??= new Promise<PdfJs>((ok, fail) => {
    const tag = document.createElement("script");
    tag.src = "/pdfjs/pdf.min.js";
    tag.onload = () => {
      const lib = (window as unknown as { pdfjsLib: PdfJs }).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
      ok(lib);
    };
    tag.onerror = () => fail(new Error("Could not load the PDF reader"));
    document.head.appendChild(tag);
  }));

/** The text of every page of a PDF, rebuilt as a grid of cells (empty for a scanned PDF). */
export async function readPdfTable(file: File): Promise<string[][]> {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const items: TextItem[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const view = page.getViewport({ scale: 1 });
    for (const it of (await page.getTextContent()).items) {
      if (!it.str?.trim()) continue;
      const t = lib.Util.transform(view.transform, it.transform);
      items.push({ str: it.str, x: t[4], y: t[5] + n * 100000, w: it.width, h: it.height }); // pages stacked
    }
  }
  return tableFromItems(items);
}
