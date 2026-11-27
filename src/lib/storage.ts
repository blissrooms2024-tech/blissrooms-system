import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Uploads a base64 data-URL image and returns a URL the browser can load it from.
 * Uses Vercel Blob (private access) when BLOB_READ_WRITE_TOKEN is configured — reads go
 * through /api/blob so only logged-in users can view IC photos/signatures; otherwise falls
 * back to writing into public/uploads so local dev works without any cloud credentials.
 */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function uploadDataUrl(dataUrl: string, filename: string): Promise<string> {
  const match = String(dataUrl).match(/^data:(.+?);base64,(.*)$/);
  if (!match) throw new Error("无效的文件格式");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  // The extension has to reflect the real content type, not whatever the caller guessed
  // (every call site just hardcodes something like "_SLIP.png") — callers that now accept
  // PDF proof-of-payment need the resulting URL to actually end in .pdf so the UI can tell
  // image uploads and PDF uploads apart and render each one correctly.
  const ext = EXT_BY_MIME[mime.toLowerCase()];
  const base = filename.replace(/\.[a-zA-Z0-9]+$/, "");
  const safeName = (ext ? `${base}.${ext}` : filename).replace(/[^a-zA-Z0-9._-]/g, "_");

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: "private",
      contentType: mime,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });
    return `/api/blob?u=${encodeURIComponent(blob.url)}`;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "还没配置 Vercel Blob（文件存储）：去 Vercel 项目的 Storage 标签页建一个 Blob store，" +
        "把生成的 BLOB_READ_WRITE_TOKEN 加到环境变量后重新部署"
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const unique = `${Date.now()}_${safeName}`;
  await writeFile(path.join(dir, unique), buffer);
  return `/uploads/${unique}`;
}
