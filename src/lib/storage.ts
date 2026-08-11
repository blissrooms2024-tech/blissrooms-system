import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Uploads a base64 data-URL image and returns its public URL.
 * Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is configured; otherwise falls back to
 * writing into public/uploads so local dev works without any cloud credentials.
 */
export async function uploadDataUrl(dataUrl: string, filename: string): Promise<string> {
  const match = String(dataUrl).match(/^data:(.+?);base64,(.*)$/);
  if (!match) throw new Error("无效的图片格式");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: "public",
      contentType: mime,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });
    return blob.url;
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
