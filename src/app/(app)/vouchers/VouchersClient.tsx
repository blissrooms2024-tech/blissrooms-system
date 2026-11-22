"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useLanguage } from "@/components/LanguageProvider";
import { fmtDate, fmtMoney as fmt } from "@/lib/format";
import { VOUCHER_TEMPLATES, voucherGradient, type VoucherTemplate } from "@/lib/voucherTemplates";

interface Voucher {
  id: string;
  voucherCode: string;
  contractCode: string;
  roomCode: string;
  tenantName: string;
  amount: number;
  reason: string;
  imageUrl: string | null;
  template: string;
  expiryDate: string;
  status: string;
  issuedBy: string;
  issuedAt: string;
  redeemedAt: string | null;
}

interface OccupiedContract {
  contractCode: string;
  roomCode: string;
  tenantName: string;
  isCarpark: boolean;
}

export default function VouchersClient({ role }: { role: string }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [occupied, setOccupied] = useState<OccupiedContract[]>([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amount: "",
    reason: "",
    issuedDate: todayStr(),
    expiryDate: "",
    template: "blue" as VoucherTemplate,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Voucher | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/vouchers");
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setVouchers(data.vouchers);
    } catch {
      setError(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }, [t]);

  useEffect(() => {
    // setState happens after the fetch's await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function statusOf(v: Voucher): { label: string; cls: string } {
    if (v.status === "REDEEMED") return { label: t("已兑换", "Redeemed"), cls: "bg-green-50 text-green-700" };
    if (v.status === "CANCELLED") return { label: t("已取消", "Cancelled"), cls: "bg-gray-100 text-gray-500" };
    if (new Date(v.expiryDate) < new Date()) return { label: t("已过期", "Expired"), cls: "bg-red-50 text-red-700" };
    return { label: t("待兑换", "Unredeemed"), cls: "bg-amber-50 text-amber-700" };
  }

  async function openIssue() {
    setIssuing(true);
    setForm((f) => ({ ...f, issuedDate: todayStr() }));
    try {
      const res = await fetch("/api/contracts/page-data");
      const data = await res.json();
      if (!data.success) {
        toast.danger(data.message);
        return;
      }
      // Only occupied rooms (an ACTIVE contract with a live tenant) — a vacant room has no one
      // to give a voucher to, so it would just be clutter in the picker. This also naturally
      // includes carpark-only contracts (a tenant who rents just a parking bay, no room) since
      // those are ACTIVE contracts too — their "room" is just the carpark itself.
      const list: OccupiedContract[] = data.contracts
        .filter((c: { status: string }) => c.status === "ACTIVE")
        .map((c: { contractCode: string; tenantName: string; room?: { roomCode: string; isCarpark: boolean } }) => ({
          contractCode: c.contractCode,
          roomCode: c.room?.roomCode ?? "",
          tenantName: c.tenantName,
          isCarpark: c.room?.isCarpark ?? false,
        }))
        .sort((a: OccupiedContract, b: OccupiedContract) => a.roomCode.localeCompare(b.roomCode));
      setOccupied(list);
      setRoomSearch("");
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }

  function toggleRoom(contractCode: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contractCode)) next.delete(contractCode);
      else next.add(contractCode);
      return next;
    });
  }

  function toggleAll(visible: OccupiedContract[]) {
    const visibleCodes = visible.map((o) => o.contractCode);
    const allVisibleSelected = visibleCodes.length > 0 && visibleCodes.every((code) => selected.has(code));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const code of visibleCodes) next.delete(code);
      } else {
        for (const code of visibleCodes) next.add(code);
      }
      return next;
    });
  }

  async function submitIssue() {
    if (selected.size === 0) {
      toast.warning(t("请至少选一间房", "Please select at least one room"));
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.warning(t("请填金额", "Please enter an amount"));
      return;
    }
    if (!form.reason.trim()) {
      toast.warning(t("请填发放原因", "Please enter a reason"));
      return;
    }
    if (!form.issuedDate) {
      toast.warning(t("请选发放日期", "Please select an issue date"));
      return;
    }
    if (!form.expiryDate) {
      toast.warning(t("请选截至日期", "Please select an expiry date"));
      return;
    }
    if (form.issuedDate > form.expiryDate) {
      toast.warning(t("发放日期不能晚于截至日期", "Issue date can't be after the expiry date"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractCodes: [...selected],
          amount: Number(form.amount),
          reason: form.reason.trim(),
          issuedDate: form.issuedDate,
          expiryDate: form.expiryDate,
          template: form.template,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIssuing(false);
        setSelected(new Set());
        setForm({ amount: "", reason: "", issuedDate: todayStr(), expiryDate: "", template: "blue" });
        load();
      } else {
        toast.danger(data.message);
      }
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/vouchers/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.danger(data.message);
      setDeleting(null);
      load();
    } catch {
      toast.danger(t("网络连接失败，请检查网络后重试", "Network connection failed — please check your connection and try again"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-base font-semibold text-brand">🎟️ {t("代金券", "Vouchers")}</h3>
          {role === "ADMIN" && (
            <button onClick={openIssue} className="btn-primary text-sm">
              ➕ {t("发放代金券", "Issue Voucher")}
            </button>
          )}
        </div>
        <p className="mb-3.5 text-sm text-gray-500">
          {t(
            "公司给租客的奖励/补偿，有截至日期；租客自己在「我的代金券」兑换，兑换时效果跟现金一样 (自动抵账单)，同时会记一笔支出 (楼盘财务报表看得到)。过期没兑换的不会产生任何支出。",
            "A company reward/compensation for a tenant, with its own expiry date. The tenant redeems it themselves from \"My Vouchers\" — redemption spends exactly like cash (automatically settles bills) and books a matching Expense (visible on that property's finance report). One that expires unredeemed never costs anything."
          )}
        </p>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {!vouchers && !error && <div className="text-sm text-gray-500">{t("载入中...", "Loading...")}</div>}
        {vouchers && vouchers.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">{t("还没有发放过代金券", "No vouchers issued yet")}</div>
        )}
        {vouchers && vouchers.length > 0 && (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <Th className="sticky left-0 top-0 z-20 bg-gray-50">{t("代金券号", "Voucher #")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("房间/合同", "Room/Contract")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("租客", "Tenant")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("金额", "Amount")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("原因", "Reason")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("发放日期", "Issued")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("截至日期", "Expiry")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("状态", "Status")}</Th>
                  <Th className="sticky top-0 z-10 bg-gray-50">{t("发放人", "Issued By")}</Th>
                  {role === "ADMIN" && <Th className="sticky top-0 z-10 bg-gray-50">{t("操作", "Actions")}</Th>}
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => {
                  const badge = statusOf(v);
                  return (
                    <tr key={v.id} className="border-b border-gray-100 align-top">
                      <Td className="sticky left-0 z-[1] bg-white font-semibold">{v.voucherCode}</Td>
                      <Td>
                        <div className="font-semibold">{v.roomCode}</div>
                        <Link href={`/contracts/${v.contractCode}`} className="text-xs text-brand hover:underline">
                          {v.contractCode}
                        </Link>
                      </Td>
                      <Td>{v.tenantName}</Td>
                      <Td className="font-semibold">{fmt(v.amount)}</Td>
                      <Td className="max-w-[160px] whitespace-normal">{v.reason}</Td>
                      <Td>{fmtDate(v.issuedAt)}</Td>
                      <Td>{fmtDate(v.expiryDate)}</Td>
                      <Td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                      </Td>
                      <Td>{v.issuedBy}</Td>
                      {role === "ADMIN" && (
                        <Td>
                          {v.status !== "REDEEMED" && (
                            <button
                              onClick={() => setDeleting(v)}
                              className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                            >
                              🗑️ {t("删除", "Delete")}
                            </button>
                          )}
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {issuing && (
        <Modal onClose={() => setIssuing(false)} wide>
          <h3 className="mb-3.5 text-lg font-bold text-brand">🎟️ {t("发放代金券", "Issue Voucher")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              {(() => {
                const q = roomSearch.trim().toLowerCase();
                const filtered = q
                  ? occupied.filter((o) => o.roomCode.toLowerCase().includes(q) || o.tenantName.toLowerCase().includes(q))
                  : occupied;
                const allVisibleSelected =
                  filtered.length > 0 && filtered.every((o) => selected.has(o.contractCode));
                return (
                  <>
                    <label className="mb-1.5 flex items-center justify-between text-sm text-gray-600">
                      <span>{t("选房间 (可以多选)", "Select Rooms (multiple allowed)")}</span>
                      {filtered.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleAll(filtered)}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          {allVisibleSelected ? t("取消全选", "Deselect All") : t("全选", "Select All")}
                        </button>
                      )}
                    </label>
                    <input
                      className="input mb-1.5"
                      placeholder={t("🔍 搜房间/租客...", "🔍 Search room/tenant...")}
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                    />
                    <div className="max-h-[260px] overflow-auto rounded-lg border border-gray-200">
                      {occupied.length === 0 && (
                        <div className="p-3 text-center text-xs text-gray-400">{t("载入中...", "Loading...")}</div>
                      )}
                      {occupied.length > 0 && filtered.length === 0 && (
                        <div className="p-3 text-center text-xs text-gray-400">{t("没有符合的房间", "No matching rooms")}</div>
                      )}
                      {filtered.map((o) => (
                        <label
                          key={o.contractCode}
                          className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(o.contractCode)}
                            onChange={() => toggleRoom(o.contractCode)}
                          />
                          <span className="font-semibold">
                            {o.isCarpark && "🅿️ "}
                            {o.roomCode}
                          </span>
                          <span className="text-gray-500">— {o.tenantName}</span>
                        </label>
                      ))}
                    </div>
                  </>
                );
              })()}
              <p className="mt-1 text-xs text-gray-400">
                {t(`已选 ${selected.size} 间`, `${selected.size} room(s) selected`)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">{t("金额 RM", "Amount RM")}</label>
                  <input
                    type="number"
                    className="input"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">{t("发放日期", "Issue Date")}</label>
                  <input
                    type="date"
                    className="input"
                    value={form.issuedDate}
                    onChange={(e) => setForm({ ...form, issuedDate: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm text-gray-600">{t("截至日期", "Expiry Date")}</label>
                  <input
                    type="date"
                    className="input"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t("发放原因", "Reason")}</label>
                <input
                  className="input"
                  placeholder={t("例: 推荐新租客奖励 / 维修不便补偿", "e.g. Referral reward / Compensation for inconvenience")}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-600">{t("卡片样式", "Card Design")}</label>
                <div className="flex gap-2.5">
                  {(Object.keys(VOUCHER_TEMPLATES) as VoucherTemplate[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, template: key })}
                      className={`flex h-16 flex-1 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white ${voucherGradient(key)} ${
                        form.template === key ? "ring-4 ring-brand/40" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {form.amount ? fmt(Number(form.amount) || 0) : "RM0.00"}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={submitIssue} disabled={saving} className="btn-primary w-full">
                {saving ? t("处理中...", "Processing...") : t(`确定发放 (${selected.size} 张)`, `Confirm Issue (${selected.size})`)}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        danger
        title={t("删除代金券", "Delete Voucher")}
        message={t(
          `确定要永久删除这张代金券 (${deleting?.voucherCode}, RM${deleting?.amount.toFixed(2)}) 吗？删除后不留记录，租客那边也会完全消失，不能撤销。`,
          `Permanently delete this voucher (${deleting?.voucherCode}, RM${deleting?.amount.toFixed(2)})? It leaves no record — it will disappear from the tenant's side too. This can't be undone.`
        )}
        confirmLabel={t("确定删除", "Confirm Delete")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2.5 py-1.5 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2.5 py-1.5 ${className}`}>{children}</td>;
}
