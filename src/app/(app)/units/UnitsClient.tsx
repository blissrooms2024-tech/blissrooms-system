"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useT } from "@/components/LanguageProvider";
import PropertyEditModal from "./PropertyEditModal";

interface PropertyRow {
  propertyCode: string;
  name: string;
  address: string | null;
  region: string | null;
  landlord: string | null;
  managementFeeRate: number | null;
  ownerRentalAmount: number | null;
  ownerDeposit: number | null;
  status: string | null;
  notes: string | null;
  roomCount: number;
  carparkCount: number;
}

export default function UnitsClient({ role }: { role: string }) {
  const toast = useToast();
  const t = useT();
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
      setError(t("出错，请稍后再试", "Something went wrong — please try again later"));
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
          <h3 className="text-base font-semibold text-brand">{t("🏢 楼盘清单", "🏢 Property List")}</h3>
          {canEdit && (
            <Link href="/units/new" className="btn-primary text-sm">
              {t("➕ 加新楼盘", "➕ Add Property")}
            </Link>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("🔍 搜楼盘号 / 名字 / Landlord...", "🔍 Search property code / name / Landlord...")}
          className="input mb-3.5 max-w-xs"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!properties && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {properties && (
          <div className="space-y-2.5 sm:hidden">
            {filteredProperties.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">
                {q ? t("没有符合条件的楼盘", "No matching properties") : t("还没有楼盘", "No properties yet")}
              </div>
            )}
            {filteredProperties.map((p) => (
              <div key={p.propertyCode} className="rounded-lg border border-gray-100 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/units/${p.propertyCode}`} className="font-semibold text-brand hover:underline">
                      {p.propertyCode}
                    </Link>
                    <div className="text-sm text-gray-700">{p.name}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-gray-500">
                    <div>
                      {p.roomCount} {t("房", "Room(s)")}
                    </div>
                    <div>
                      {p.carparkCount} {t("车位", "Parking")}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  {p.landlord ? (
                    <span className="rounded-full bg-brand-light px-2.5 py-0.5 font-semibold text-brand">
                      {p.landlord}
                    </span>
                  ) : (
                    <span className="text-gray-400">{t("自己名下", "Self-owned")}</span>
                  )}
                  {p.managementFeeRate && (
                    <span className="text-gray-500">
                      {(p.managementFeeRate * 100).toFixed(1)}% {t("管理费", "Management Fee")}
                    </span>
                  )}
                  {p.ownerRentalAmount !== null && (
                    <span className="text-gray-500">
                      RM{p.ownerRentalAmount} {t("租金(付Owner)", "Rent (to Owner)")}
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <Link href={`/units/${p.propertyCode}`} className="btn-soft flex-1 py-1.5 text-center text-xs">
                    {t("📊 月报", "📊 Monthly Report")}
                  </Link>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingProperty(p)}
                        className="flex-1 rounded-md bg-gray-100 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                      >
                        {t("✏️ 编辑", "✏️ Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingProperty(p)}
                        className="flex-1 rounded-md bg-red-50 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        {t("🗑️ 删除", "🗑️ Delete")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {properties && (
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="sticky left-0 bg-gray-50 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.15)]">
                    {t("楼盘号", "Property Code")}
                  </Th>
                  <Th>{t("名字", "Name")}</Th>
                  <Th>{t("房间数", "Rooms")}</Th>
                  <Th>{t("车位数", "Parking")}</Th>
                  <Th>Landlord / Owner</Th>
                  <Th>{t("费用", "Fee")}</Th>
                  <Th>{t("操作", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      {q ? t("没有符合条件的楼盘", "No matching properties") : t("还没有楼盘", "No properties yet")}
                    </td>
                  </tr>
                )}
                {filteredProperties.map((p) => (
                  <tr key={p.propertyCode} className="border-b border-gray-100">
                    <Td className="sticky left-0 bg-white shadow-[4px_0_4px_-4px_rgba(0,0,0,0.15)]">
                      <Link href={`/units/${p.propertyCode}`} className="font-semibold text-brand hover:underline">
                        {p.propertyCode}
                      </Link>
                    </Td>
                    <Td>{p.name}</Td>
                    <Td>{p.roomCount}</Td>
                    <Td>{p.carparkCount}</Td>
                    <Td>
                      {p.landlord ? (
                        <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
                          {p.landlord}
                        </span>
                      ) : (
                        <span className="text-gray-400">{t("自己名下", "Self-owned")}</span>
                      )}
                    </Td>
                    <Td>
                      {p.managementFeeRate
                        ? `${(p.managementFeeRate * 100).toFixed(1)}% ${t("管理费", "Management Fee")}`
                        : p.ownerRentalAmount !== null
                          ? `RM${p.ownerRentalAmount} ${t("租金(付Owner)", "Rent (to Owner)")}`
                          : "-"}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/units/${p.propertyCode}`} className="btn-soft px-2.5 py-1 text-xs">
                          {t("📊 月报", "📊 Monthly Report")}
                        </Link>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingProperty(p)}
                              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                            >
                              {t("✏️ 编辑", "✏️ Edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProperty(p)}
                              className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              {t("🗑️ 删除", "🗑️ Delete")}
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
        title={t("⚠️ 删除楼盘", "⚠️ Delete Property")}
        message={t(
          `确定要删除楼盘 ${deletingProperty?.name} 吗？此操作不能撤销。`,
          `Are you sure you want to delete property ${deletingProperty?.name}? This action cannot be undone.`
        )}
        confirmLabel={t("确定删除", "Confirm Delete")}
        onConfirm={confirmDeleteProperty}
        onCancel={() => setDeletingProperty(null)}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-2.5 py-2.5 ${className}`}>{children}</td>;
}
