"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTRACT_STATUS_LABELS } from "@/lib/config";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import ContractForm from "./ContractForm";
import EditContractModal from "./EditContractModal";
import SignatureModal from "./SignatureModal";
import ICUploadModal from "./ICUploadModal";
import MoveFormModal from "./MoveFormModal";
import PaymentModal from "./PaymentModal";

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
  room?: { roomCode: string };
}

function fmt(v: number) {
  return v || v === 0 ? `RM${Number(v).toLocaleString()}` : "-";
}

export default function ContractsClient({ role }: { role: string }) {
  const toast = useToast();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [vacant, setVacant] = useState<{ roomCode: string; propertyName: string }[]>([]);
  const [agents, setAgents] = useState<{ userCode: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const [icUploading, setIcUploading] = useState<string | null>(null);
  const [moveForm, setMoveForm] = useState<string | null>(null);
  const [paying, setPaying] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      setVacant(data.vacant);
      setAgents(data.agents);
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

  const canCreate = role === "AGENT" || role === "ADMIN";

  return (
    <div className="space-y-4">
      {canCreate && <ContractForm role={role} vacantRooms={vacant} agents={agents} onCreated={load} />}

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3.5 text-base font-semibold text-brand">合同清单</h3>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!contracts && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {contracts && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th>合同号</Th>
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
                    <Td>
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
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/agreement/${c.contractCode}`}
                          className="rounded-md bg-gray-500 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          📄
                        </Link>
                        {role === "ADMIN" && (
                          <ActionBtn color="bg-purple-600" onClick={() => setIcUploading(c.contractCode)}>
                            🪪IC
                          </ActionBtn>
                        )}
                        {role === "AGENT" && !c.agentSignature && (c.status === "PENDING_SIGN" || c.status === "ACTIVE") && (
                          <ActionBtn color="bg-pink-600" onClick={() => setSigning(c.contractCode)}>
                            ✍️签名
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && c.status === "ACTIVE" && (
                          <ActionBtn color="bg-cyan-600" onClick={() => setMoveForm(c.contractCode)}>
                            📋Move-in
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && (
                          <ActionBtn color="bg-yellow-600" onClick={() => setPaying(c)}>
                            💰
                          </ActionBtn>
                        )}
                        {(role === "AGENT" || role === "ADMIN") && c.status === "DRAFT" && (
                          <ActionBtn color="bg-brand" onClick={() => doAction("submit", c.contractCode)}>
                            提交
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && c.status === "PENDING_APPROVE" && (
                          <ActionBtn color="bg-green-700" onClick={() => doAction("approve", c.contractCode)}>
                            批
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && (c.status === "DRAFT" || c.status === "PENDING_APPROVE") && (
                          <ActionBtn color="bg-brand" onClick={() => setEditing(c.contractCode)}>
                            ✏️
                          </ActionBtn>
                        )}
                        {role === "ADMIN" && (
                          <ActionBtn color="bg-red-600" onClick={() => setDeleting(c.contractCode)}>
                            删
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
        <ICUploadModal contractCode={icUploading} onClose={() => setIcUploading(null)} onUploaded={load} />
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
      <ConfirmDialog
        open={!!deleting}
        danger
        message={`确定删除合同 ${deleting}？房间会放回空房，这个操作不能撤销。`}
        confirmLabel="确定删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
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
function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-2.5 py-2 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-2.5 py-2.5">{children}</td>;
}
