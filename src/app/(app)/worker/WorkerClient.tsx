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
  cost: number | null;
  costPaidAt: string | null;
}

function fmt(v: number | null) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
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

  async function uploadPhotos(requestCode: string, slot: "before" | "after", existingCount: number, files: FileList) {
    const room = 5 - existingCount;
    if (room <= 0) {
      toast.warning("最多只能传5张照片");
      return;
    }
    const toUpload = Array.from(files).slice(0, room);
    if (files.length > room) {
      toast.warning(`最多只能传5张，只上传前 ${room} 张`);
    }

    setUploadingId(`${requestCode}_${slot}`);
    try {
      for (const file of toUpload) {
        if (file.size > 3 * 1024 * 1024) {
          toast.warning(`${file.name} 太大(超过3MB)，跳过`);
          continue;
        }
        const dataUrl = await readAsDataURL(file);
        const res = await fetch(`/api/worker/maintenance/${requestCode}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot, dataUrl }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.danger(data.message);
          break;
        }
      }
      toast.success("✅ 照片已上传");
      load();
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

  const paidJobs = jobs!.filter((j) => j.costPaidAt && j.cost != null);
  const totalEarned = paidJobs.reduce((sum, j) => sum + Number(j.cost), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthEarned = paidJobs
    .filter((j) => j.costPaidAt!.slice(0, 7) === thisMonth)
    .reduce((sum, j) => sum + Number(j.cost), 0);

  const byMonth = new Map<string, Job[]>();
  for (const j of paidJobs) {
    const month = j.costPaidAt!.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(j);
  }
  const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">💰 我的薪水单</h3>
        <div className="mb-3.5 flex flex-wrap gap-3">
          <div className="rounded-lg bg-brand/5 px-4 py-2.5">
            <div className="text-xs text-gray-500">本月已领</div>
            <div className="text-lg font-semibold text-brand">{fmt(thisMonthEarned)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-2.5">
            <div className="text-xs text-gray-500">累计已领</div>
            <div className="text-lg font-semibold text-gray-700">{fmt(totalEarned)}</div>
          </div>
        </div>
        {months.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">还没有工钱记录</div>
        ) : (
          <div className="space-y-3">
            {months.map((month) => {
              const rows = byMonth.get(month)!;
              const subtotal = rows.reduce((sum, j) => sum + Number(j.cost), 0);
              return (
                <div key={month}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <b className="text-sm">{month}</b>
                    <span className="text-sm font-semibold text-brand">{fmt(subtotal)}</span>
                  </div>
                  <div className="space-y-1 rounded-lg border border-gray-100 p-2">
                    {rows.map((j) => (
                      <div key={j.requestCode} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                        <span>🏠 {j.roomCode} · {j.title} · {j.costPaidAt}</span>
                        <span className="font-semibold text-gray-800">{fmt(j.cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                  onUpload={(files) => uploadPhotos(j.requestCode, "before", j.workerBeforePhotos.length, files)}
                />
                <PhotoSlot
                  label="✅ After (完工后拍)"
                  photos={j.workerAfterPhotos}
                  uploading={uploadingId === `${j.requestCode}_after`}
                  onZoom={setZoomUrl}
                  onUpload={(files) => uploadPhotos(j.requestCode, "after", j.workerAfterPhotos.length, files)}
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
                <div>
                  🏠 {j.roomCode} · {j.title}
                  {j.cost != null && <span className="text-gray-500"> · {fmt(j.cost)}</span>}
                </div>
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
  onUpload: (files: FileList) => void;
}) {
  const atLimit = photos.length >= 5;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-xs text-gray-400">{photos.length}/5 张 (最少1张)</span>
      </div>
      {photos.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt="" onClick={() => onZoom(p)} className="h-14 w-14 cursor-pointer rounded-lg object-cover" />
          ))}
        </div>
      )}
      {atLimit ? (
        <div className="text-xs text-gray-400">已达上限</div>
      ) : (
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files?.length) onUpload(e.target.files);
            e.target.value = "";
          }}
          className="block text-xs text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
        />
      )}
      {uploading && <span className="text-xs text-gray-500">上传中...</span>}
    </div>
  );
}
