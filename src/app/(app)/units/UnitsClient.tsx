"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import PropertyEditModal from "./PropertyEditModal";

interface PropertyRow {
  propertyCode: string;
  name: string;
  address: string | null;
  region: string | null;
  landlord: string | null;
  managementFeeRate: number | null;
  status: string | null;
  notes: string | null;
  roomCount: number;
}

export default function UnitsClient({ role }: { role: string }) {
  const toast = useToast();
  const [properties, setProperties] = useState<PropertyRow[] | null>(null);
  const [error, setError] = useState("");
  const [editingProperty, setEditingProperty] = useState<PropertyRow | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<PropertyRow | null>(null);
  const [search, setSearch] = useState("");
  const canEdit = role === "ADMIN";

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/properties");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setProperties(data.properties);
    } catch {
      setError("出错，请稍后再试");
    }
  }

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function confirmDeleteProperty() {
    if (!deletingProperty) return;
    const res = await fetch(`/api/properties/${deletingProperty.propertyCode}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
      load();
    } else {
      toast.danger(data.message);
    }
    setDeletingProperty(null);
  }

  const q = search.trim().toLowerCase();
  const filteredProperties =
    properties?.filter((p) => {
      if (!q) return true;
      return (
        p.propertyCode.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.landlord ?? "").toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">🏢 楼盘清单</h3>
          {canEdit && (
            <Link href="/units/new" className="btn-primary text-sm">
              ➕ 加新楼盘
            </Link>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 搜楼盘号 / 名字 / Landlord..."
          className="input mb-3.5 max-w-xs"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!properties && !error && <div className="text-sm text-gray-500">载入中...</div>}
        {properties && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th>楼盘号</Th>
                  <Th>名字</Th>
                  <Th>房间数</Th>
                  <Th>Landlord</Th>
                  <Th>管理费</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      {q ? "没有符合条件的楼盘" : "还没有楼盘"}
                    </td>
                  </tr>
                )}
                {filteredProperties.map((p) => (
                  <tr key={p.propertyCode} className="border-b border-gray-100">
                    <Td>
                      <Link href={`/units/${p.propertyCode}`} className="font-semibold text-brand hover:underline">
                        {p.propertyCode}
                      </Link>
                    </Td>
                    <Td>{p.name}</Td>
                    <Td>{p.roomCount}</Td>
                    <Td>
                      {p.landlord ? (
                        <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
                          {p.landlord}
                        </span>
                      ) : (
                        <span className="text-gray-400">自己名下</span>
                      )}
                    </Td>
                    <Td>{p.landlord && p.managementFeeRate ? `${(p.managementFeeRate * 100).toFixed(1)}%` : "-"}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/units/${p.propertyCode}`} className="btn-soft px-2.5 py-1 text-xs">
                          📊 月报
                        </Link>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingProperty(p)}
                              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                            >
                              ✏️ 编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProperty(p)}
                              className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              🗑️ 删除
                            </button>
                          </>
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

      {editingProperty && (
        <PropertyEditModal property={editingProperty} onClose={() => setEditingProperty(null)} onSaved={load} />
      )}

      <ConfirmDialog
        open={!!deletingProperty}
        danger
        title="⚠️ 删除楼盘"
        message={`确定要删除楼盘 ${deletingProperty?.name} 吗？此操作不能撤销。`}
        confirmLabel="确定删除"
        onConfirm={confirmDeleteProperty}
        onCancel={() => setDeletingProperty(null)}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-2.5 py-2 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-2.5 py-2.5">{children}</td>;
}
