/**
 * Client-side image compression for phone uploads.
 *
 * Phone cameras produce 3–8MB photos; we shrink them in the browser before upload so tenants
 * never hit the old "图片太大(超过3MB)" wall and uploads are fast on mobile data.
 * Longest side is capped at `maxSide` px and re-encoded as JPEG at `quality`.
 * Non-image files (e.g. PDF) are returned unchanged as a data URL.
 */

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImageToDataUrl(
  file: File,
  { maxSide = 1600, quality = 0.72 }: { maxSide?: number; quality?: number } = {}
): Promise<string> {
  const original = await readAsDataURL(file);
  if (!file.type.startsWith("image/") || file.type === "image/gif") return original;

  try {
    const img = await loadImage(original);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    // White background so transparent PNGs don't turn black as JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", quality);
    // Keep whichever is smaller (an already-tiny image can grow when re-encoded).
    return out.length < original.length ? out : original;
  } catch {
    // HEIC or other format the browser can't decode — fall back to the original bytes.
    return original;
  }
}

/** Approximate decoded byte size of a data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  return Math.floor(((dataUrl.length - i - 1) * 3) / 4);
}

/** Upload limit after compression (server routes accept up to ~4MB request bodies on Vercel). */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
