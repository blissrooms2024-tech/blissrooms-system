"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ICUploadModal({
  contractCode,
  onClose,
  onUploaded,
}: {
  contractCode: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [loadingSide, setLoadingSide] = useState<"front" | "back" | null>(null);

  useEffect(() => {
    fetch(`/api/contracts/${contractCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setFront(data.contract.icFront || null);
          setBack(data.contract.icBack || null);
        }
      });
  }, [contractCode]);

  async function upload(side: "front" | "back", file: File) {
    if (file.size > 3 * 1024 * 1024) {
      toast.warning("图片太大(超过3MB)，请压缩");
      return;
    }
    setLoadingSide(side);
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/contracts/${contractCode}/ic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        if (side === "front") setFront(data.url);
        else setBack(data.url);
        onUploaded();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger("系统出错，请稍后再试");
    } finally {
      setLoadingSide(null);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-brand">🪪 上传 IC / 护照 — {contractCode}</h3>
      <p className="mt-1 text-sm text-gray-500">正反面都要上传。上传后才可以签名。</p>
      <Slot label="正面 Front" side="front" url={front} loading={loadingSide === "front"} onPick={(f) => upload("front", f)} />
      <Slot label="背面 Back" side="back" url={back} loading={loadingSide === "back"} onPick={(f) => upload("back", f)} />
    </Modal>
  );
}

function Slot({
  label,
  url,
  loading,
  onPick,
}: {
  label: string;
  side: "front" | "back";
  url: string | null;
  loading: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <div className="mt-2.5 rounded-lg border border-gray-200 p-3">
      <b className="text-sm">{label}</b>
      <div className="my-2">
        {url ? (
          <img src={url} alt={label} className="max-h-[120px] rounded border border-gray-300" />
        ) : (
          <span className="text-sm text-gray-400">还没上传</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        disabled={loading}
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
        className="text-sm"
      />
      {loading && <span className="ml-2 text-sm text-gray-500">上传中...</span>}
    </div>
  );
}
