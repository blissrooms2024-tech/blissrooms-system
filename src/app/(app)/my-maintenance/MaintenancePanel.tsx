"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import Lightbox from "@/components/Lightbox";
import StepTimeline, { TimelineStep } from "@/components/StepTimeline";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { maintenanceStatusLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";

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

const FLOW = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"];

function buildSteps(r: MaintenanceRow, locale: "zh" | "en", t: (zh: string, en: string) => string): TimelineStep[] {
  if (r.status === "CANCELLED") {
    return [
      { label: maintenanceStatusLabel("SUBMITTED", locale), sublabel: fmtDate(r.createdAt), state: "done" },
      { label: t("已取消", "Cancelled"), sublabel: r.adminNote ?? undefined, state: "rejected" },
    ];
  }
  const currentIndex = FLOW.indexOf(r.status);
  return FLOW.map((s, i) => {
    let sublabel: string | undefined;
    if (i === 0) sublabel = fmtDate(r.createdAt);
    else if (i === currentIndex && s === "COMPLETED") sublabel = r.resolvedAt ? fmtDate(r.resolvedAt) : undefined;
    else if (s === "ACKNOWLEDGED" && i > currentIndex) sublabel = t("预计3天内受理", "Expected to be acknowledged within 3 days");
    else if (s === "IN_PROGRESS" && i === currentIndex) sublabel = t("处理中需要时间，请耐心等待", "This takes time to fix — thanks for your patience");
    return {
      label: maintenanceStatusLabel(s, locale),
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
  const { locale, t } = useLanguage();
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
      toast.warning(t("图片太大(超过3MB)，请压缩", "Image too large (over 3MB) — please compress it"));
      return;
    }
    if (photos.length >= 3) {
      toast.warning(t("最多传 3 张照片", "Max 3 photos"));
      return;
    }
    const dataUrl = await readAsDataURL(file);
    setPhotos((p) => [...p, dataUrl]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning(t("请填标题, 简单说一下什么坏了", "Please enter a title — briefly describe what's broken"));
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-brand">
        {t("🔧 报修", "🔧 Maintenance")} — {contractCode}
      </h3>

      <div className="my-3 rounded-lg border border-gray-200 bg-brand-light/40 p-3">
        <b className="mb-2 block text-sm text-brand">{t("➕ 提交新报修", "➕ Submit New Request")}</b>
        <form onSubmit={submit} className="space-y-2.5">
          <input
            className="input"
            placeholder={t("标题，例如: 冷气不制冷", "Title, e.g.: Air-cond not cooling")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder={t("详细说明 (可选)", "Details (optional)")}
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
            {submitting ? t("提交中...", "Submitting...") : t("提交报修", "Submit Request")}
          </button>
        </form>
      </div>

      <b className="mb-1.5 block text-sm">{t("📋 我的报修记录", "📋 My Maintenance Requests")}</b>
      {requests.length === 0 && (
        <div className="py-4 text-center text-sm text-gray-400">{t("还没有报修记录", "No maintenance requests yet")}</div>
      )}
      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.requestCode} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-gray-400">🧾 {r.requestCode}</div>
                <b className="text-sm">{r.title}</b>
                {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
              </div>
              <span className="whitespace-nowrap text-xs text-gray-400">
                {t("收到日期", "Received")} {fmtDate(r.createdAt)}
              </span>
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
            <StepTimeline steps={buildSteps(r, locale, t)} />
            {r.assignedTo && (
              <div className="mt-1 text-xs text-gray-500">
                {t("处理人", "Assigned to")}: {r.assignedTo}
              </div>
            )}
            {r.status !== "CANCELLED" && r.adminNote && (
              <div className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">📝 {r.adminNote}</div>
            )}
          </div>
        ))}
      </div>

      {zoomUrl && <Lightbox src={zoomUrl} alt={t("报修照片", "Maintenance Photo")} onClose={() => setZoomUrl(null)} />}
    </div>
  );
}
