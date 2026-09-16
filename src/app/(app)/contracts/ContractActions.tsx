"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EditContractModal from "./EditContractModal";
import SignatureModal from "./SignatureModal";
import ICUploadModal from "./ICUploadModal";
import MoveFormModal from "./MoveFormModal";
import PaymentModal from "./PaymentModal";
import WarningLetterModal from "./WarningLetterModal";
import ContractPdfModal from "./ContractPdfModal";

export interface ActionableContract {
  contractCode: string;
  tenantName: string;
  agentName: string;
  agentId: string;
  totalOutstanding: number;
  status: string;
  agentSignature: string | null;
  tenantSignature: string | null;
  _rentEscalated?: boolean;
}

// Shared by the list row (compact: a couple of quick buttons + "更多" dropdown for the rest)
// and the contract detail page (full: everything laid out as one grid, no dropdown needed).
export default function ContractActions({
  contract: c,
  role,
  onChanged,
  variant = "compact",
}: {
  contract: ActionableContract;
  role: string;
  onChanged: () => void;
  variant?: "compact" | "full";
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [icUploading, setIcUploading] = useState(false);
  const [moveForm, setMoveForm] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    const rect = moreBtnRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(rect.right - 160, 8) });
    setMenuOpen(true);
  }

  // Close the dropdown on scroll (the table body scrolls horizontally, the page scrolls
  // vertically) so it never sits over the wrong row once its anchor button has moved.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  async function doAction(fn: "submit" | "approve") {
    const res = await fetch(`/api/contracts/${c.contractCode}/${fn}`, { method: "POST" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    onChanged();
  }

  async function confirmDelete() {
    setDeleting(false);
    const res = await fetch(`/api/contracts/${c.contractCode}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    onChanged();
  }

  async function confirmTerminate() {
    setTerminating(false);
    const res = await fetch(`/api/contracts/${c.contractCode}/terminate-arrears`, { method: "POST" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    onChanged();
  }

  const notClosed = c.status !== "TERMINATED" && c.status !== "MOVED_OUT";

  type Item = { key: string; label: string; color: string; onClick: () => void; primary?: boolean };
  const items: Item[] = [];

  if (role === "ADMIN" || role === "AGENT") {
    items.push({ key: "pay", label: "💰 收款", color: "bg-amber-500", onClick: () => setPaying(true), primary: true });
  }
  if (role === "AGENT" && !c.agentSignature && (c.status === "PENDING_SIGN" || c.status === "ACTIVE")) {
    items.push({ key: "sign", label: "✍️ 签名", color: "bg-pink-600", onClick: () => setSigning(true), primary: true });
  }
  if ((role === "AGENT" || role === "ADMIN") && c.status === "DRAFT") {
    items.push({ key: "submit", label: "📤 提交", color: "bg-brand", onClick: () => doAction("submit"), primary: true });
  }
  if (role === "ADMIN" && c.status === "PENDING_APPROVE") {
    items.push({ key: "approve", label: "✅ 批准", color: "bg-green-700", onClick: () => doAction("approve"), primary: true });
  }
  if (role === "ADMIN" && c._rentEscalated && notClosed) {
    items.push({
      key: "terminate",
      label: "🔒 终止+没收押金",
      color: "bg-red-800",
      onClick: () => setTerminating(true),
      primary: true,
    });
  }
  if (role === "ADMIN") {
    items.push({ key: "ic", label: "🪪 查看IC", color: "bg-violet-600", onClick: () => setIcUploading(true) });
    items.push({ key: "pdf", label: "📎 旧合同 PDF", color: "bg-teal-600", onClick: () => setUploadingPdf(true) });
  }
  if (role === "ADMIN" && c.status === "ACTIVE") {
    items.push({ key: "movein", label: "📋 Move-in", color: "bg-cyan-600", onClick: () => setMoveForm(true) });
  }
  if (role === "ADMIN" && notClosed) {
    items.push({ key: "edit", label: "✏️ 编辑", color: "bg-brand", onClick: () => setEditing(true) });
  }
  if (role === "ADMIN") {
    items.push({ key: "warning", label: "⚠️ 警告信", color: "bg-orange-600", onClick: () => setWarningOpen(true) });
    items.push({ key: "delete", label: "🗑️ 删除", color: "bg-red-600", onClick: () => setDeleting(true) });
  }

  const primaryItems = items.filter((i) => i.primary);
  const secondaryItems = items.filter((i) => !i.primary);

  const agreementLink = (
    <Link
      href={`/agreement/${c.contractCode}`}
      className="flex items-center gap-1 rounded-md bg-gray-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-gray-600"
    >
      📄 合同
    </Link>
  );

  const modals = (
    <>
      {editing && (
        <EditContractModal contractCode={c.contractCode} onClose={() => setEditing(false)} onSaved={onChanged} />
      )}
      {signing && (
        <SignatureModal contractCode={c.contractCode} who="agent" onClose={() => setSigning(false)} onSigned={onChanged} />
      )}
      {icUploading && (
        <ICUploadModal contractCode={c.contractCode} readOnly onClose={() => setIcUploading(false)} onUploaded={onChanged} />
      )}
      {uploadingPdf && (
        <ContractPdfModal contractCode={c.contractCode} onClose={() => setUploadingPdf(false)} onUploaded={onChanged} />
      )}
      {moveForm && (
        <MoveFormModal
          contractCode={c.contractCode}
          type="MoveIn"
          onClose={() => setMoveForm(false)}
          onSubmitted={onChanged}
        />
      )}
      {paying && (
        <PaymentModal
          contractCode={c.contractCode}
          tenantName={c.tenantName}
          role={role}
          onClose={() => setPaying(false)}
          onChanged={onChanged}
        />
      )}
      {warningOpen && (
        <WarningLetterModal contractCode={c.contractCode} tenantName={c.tenantName} onClose={() => setWarningOpen(false)} />
      )}
      <ConfirmDialog
        open={deleting}
        danger
        message={`确定删除合同 ${c.contractCode}？房间会放回空房，这个操作不能撤销。`}
        confirmLabel="确定删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(false)}
      />
      <ConfirmDialog
        open={terminating}
        danger
        message={`确定终止合同 ${c.contractCode}（${c.tenantName}）？押金会标记没收，房间放回空房，这个操作不能撤销。`}
        confirmLabel="确定终止+没收押金"
        onConfirm={confirmTerminate}
        onCancel={() => setTerminating(false)}
      />
    </>
  );

  if (variant === "full") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {agreementLink}
          {items.map((i) => (
            <ActionBtn key={i.key} color={i.color} onClick={i.onClick}>
              {i.label}
            </ActionBtn>
          ))}
        </div>
        {modals}
      </>
    );
  }

  return (
    <div className="relative flex flex-wrap items-start gap-1.5">
      {agreementLink}
      {primaryItems.map((i) => (
        <ActionBtn key={i.key} color={i.color} onClick={i.onClick}>
          {i.label}
        </ActionBtn>
      ))}
      {secondaryItems.length > 0 && (
        <>
          <button
            ref={moreBtnRef}
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            className="rounded-md bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
          >
            ⋯ 更多
          </button>
          {menuOpen && menuPos && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                style={{ top: menuPos.top, left: menuPos.left }}
                className="fixed z-50 flex w-40 flex-col gap-1 rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-black/5"
              >
                {secondaryItems.map((i) => (
                  <button
                    key={i.key}
                    onClick={() => {
                      setMenuOpen(false);
                      i.onClick();
                    }}
                    className="rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {modals}
    </div>
  );
}

function ActionBtn({
  children,
  color,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`rounded-md ${color} px-2.5 py-1 text-xs font-semibold text-white`}>
      {children}
    </button>
  );
}
