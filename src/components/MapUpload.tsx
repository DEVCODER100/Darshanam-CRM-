"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MapLabel } from "@/db/schema";
import { detectLabels } from "@/lib/map-boxes";
import { loadPdfJs } from "@/lib/pdfjs-loader";
import { imageToCanvas, shrinkCanvas } from "@/lib/image-shrink";

const MAX_SIDE = 3200; // longest side of the stored map image, in pixels
const MAX_BYTES = 4_200_000; // stay under the host's upload limit

/** First page of a PDF as an image, plus the unit-number-like text on it. */
async function fromPdf(file: File) {
  const lib = await loadPdfJs();
  const page = await (await lib.getDocument({ data: await file.arrayBuffer() }).promise).getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(4, MAX_SIDE / Math.max(base.width, base.height)) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const items: MapLabel[] = [];
  for (const it of (await page.getTextContent()).items) {
    if (!it.str?.trim()) continue;
    const t = lib.Util.transform(viewport.transform, it.transform); // page space -> image pixels
    const h = it.height * viewport.scale;
    items.push({
      label: it.str,
      x: (t[4] / canvas.width) * 100,
      y: ((t[5] - h) / canvas.height) * 100,
      w: ((it.width * viewport.scale) / canvas.width) * 100,
      h: (h / canvas.height) * 100,
    });
  }
  return { canvas, detected: detectLabels(items) };
}

async function fromImage(file: File) {
  return { canvas: await imageToCanvas(file, MAX_SIDE), detected: [] as MapLabel[] };
}

/** Upload a site map (picture or PDF). PDFs are turned into a picture here, in the browser. */
export function MapUpload() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    try {
      setStatus(/\.pdf$/i.test(file.name) ? "Reading the PDF…" : "Preparing the picture…");
      const { canvas, detected } = /\.pdf$/i.test(file.name) ? await fromPdf(file) : await fromImage(file);
      setStatus("Uploading…");
      const form = new FormData();
      form.append("file", new File([await shrinkCanvas(canvas, MAX_BYTES)], "map.jpg", { type: "image/jpeg" }));
      form.append("name", name || file.name.replace(/\.[^.]+$/, ""));
      form.append("width", String(canvas.width));
      form.append("height", String(canvas.height));
      form.append("detected", JSON.stringify(detected));
      const res = await fetch("/api/maps", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setOpen(false);
      router.push(`/dashboard?view=map&map=${body.id}&edit=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setStatus(null);
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary px-3 py-1.5">
        Upload map
      </button>
    );

  return (
    <form onSubmit={submit} className="card basis-full space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">Upload a site map</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink">✕</button>
      </div>
      <p className="text-muted">
        A PDF (first page) or a picture (PNG / JPG). If the PDF has typed unit numbers, boxes can be created from them automatically;
        otherwise you place boxes by hand or with the auto-grid.
      </p>
      <input type="file" accept=".pdf,.png,.jpg,.jpeg" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block" />
      <label className="block max-w-sm text-xs text-muted">
        Map name
        <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Phase 1 layout" />
      </label>
      <p className="text-xs text-muted">The map goes into the project selected at the top.</p>
      <button disabled={!file || !!status} className="btn-primary">{status ?? "Upload"}</button>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
