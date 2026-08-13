"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { MOVE_ITEMS, MoveItem } from "@/lib/moveItems";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type MoveType = "MoveIn" | "MoveOut";

export default function MoveFormModal({
  contractCode,
  type,
  onClose,
  onSubmitted,
}: {
  contractCode: string;
  type: MoveType;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const toast = useToast();
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "blocked">("loading");
  const [reason, setReason] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/contracts/${contractCode}/move?type=${type}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setReason(data.message);
          setLoadingState("blocked");
          return;
        }
        if (!data.canFill) {
          setReason(data.reason);
          setLoadingState("blocked");
          return;
        }
        setMoveInDate(
          data.form?.moveInDate?.slice(0, 10) || data.contract?.moveInDate?.slice(0, 10) || ""
        );
        setNotes(data.form?.notes || "");
        setPhotos(data.form?.photos || {});
        setConditions(data.form?.conditions || {});
        setRemarks(data.form?.remarks || {});
        setLoadingState("ready");
      });
  }, [contractCode, type]);

  async function uploadPhoto(item: MoveItem, file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
      return;
    }
    const arr = photos[item.key] || [];
    if (arr.length >= item.max) {
      toast.warning(`这项最多${item.max}张`);
      return;
    }
    setUploadingKey(item.key);
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/contracts/${contractCode}/move/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: item.key, dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setPhotos((p) => ({ ...p, [item.key]: [...(p[item.key] || []), data.url] }));
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setUploadingKey(null);
    }
  }

  function removePhoto(key: string, i: number) {
    setPhotos((p) => ({ ...p, [key]: (p[key] || []).filter((_, idx) => idx !== i) }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, moveInDate, notes, photos, conditions, remarks }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setTimeout(() => {
          onSubmitted();
          onClose();
        }, 1000);
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
    <Modal onClose={onClose} wide>
      <h3 className="text-lg font-bold text-brand">
        📋 {type === "MoveIn" ? "Move-in" : "Move-out"} Form — {contractCode}
      </h3>

      {loadingState === "loading" && <div className="mt-3 text-sm text-gray-500">载入中...</div>}
      {loadingState === "blocked" && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{reason}</div>
      )}

      {loadingState === "ready" && (
        <div className="mt-3.5 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-gray-600">Move-in Date</label>
            <input type="date" className="input max-w-xs" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} />
          </div>

          {MOVE_ITEMS.map((it) => (
            <div key={it.key} className="rounded-lg border border-gray-200 p-3">
              <b className="text-sm">
                {it.label} {it.required && <span className="text-red-600">*</span>}
              </b>
              <div className="my-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConditions((c) => ({ ...c, [it.key]: "Good" }))}
                  className={`rounded-md px-3 py-1 text-xs ${
                    conditions[it.key] === "Good" ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  ✓ Good 好
                </button>
                <button
                  type="button"
                  onClick={() => setConditions((c) => ({ ...c, [it.key]: "Broken" }))}
                  className={`rounded-md px-3 py-1 text-xs ${
                    conditions[it.key] === "Broken" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  ✗ Broken 坏
                </button>
              </div>
              <div className="my-2 flex flex-wrap gap-1.5">
                {(photos[it.key] || []).map((u, i) => (
                  <div key={i} className="relative">
                    <button type="button" onClick={() => setZoomUrl(u)} className="cursor-zoom-in">
                      <img src={u} alt="" className="h-[60px] rounded border border-gray-300 hover:opacity-90" />
                    </button>
                    <button
                      onClick={() => removePhoto(it.key, i)}
                      className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-600 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingKey === it.key}
                onChange={(e) => e.target.files?.[0] && uploadPhoto(it, e.target.files[0])}
                className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
              />
              <span className="ml-1.5 text-xs text-gray-400">最多{it.max}张</span>
              <input
                placeholder="备注 Remarks (选填)"
                value={remarks[it.key] || ""}
                onChange={(e) => setRemarks((r) => ({ ...r, [it.key]: e.target.value }))}
                className="input mt-1.5"
              />
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-sm text-gray-600">其他备注 Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button onClick={submit} disabled={submitting} className="btn-primary">
            提交表单
          </button>
        </div>
      )}
      {zoomUrl && <Lightbox src={zoomUrl} alt="" onClose={() => setZoomUrl(null)} />}
    </Modal>
  );
}
