"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useToast } from "@/components/Toast";

interface MaintenanceRow {
  requestCode: string;
  title: string;
  description: string | null;
  photos: string[];
  status: string;
  assignedTo: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const FLOW = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED"];
const FLOW_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  ACKNOWLEDGED: "已受理",
  IN_PROGRESS: "处理中",
  COMPLETED: "已完成",
};

function buildSteps(r: MaintenanceRow): TimelineStep[] {
  if (r.status === "CANCELLED") {
    return [
      { label: "已提交", sublabel: r.createdAt.slice(0, 10), state: "done" },
      { label: "已取消", sublabel: r.adminNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = FLOW.indexOf(r.status);
  return FLOW.map((s, i) => {
    let sublabel: string | undefined;
    if (i === 0) sublabel = r.createdAt.slice(0, 10);
    else if (i === currentIndex && s === "COMPLETED") sublabel = r.resolvedAt?.slice(0, 10) ?? undefined;
    else if (s === "ACKNOWLEDGED" && i > currentIndex) sublabel = "预计3天内受理";
    else if (s === "IN_PROGRESS" && i === currentIndex) sublabel = "处理中需要时间，请耐心等待";
    return {
      label: FLOW_LABELS[s],
      sublabel,
      state: i < currentIndex || (i === currentIndex && s === "COMPLETED") ? "done" : i === currentIndex ? "active" : "pending",
    };
  });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MaintenancePanel({ contractCode }: { contractCode: string }) {
  const toast = useToast();
  const [requests, setRequests] = useState<MaintenanceRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${contractCode}/maintenance`);
    const data = await res.json();
    if (data.success) setRequests(data.requests);
  }, [contractCode]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function addPhoto(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
      return;
    }
    if (photos.length >= 3) {
      toast.warning("最多传 3 张照片");
      return;
    }
    const dataUrl = await readAsDataURL(file);
    setPhotos((p) => [...p, dataUrl]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning("请填标题, 简单说一下什么坏了");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, photos }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTitle("");
        setDescription("");
        setPhotos([]);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-brand">🔧 报修 — {contractCode}</h3>

      <div className="my-3 rounded-lg border border-gray-200 bg-brand-light/40 p-3">
        <b className="mb-2 block text-sm text-brand">➕ 提交新报修</b>
        <form onSubmit={submit} className="space-y-2.5">
          <input
            className="input"
            placeholder="标题，例如: 冷气不制冷"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="详细说明 (可选)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])}
              className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark"
            />
            {photos.length > 0 && (
              <div className="mt-2 flex gap-2">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "提交中..." : "提交报修"}
          </button>
        </form>
      </div>

      <b className="mb-1.5 block text-sm">📋 我的报修记录</b>
      {requests.length === 0 && <div className="py-4 text-center text-sm text-gray-400">还没有报修记录</div>}
      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.requestCode} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <b className="text-sm">{r.title}</b>
                {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
              </div>
              <span className="whitespace-nowrap text-xs text-gray-400">{r.createdAt.slice(0, 10)}</span>
            </div>
            {r.photos.length > 0 && (
              <div className="mb-2 flex gap-2">
                {r.photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={p}
                    alt=""
                    onClick={() => setZoomUrl(p)}
                    className="h-14 w-14 cursor-pointer rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
            <StepTimeline steps={buildSteps(r)} />
            {r.assignedTo && <div className="mt-1 text-xs text-gray-500">处理人: {r.assignedTo}</div>}
          </div>
        ))}
      </div>

      {zoomUrl && <Lightbox src={zoomUrl} alt="报修照片" onClose={() => setZoomUrl(null)} />}
    </div>
  );
}
