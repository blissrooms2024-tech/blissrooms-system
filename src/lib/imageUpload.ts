/**
 * Client-side upload helpers. Every photo picked or taken on a phone is shrunk in the browser
 * before it's sent, so nobody has to remember to compress anything themselves:
 *  - longest side capped at MAX_DIMENSION px (plenty to read an IC, receipt or bank slip)
 *  - re-encoded as JPEG, stepping quality/size down until it's under TARGET_BYTES
 * A typical 3–5 MB phone photo ends up around 200–500 KB, which keeps Vercel Blob storage small
 * and keeps every request well under Vercel's ~4.5 MB request-body limit.
 *
 * PDFs and anything the browser can't decode (e.g. HEIC on some Android browsers) are passed
 * through untouched; callers still guard those with isOversized().
 */

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const TARGET_BYTES = 500 * 1024;
/** Small, already-reasonable photos are left exactly as they are. */
const SKIP_BELOW_BYTES = 300 * 1024;

/** Raster images we can decode and re-encode. GIF (animation) and SVG (vector) are left alone. */
export function isCompressibleImage(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp|bmp|heic|heif)$/i.test(file.type);
}

/**
 * True when a file is still too big to upload. Compressible photos never count as oversized
 * here — they're shrunk on upload — so this only ever blocks big PDFs / unusual files.
 */
export function isOversized(file: File, maxBytes = MAX_UPLOAD_BYTES): boolean {
  return !isCompressibleImage(file) && file.size > maxBytes;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toJpeg(source: CanvasImageSource, w: number, h: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  // JPEG has no transparency — paint white first so transparent PNGs don't turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Returns a smaller JPEG version of a photo, or the original file if it can't/needn't shrink. */
export async function compressImage(file: File): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    return file;
  }

  try {
    const { source, width, height } = decoded;
    if (file.size <= SKIP_BELOW_BYTES && Math.max(width, height) <= MAX_DIMENSION) return file;

    const attempts: Array<[number, number]> = [
      [MAX_DIMENSION, 0.8],
      [MAX_DIMENSION, 0.65],
      [1280, 0.65],
      [1024, 0.6],
    ];
    let best: Blob | null = null;
    for (const [maxDim, quality] of attempts) {
      const scale = Math.min(1, maxDim / Math.max(width, height));
      const blob = await toJpeg(source, Math.round(width * scale), Math.round(height * scale), quality);
      if (!blob) break;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!best || best.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([best], name, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    decoded.close();
  }
}

function fileToDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Compresses photos first, then returns a base64 data-URL ready to POST. */
export async function readAsDataURL(file: File): Promise<string> {
  return fileToDataURL(await compressImage(file));
}
