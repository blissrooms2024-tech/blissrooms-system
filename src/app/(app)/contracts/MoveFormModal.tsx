"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import Lightbox from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
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

/** The actual form content — reused as a plain page section (tenant's own dedicated
 * Move-in/Move-out pages) and, via MoveFormModal below, as the modal Admin still uses
 * from the contracts list. */
export function MoveFormPanel({
  contractCode,
  type,
  onSubmitted,
}: {
  contractCode: string;
  type: MoveType;
  onSubmitted?: () => void;
}) {
  const toast = useToast();
  const { locale, t } = useLanguage();
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [items, setItems] = useState<MoveItem[]>(MOVE_ITEMS);

  const load = useCallback(() => {
    return fetch(`/api/contracts/${contractCode}/move?type=${type}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setReason(data.message);
          setLoadingState("blocked");
          return;
        }
        setIsAdmin(!!data.isAdmin);
        setLocked(!!data.locked);
        setItems(data.items?.length ? data.items : MOVE_ITEMS);
        // Tenant viewing their own locked submission: still show it, read-only, instead of
        // just an error — every other reason (contract not active, no permission, move-out
        // window closed) has no form data worth showing, so those stay a plain blocked message.
        if (!data.canFill && !(data.locked && !data.isAdmin)) {
          setReason(locale === "en" && data.reasonEn ? data.reasonEn : data.reason);
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
  }, [contractCode, type, locale]);

  useEffect(() => {
    load();
  }, [load]);

  const readOnly = locked && !isAdmin;

  async function unlock() {
    setUnlocking(true);
    try {
      const res = await fetch(`/api/contracts/${contractCode}/move/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setUnlocking(false);
    }
  }

  async function uploadPhoto(item: MoveItem, file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning(t("图片太大(超过3MB)，请压缩", "Image too large (over 3MB) — please compress it"));
      return;
    }
    const arr = photos[item.key] || [];
    if (arr.length >= item.max) {
      toast.warning(t(`这项最多${item.max}张`, `Max ${item.max} photos for this item`));
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
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
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
        onSubmitted?.();
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
    <div>
      <h3 className="text-lg font-bold text-brand">
        📋 {type === "MoveIn" ? t("Move-in", "Move-in") : t("Move-out", "Move-out")} {t("表单", "Form")} — {contractCode}
      </h3>

      {type === "MoveOut" && (
        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          {t(
            "📌 Admin 会在检查房间状况后处理退押金：交回钥匙后 30 个工作天内退还押金 (Security/Utilities Deposit)，会先扣除任何欠款或损坏赔偿 — 跟合同条款一致。",
            "📌 Admin processes the deposit refund after inspecting the room: the Security/Utilities Deposit is refunded within 30 working days of handing over the keys, less any amounts owing or damage deductions — per the contract's terms."
          )}
        </div>
      )}

      {loadingState === "loading" && <div className="mt-3 text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
      {loadingState === "blocked" && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{reason}</div>
      )}

      {loadingState === "ready" && (
        <div className="mt-3.5 space-y-3">
          {readOnly && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              {t(
                "✅ 表单已提交并锁定，不能再修改。如需修改请联系 Admin 重新开放。",
                "✅ This form has been submitted and locked — it can't be changed. Contact Admin to reopen it if needed."
              )}
            </div>
          )}
          {isAdmin && locked && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <span>{t("🔒 这张表单已锁定，租客现在不能自己修改。", "🔒 This form is locked — the tenant can't edit it themselves right now.")}</span>
              <button
                onClick={unlock}
                disabled={unlocking}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {unlocking ? t("处理中...", "Processing...") : t("🔓 允许租客修改", "🔓 Allow Tenant to Edit")}
              </button>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm text-gray-600">{t("Move-in Date", "Move-in Date")}</label>
            <input
              type="date"
              disabled={readOnly}
              className="input max-w-xs disabled:bg-gray-50 disabled:text-gray-500"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
            />
          </div>

          {items.map((it) => (
            <div key={it.key} className="rounded-lg border border-gray-200 p-3">
              <b className="text-sm">
                {it.label} {it.required && <span className="text-red-600">*</span>}
              </b>
              <div className="my-1.5 flex gap-1.5">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setConditions((c) => ({ ...c, [it.key]: "Good" }))}
                  className={`rounded-md px-3 py-1 text-xs disabled:cursor-not-allowed ${
                    conditions[it.key] === "Good" ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  ✓ Good 好
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setConditions((c) => ({ ...c, [it.key]: "Broken" }))}
                  className={`rounded-md px-3 py-1 text-xs disabled:cursor-not-allowed ${
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-[60px] rounded border border-gray-300 hover:opacity-90" />
                    </button>
                    {!readOnly && (
                      <button
                        onClick={() => removePhoto(it.key, i)}
                        className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-600 text-xs text-white"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingKey === it.key}
                    onChange={(e) => e.target.files?.[0] && uploadPhoto(it, e.target.files[0])}
                    className="block text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
                  />
                  <span className="ml-1.5 text-xs text-gray-400">{t(`最多${it.max}张`, `Max ${it.max} photos`)}</span>
                </>
              )}
              <input
                placeholder={t("备注 Remarks (选填)", "Remarks (optional)")}
                readOnly={readOnly}
                value={remarks[it.key] || ""}
                onChange={(e) => setRemarks((r) => ({ ...r, [it.key]: e.target.value }))}
                className="input mt-1.5 disabled:bg-gray-50"
              />
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-sm text-gray-600">{t("其他备注 Notes", "Other Notes")}</label>
            <input className="input" readOnly={readOnly} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {!readOnly && (
            <button onClick={submit} disabled={submitting} className="btn-primary">
              {t("提交表单", "Submit Form")}
            </button>
          )}
        </div>
      )}
      {zoomUrl && <Lightbox src={zoomUrl} alt="" onClose={() => setZoomUrl(null)} />}
    </div>
  );
}

/** Thin modal wrapper around MoveFormPanel — Admin still opens this from the contracts list. */
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
  return (
    <Modal onClose={onClose} wide>
      <MoveFormPanel
        contractCode={contractCode}
        type={type}
        onSubmitted={() => {
          onSubmitted();
          setTimeout(onClose, 1000);
        }}
      />
    </Modal>
  );
}
