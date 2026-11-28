"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import Sheet from "@/components/Sheet";
import { useT } from "@/components/LanguageProvider";
import { IconBuilding, IconChart, IconChevronRight, IconDots, IconPen, IconPlus, IconSliders, IconTrash } from "@/components/icons";
import { EMPTY_PICK, invalidateUnitTree, useUnitTree, type UnitRoomValue } from "@/components/UnitRoomSelect";
import { groupOf } from "@/lib/receiptMatch";
import PropertyEditModal from "./PropertyEditModal";
import UnitQuickFind from "./UnitQuickFind";
import PlacementSheet from "./PlacementSheet";

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
  occupiedCount: number;
  vacantCount: number;
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
  /** The unit whose ⋯ sheet is open (Admin: open, report, edit, delete). */
  const [menuFor, setMenuFor] = useState<PropertyRow | null>(null);
  // 楼盘 → 单位号码 → 房间 at the top; a 楼盘 picked there narrows the list.
  const tree = useUnitTree();
  const [pick, setPick] = useState<UnitRoomValue>(EMPTY_PICK);
  // 设定楼盘 / 单位号码 for every unit at once (Boss / Admin).
  const canPlace = role === "ADMIN" || role === "BOSS";
  const [placing, setPlacing] = useState(false);
  const unplaced = (tree ?? []).filter((u) => !u.unitNo || !u.building || u.building === u.name).length;
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

  const filteredProperties = properties?.filter((p) => !pick.group || groupOf(p) === pick.group) ?? [];
  const unitNoOf = new Map((tree ?? []).map((u) => [u.propertyCode, u.unitNo]));
  // The list goes 楼盘 by 楼盘, like the dropdowns.
  const grouped = [...new Set(filteredProperties.map(groupOf))]
    .sort((a, b) => a.localeCompare(b))
    .map((g) => [g, filteredProperties.filter((p) => groupOf(p) === g)] as const);

  const total = (properties ?? []).reduce((n, p) => n + p.roomCount, 0);
  const let_ = (properties ?? []).reduce((n, p) => n + p.occupiedCount, 0);

  return (
    <div className="app-type mx-auto max-w-6xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">
            {t("楼盘", "Properties")}
            {properties && <span className="ml-1.5 text-sm font-normal text-gray-400">{properties.length}</span>}
          </h1>
          {properties && total > 0 && (
            <p className="text-xs text-gray-500">{t(`${let_} / ${total} 间已出租 · 点楼盘看房间、合同、账单、资料`, `${let_} of ${total} rooms let · open a unit for its rooms, contracts, bills, info`)}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={loadDepositCandidates}
              aria-label={t("从备注自动算押金", "Fill deposit from notes")}
              title={t(
                "找出有备注但还没填 Owner 押金的楼盘，从备注里的金额自动填",
                "Find properties with notes but no Owner Deposit on file yet, and fill it from the amount in the notes"
              )}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <IconSliders size={17} />
            </button>
            <Link href="/units/new" className="flex h-9 items-center gap-1 rounded-xl bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-dark">
              <IconPlus size={16} />
              {t("新楼盘", "New")}
            </Link>
          </div>
        )}
      </div>

      {tree && tree.length > 0 && <UnitQuickFind units={tree} value={pick} onChange={setPick} />}
      {canPlace && tree && tree.length > 0 && (
        <button
          type="button"
          onClick={() => setPlacing(true)}
          className={`block w-full rounded-xl px-3 py-2 text-left text-[13px] md:max-w-2xl ${
            unplaced ? "bg-amber-50 text-amber-900 hover:bg-amber-100" : "text-brand hover:bg-brand-light/50"
          }`}
        >
          {unplaced
            ? t(
                `${unplaced} 个单位还没填楼盘或单位号码，下拉选单会先显示单位名字。点这里一次填好 →`,
                `${unplaced} unit(s) still need a building or unit number; the dropdowns show their names for now. Fill them all in here →`
              )
            : t("改楼盘 / 单位号码", "Edit buildings & unit numbers")}
        </button>
      )}
      {placing && tree && (
        <PlacementSheet
          units={tree}
          onClose={() => setPlacing(false)}
          onSaved={() => {
            setPlacing(false);
            invalidateUnitTree();
            load();
          }}
        />
      )}

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!properties && !error && (
        <ul className="space-y-2" aria-label={t("载入中", "Loading")}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none" />
          ))}
        </ul>
      )}
      {properties && filteredProperties.length === 0 && (
        <p className="rounded-[20px] bg-white px-4 py-8 text-center text-sm text-gray-400">{t("还没有楼盘", "No properties yet")}</p>
      )}

      {/* 楼盘 by 楼盘: one short card per unit; the whole card opens its page. */}
      {grouped.map(([g, rows]) => (
      <section key={g} aria-label={g} className="space-y-1.5">
      <h2 className="flex items-baseline gap-1.5 px-1 pt-1 text-[13px] font-semibold text-gray-700">
        {g}
        <span className="text-[11.5px] font-normal text-gray-400">{t(`${rows.length} 个单位`, `${rows.length} unit${rows.length === 1 ? "" : "s"}`)}</span>
      </h2>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <li key={p.propertyCode} className="flex min-w-0 items-center gap-1 rounded-2xl bg-white py-2 pl-3 pr-1.5 shadow-[0_1px_2px_rgba(30,27,46,0.05)]">
            <Link href={`/units/${p.propertyCode}`} className="min-w-0 flex-1 py-0.5">
              <p className="flex min-w-0 items-baseline gap-1.5">
                <b className="shrink-0 text-[15px] font-semibold text-gray-900">{unitNoOf.get(p.propertyCode) ?? p.name}</b>
                <span className="truncate text-[12px] text-gray-400">
                  {unitNoOf.get(p.propertyCode) ? `${p.name} · ${p.propertyCode}` : p.propertyCode}
                </span>
              </p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-gray-400">
                <span className="shrink-0 tabular-nums text-gray-600">{t(`${p.occupiedCount}/${p.roomCount} 已出租`, `${p.occupiedCount}/${p.roomCount} let`)}</span>
                {p.vacantCount > 0 && <span className="shrink-0 font-medium text-amber-700">{t(`${p.vacantCount} 空`, `${p.vacantCount} vacant`)}</span>}
                {p.noteCount > 0 && <span className="shrink-0 font-medium text-amber-700">⚠ {p.noteCount}</span>}
              </p>
            </Link>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setMenuFor(p)}
                aria-label={t(`${p.propertyCode} 更多操作`, `More for ${p.propertyCode}`)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <IconDots size={18} />
              </button>
            ) : (
              <IconChevronRight size={16} className="mr-1.5 shrink-0 text-gray-300" />
            )}
          </li>
        ))}
      </ul>
      </section>
      ))}

      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor ? `${menuFor.name} · ${menuFor.propertyCode}` : ""}>
        {menuFor && (
          <ul className="-mx-2">
            {[
              { key: "open", icon: IconBuilding, l: t("打开楼盘", "Open"), href: `/units/${menuFor.propertyCode}` },
              { key: "report", icon: IconChart, l: t("月报", "Monthly report"), href: `/units/${menuFor.propertyCode}?tab=report` },
              { key: "edit", icon: IconPen, l: t("编辑基本资料", "Edit basics"), run: () => setEditingProperty(menuFor) },
              { key: "delete", icon: IconTrash, l: t("删除楼盘", "Delete property"), run: () => setDeletingProperty(menuFor), danger: true },
            ].map((i) => {
              const body = (
                <>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i.danger ? "bg-rose-50 text-rose-600" : "bg-gray-100 text-gray-600"}`}>
                    <i.icon size={18} />
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${i.danger ? "text-rose-600" : "text-gray-800"}`}>{i.l}</span>
                  <IconChevronRight size={16} className="shrink-0 text-gray-300" />
                </>
              );
              const cls = "flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-gray-50";
              return (
                <li key={i.key}>
                  {i.href ? (
                    <Link href={i.href} onClick={() => setMenuFor(null)} className={cls}>
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuFor(null);
                        i.run?.();
                      }}
                      className={cls}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

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
