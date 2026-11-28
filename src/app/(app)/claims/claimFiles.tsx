"use client";
import { readAsDataURL } from "@/lib/imageUpload";

/** Shared by the claims list and the new-claim sheet. */

export const COMPANY = "__COMPANY__";
export const MAX_RECEIPTS = 6;

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function isPdfUrl(url: string) {
  try {
    return /\.pdf($|[^a-z])/i.test(decodeURIComponent(url));
  } catch {
    return /\.pdf/i.test(url);
  }
}

/** Compresses a photo (PDFs go as they are) and uploads it; returns its private link. */
export async function uploadClaimFile(file: File): Promise<string> {
  const dataUrl = await readAsDataURL(file);
  const res = await fetch("/api/claims/receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  const data = await res.json().catch(() => ({ success: false, message: "上传失败" }));
  if (!data.success) throw new Error(data.message || "上传失败");
  return data.url as string;
}

export function FileThumb({ url, onView }: { url: string; onView: (u: string) => void }) {
  if (isPdfUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600"
      >
        <span className="text-2xl">📄</span>PDF
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onView(url)} className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
    </button>
  );
}
