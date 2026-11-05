/** Browser-only: make a picture small enough to upload. */

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("Could not encode the image"))), "image/jpeg", q));

/** Draw an image file on a white canvas, no larger than `maxSide` pixels on its long side. */
export async function imageToCanvas(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Squeeze a canvas into a JPEG under `maxBytes` (lower quality first, then smaller size). */
export async function shrinkCanvas(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let c = canvas;
  for (let scale = 1; ; scale *= 0.8) {
    if (scale < 1) {
      const next = document.createElement("canvas");
      next.width = Math.round(canvas.width * scale);
      next.height = Math.round(canvas.height * scale);
      next.getContext("2d")!.drawImage(canvas, 0, 0, next.width, next.height);
      c = next;
    }
    for (const q of [0.9, 0.78, 0.65]) {
      const blob = await toBlob(c, q);
      if (blob.size <= maxBytes) return blob;
    }
    if (scale < 0.3) throw new Error("That picture is too large to upload");
  }
}
