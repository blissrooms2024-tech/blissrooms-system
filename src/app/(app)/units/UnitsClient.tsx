"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useT } from "@/components/LanguageProvider";
import { fmtMoney } from "@/lib/format";
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
  /** The condo / apartment it's in, and how many 注意事项 it shows (its own + the building's). */
  building: string | null;
  noteCount: number;
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
  const [depositCandidates, setDepositCandidates] = useState<
    { propertyCode: string; name: string; notes: string | null; parsedAmount: number }[] | null
  >(null);
  const [applyingDeposit, setApplyingDeposit] = useState(false);

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

  async function loadDepositCandidates() {
    try {
      const res = await fetch("/api/properties/deposit-from-notes");
      const data = await res.json();
      if (!data.success) {
        toast.danger(data.message);
        return;
      }
      if (data.candidates.length === 0) {
        toast.success(t("检查完了，没有需要填的押金", "Checked — nothing needs filling in"));
        return;
      }
      setDepositCandidates(data.candidates);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    }
  }

  async function applyDepositCandidates() {
    setApplyingDeposit(true);
    try {
      const res = await fetch("/api/properties/deposit-from-notes", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setDepositCandidates(null);
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setApplyingDeposit(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredProperties =
    properties?.filter((p) => {
      if (!q) return true;
      return (
        p.propertyCode.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.building ?? "").toLowerCase().includes(q) ||
        (p.landlord ?? "").toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-brand">{t("🏢 楼盘清单", "🏢 Property List")}</h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={loadDepositCandidates}
                className="btn-soft text-sm"
                title={t(
                  "找出有备注但还没填 Owner 押金的楼盘，从备注里的金额自动填",
                  "Find properties with notes but no Owner Deposit on file yet, and fill it from the amount in the notes"
                )}
              >
                📋 {t("从备注自动算押金", "Fill Deposit from Notes")}
              </button>
              <Link href="/units/new" className="btn-primary text-sm">
                {t("➕ 加新楼盘", "➕ Add Property")}
              </Link>
            </div>
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
          <div className="mb-2 text-xs text-gray-500">
            {filteredProperties.length === properties.length
              ? t(`共 ${properties.length} 个楼盘`, `${properties.length} properties total`)
              : t(
                  `共 ${filteredProperties.length} 个楼盘 (全部 ${properties.length} 个中)`,
                  `${filteredProperties.length} shown (of ${properties.length} total)`
                )}
          </div>
        )}
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
                    {p.building && p.building !== p.name && <div className="text-xs text-gray-400">{p.building}</div>}
                    {p.noteCount > 0 && (
                      <Link href={`/units/${p.propertyCode}`} className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        ⚠ {t(`${p.noteCount} 条注意事项`, `${p.noteCount} to keep in mind`)}
                      </Link>
                    )}
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
                      {fmtMoney(p.ownerRentalAmount)} {t("租金(付Owner)", "Rent (to Owner)")}
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
          <div className="hidden max-h-[65vh] overflow-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                {/* sticky top-0 keeps the header (and the horizontal scrollbar, which sits right
                    under this bounded box instead of under however many rows there are) always
                    reachable without scrolling the whole page down first. */}
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="sticky left-0 top-0 z-20 bg-gray-50 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.15)]">
                    {t("楼盘号", "Property Code")}
                  </Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("名字", "Name")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("房间数", "Rooms")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("车位数", "Parking")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">Landlord / Owner</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("费用", "Fee")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("操作", "Actions")}</Th>
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
                    <Td>
                      {p.name}
                      {p.building && p.building !== p.name && <div className="text-xs text-gray-400">{p.building}</div>}
                      {p.noteCount > 0 && <div className="text-[11px] font-medium text-amber-700">⚠ {t(`${p.noteCount} 条注意事项`, `${p.noteCount} to keep in mind`)}</div>}
                    </Td>
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
                          ? `${fmtMoney(p.ownerRentalAmount)} ${t("租金(付Owner)", "Rent (to Owner)")}`
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

      <ConfirmDialog
        open={!!depositCandidates}
        message={
          <div className="space-y-2">
            <p>
              {t(
                `以下 ${depositCandidates?.length ?? 0} 个楼盘会填入这些押金金额 (从备注自动算出):`,
                `These ${depositCandidates?.length ?? 0} properties will have this Owner Deposit filled in (parsed from their notes):`
              )}
            </p>
            <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-lg bg-gray-50 p-2 text-xs">
              {depositCandidates?.map((c) => (
                <div key={c.propertyCode} className="flex items-center justify-between gap-2 border-b border-gray-200 py-1 last:border-0">
                  <span className="truncate">
                    {c.propertyCode} · {c.name}
                  </span>
                  <span className="shrink-0 font-semibold text-brand">RM{c.parsedAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        }
        confirmLabel={applyingDeposit ? t("处理中...", "Processing...") : t("确定套用", "Confirm Apply")}
        onConfirm={applyDepositCandidates}
        onCancel={() => setDepositCandidates(null)}
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
