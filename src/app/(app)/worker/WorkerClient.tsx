"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";
import Lightbox from "@/components/Lightbox";
import { MAINTENANCE_STATUS_LABELS } from "@/lib/config";

interface Job {
  requestCode: string;
  roomCode: string;
  tenantName: string | null;
  title: string;
  description: string | null;
  photos: string[];
  status: string;
  workerBeforePhotos: string[];
  workerAfterPhotos: string[];
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_BADGE: Record<string, string> = {
  ACKNOWLEDGED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-green-50 text-green-700",
};

export default function WorkerClient() {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/worker/maintenance");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setJobs(data.requests);
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function uploadPhoto(requestCode: string, slot: "before" | "after", file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
      return;
    }
    setUploadingId(`${requestCode}_${slot}`);
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/worker/maintenance/${requestCode}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setUploadingId(null);
    }
  }

  if (!jobs && !error) return <div className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">载入中...</div>;
  if (error) return <div className="rounded-xl bg-white p-5 text-sm text-red-600 shadow-sm">{error}</div>;

  const open = jobs!.filter((j) => j.status !== "COMPLETED" && j.status !== "CANCELLED");
  const done = jobs!.filter((j) => j.status === "COMPLETED" || j.status === "CANCELLED");

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">🔧 我的报修任务 ({open.length})</h3>
        {open.length === 0 && <div className="py-8 text-center text-gray-400">目前没有指派给你的任务</div>}
        <div className="space-y-3">
          {open.map((j) => (
            <div key={j.requestCode} className="rounded-lg border border-gray-200 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm text-gray-500">🏠 {j.roomCode} · {j.tenantName}</div>
                  <b className="text-sm">{j.title}</b>
                  {j.description && <div className="text-xs text-gray-500">{j.description}</div>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[j.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {MAINTENANCE_STATUS_LABELS[j.status] ?? j.status}
                </span>
              </div>

              {j.photos.length > 0 && (
                <div className="mt-2">
                  <div className="mb-1 text-xs text-gray-400">租客拍的问题照片</div>
                  <div className="flex flex-wrap gap-2">
                    {j.photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p} alt="" onClick={() => setZoomUrl(p)} className="h-16 w-16 cursor-pointer rounded-lg border border-gray-200 object-cover" />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
                <PhotoSlot
                  label="📷 Before (到场时拍)"
                  photos={j.workerBeforePhotos}
                  uploading={uploadingId === `${j.requestCode}_before`}
                  onZoom={setZoomUrl}
                  onUpload={(file) => uploadPhoto(j.requestCode, "before", file)}
                />
                <PhotoSlot
                  label="✅ After (完工后拍)"
                  photos={j.workerAfterPhotos}
                  uploading={uploadingId === `${j.requestCode}_after`}
                  onZoom={setZoomUrl}
                  onUpload={(file) => uploadPhoto(j.requestCode, "after", file)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {done.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-3.5 text-base font-semibold text-gray-500">📁 已完成 ({done.length})</h3>
          <div className="space-y-2">
            {done.map((j) => (
              <div key={j.requestCode} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm last:border-none">
                <div>🏠 {j.roomCode} · {j.title}</div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[j.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {MAINTENANCE_STATUS_LABELS[j.status] ?? j.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {zoomUrl && <Lightbox src={zoomUrl} alt="照片" onClose={() => setZoomUrl(null)} />}
    </div>
  );
}

function PhotoSlot({
  label,
  photos,
  uploading,
  onZoom,
  onUpload,
}: {
  label: string;
  photos: string[];
  uploading: boolean;
  onZoom: (url: string) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-gray-600">{label}</div>
      {photos.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt="" onClick={() => onZoom(p)} className="h-14 w-14 cursor-pointer rounded-lg object-cover" />
          ))}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        className="block text-xs text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
      />
      {uploading && <span className="text-xs text-gray-500">上传中...</span>}
    </div>
  );
}
