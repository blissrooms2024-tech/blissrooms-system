"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useT } from "@/components/LanguageProvider";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ContractPdfModal({
  contractCode,
  onClose,
  onUploaded,
}: {
  contractCode: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const [pdfLink, setPdfLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${contractCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPdfLink(data.contract.pdfLink || null);
      })
      .finally(() => setLoading(false));
  }, [contractCode]);

  async function upload(file: File) {
    if (file.type !== "application/pdf") {
      toast.warning(t("请上传 PDF 文件", "Please upload a PDF file"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning(t("文件太大(超过10MB)，请压缩", "File too large (over 10MB) — please compress it"));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readAsDataURL(file);
      const res = await fetch(`/api/contracts/${contractCode}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setPdfLink(data.url);
        onUploaded();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-3.5 text-lg font-bold text-brand">📎 {t("旧合同 PDF", "Legacy Contract PDF")} — {contractCode}</h3>
      <p className="mb-3.5 text-sm text-gray-500">
        {t(
          "上传已经签好的旧合同扫描件/PDF，租客登入「我的租约」就能看到并下载。",
          "Upload a scan/PDF of the already-signed legacy contract — the tenant can view and download it under \"My Tenancy\"."
        )}
      </p>

      {loading ? (
        <div className="text-sm text-gray-400">{t("载入中...", "Loading...")}</div>
      ) : (
        <>
          {pdfLink ? (
            <a
              href={pdfLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3.5 flex items-center gap-2 rounded-lg bg-brand-light/40 p-3 text-sm text-brand underline"
            >
              📄 {t("查看目前上传的 PDF", "View the currently uploaded PDF")}
            </a>
          ) : (
            <div className="mb-3.5 text-sm text-gray-400">{t("还没上传", "Not uploaded yet")}</div>
          )}

          <input
            type="file"
            accept="application/pdf"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark disabled:opacity-50"
          />
          {uploading && <span className="mt-2 block text-sm text-gray-500">{t("上传中...", "Uploading...")}</span>}
          {pdfLink && (
            <p className="mt-2 text-xs text-gray-400">
              {t("再上传一次会替换掉现有的文件。", "Uploading again will replace the current file.")}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
