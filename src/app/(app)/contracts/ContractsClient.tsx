"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTRACT_STATUS_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EditContractModal from "./EditContractModal";
import SignatureModal from "./SignatureModal";
import ICUploadModal from "./ICUploadModal";
import MoveFormModal from "./MoveFormModal";
import PaymentModal from "./PaymentModal";
import WarningLetterModal from "./WarningLetterModal";

interface Contract {
  contractCode: string;
  roomCode?: string;
  tenantName: string;
  agentName: string;
  agentId: string;
  totalOutstanding: number;
  status: string;
  agentSignature: string | null;
  tenantSignature: string | null;
  _paid: number;
  _outstanding: number;
  _rentEscalated?: boolean;
  room?: { roomCode: string };
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}

export default function ContractsClient({ role }: { role: string }) {
  const toast = useToast();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const [icUploading, setIcUploading] = useState<string | null>(null);
  const [moveForm, setMoveForm] = useState<string | null>(null);
  const [paying, setPaying] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [warningFor, setWarningFor] = useState<Contract | null>(null);
  const [terminating, setTerminating] = useState<Contract | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/contracts/page-data");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setContracts(data.contracts);
    } catch {
      setError("出错，请稍后再试");
    }
  }, []);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function doAction(fn: "submit" | "approve", contractCode: string) {
    const res = await fetch(`/api/contracts/${contractCode}/${fn}`, { method: "POST" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const contractCode = deleting;
    setDeleting(null);
    const res = await fetch(`/api/contracts/${contractCode}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  async function confirmTerminate() {
    if (!terminating) return;
    const contractCode = terminating.contractCode;
    setTerminating(null);
    const res = await fetch(`/api/contracts/${contractCode}/terminate-arrears`, { method: "POST" });
    const data = await res.json();
    if (data.success) toast.success(data.message);
    else toast.danger(data.message);
    load();
  }

  const canCreate = role === "AGENT" || role === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">合同清单</h3>
          {canCreate && (
            <Link href="/contracts/new" className="btn-primary text-sm">
              📝 开新合同
            </Link>
          )}
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!contracts && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {contracts && contracts.length > 0 && (
          <div className="mb-1.5 text-xs text-gray-400 sm:hidden">👉 表格可以左右滑动，查看「收款」等操作按钮</div>
        )}
        {contracts && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="sticky left-0 z-[1] bg-gray-50">合同号</Th>
                  <Th>房间</Th>
                  <Th>租客</Th>
                  <Th>Agent</Th>
                  <Th>总款</Th>
                  <Th>已收</Th>
                  <Th>还欠</Th>
                  <Th>状态</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-gray-400">
                      还没有合同
                    </td>
                  </tr>
                )}
                {contracts.map((c) => (
                  <tr key={c.contractCode} className="border-b border-gray-100 align-top">
                    <Td className="sticky left-0 z-[1] bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                      <b>{c.contractCode}</b>
                    </Td>
                    <Td>{c.room?.roomCode}</Td>
                    <Td>{c.tenantName}</Td>
                    <Td>{c.agentName}</Td>
                    <Td>{fmt(c.totalOutstanding)}</Td>
                    <Td>{fmt(c._paid)}</Td>
                    <Td>
                      {c._outstanding > 0 ? (
                        <span className="font-semibold text-red-600">{fmt(c._outstanding)}</span>
                      ) : (
                        <span className="text-green-700">✅清</span>
                      )}
                    </Td>
                    <Td>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                      {c._rentEscalated && (
                        <div className="mt-1 whitespace-normal rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                          ⚠️ 租金逾期超10天
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/agreement/${c.contractCode}`}
                          className="flex items-center gap-1 rounded-md bg-gray-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-gray-600"
                        >
                          📄 合同
                        </Link>
                        {role === "ADMIN" && (
                          <ActionBtn color="bg-amber-500" onClick={() => setPaying(c)}>
                            💰 收款
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && (
                          <ActionBtn color="bg-violet-600" onClick={() => setIcUploading(c.contractCode)}>
                            🪪 查看IC
                          </ActionBtn>
                        )}
                        {role === "AGENT" && !c.agentSignature && (c.status === "PENDING_SIGN" || c.status === "ACTIVE") && (
                          <ActionBtn color="bg-pink-600" onClick={() => setSigning(c.contractCode)}>
                            ✍️ 签名
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && c.status === "ACTIVE" && (
                          <ActionBtn color="bg-cyan-600" onClick={() => setMoveForm(c.contractCode)}>
                            📋 Move-in
                          </ActionBtn>
                        )}
                        {(role === "AGENT" || role === "ADMIN") && c.status === "DRAFT" && (
                          <ActionBtn color="bg-brand" onClick={() => doAction("submit", c.contractCode)}>
                            📤 提交
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && c.status === "PENDING_APPROVE" && (
                          <ActionBtn color="bg-green-700" onClick={() => doAction("approve", c.contractCode)}>
                            ✅ 批准
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && (c.status === "DRAFT" || c.status === "PENDING_APPROVE") && (
                          <ActionBtn color="bg-brand" onClick={() => setEditing(c.contractCode)}>
                            ✏️ 编辑
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && (
                          <ActionBtn color="bg-orange-600" onClick={() => setWarningFor(c)}>
                            ⚠️ 警告信
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && c._rentEscalated && c.status !== "TERMINATED" && c.status !== "MOVED_OUT" && (
                          <ActionBtn color="bg-red-800" onClick={() => setTerminating(c)}>
                            🔒 终止+没收押金
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && (
                          <ActionBtn color="bg-red-600" onClick={() => setDeleting(c.contractCode)}>
                            🗑️ 删除
                          </ActionBtn>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditContractModal contractCode={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
      {signing && (
        <SignatureModal contractCode={signing} who="agent" onClose={() => setSigning(null)} onSigned={load} />
      )}
      {icUploading && (
        <ICUploadModal contractCode={icUploading} readOnly onClose={() => setIcUploading(null)} onUploaded={load} />
      )}
      {moveForm && (
        <MoveFormModal
          contractCode={moveForm}
          type="MoveIn"
          onClose={() => setMoveForm(null)}
          onSubmitted={load}
        />
      )}
      {paying && (
        <PaymentModal
          contractCode={paying.contractCode}
          tenantName={paying.tenantName}
          onClose={() => setPaying(null)}
          onChanged={load}
        />
      )}
      {warningFor && (
        <WarningLetterModal
          contractCode={warningFor.contractCode}
          tenantName={warningFor.tenantName}
          onClose={() => setWarningFor(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        danger
        message={`确定删除合同 ${deleting}？房间会放回空房，这个操作不能撤销。`}
        confirmLabel="确定删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={!!terminating}
        danger
        message={`确定终止合同 ${terminating?.contractCode}（${terminating?.tenantName}）？押金会标记没收，房间放回空房，这个操作不能撤销。`}
        confirmLabel="确定终止+没收押金"
        onConfirm={confirmTerminate}
        onCancel={() => setTerminating(null)}
      />
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
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-2.5 py-2.5 ${className}`}>{children}</td>;
}
