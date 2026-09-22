"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useLanguage } from "@/components/LanguageProvider";

/** Manual catch-up for the scheduled monthly-rent cron (20th of each month) — same job, safe
 * to click even if the cron already ran, since it's idempotent per contract+month. For when
 * the automatic run was missed (e.g. a schedule change hadn't deployed yet) or Admin wants
 * this month's bills out right now instead of waiting. */
export default function GenerateMonthlyRentCard() {
  const toast = useToast();
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  async function run() {
    setConfirming(false);
    setRunning(true);
    try {
      const res = await fetch("/api/payments/generate-monthly-rent", { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.danger(data.message);
    } catch {
      toast.danger(t("系统出错，请稍后再试", "System error — please try again later"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-brand">
        {t("🗓️ 立即生成本月房租账单", "🗓️ Generate This Month's Rent Bills Now")}
      </h3>
      <p className="mb-3.5 text-xs text-gray-400">
        {t(
          "跟每月20号自动排程用的是同一个逻辑：帮所有生效中的合同开下个月的房租 (+ 车位，如果有) 账单，到期日订在下个月5号，并发邮件通知租客。已经开过的合同不会重复开，可以放心点。",
          "Uses the same logic as the automatic run on the 20th of each month: issues next month's rent (+ carpark, if any) bills for every active contract, with the due date set to the 5th of next month, and emails tenants to notify them. Contracts already billed won't be billed again, so it's safe to click."
        )}
      </p>
      <button onClick={() => setConfirming(true)} disabled={running} className="btn-primary">
        {running ? t("生成中...", "Generating...") : t("立即生成", "Generate Now")}
      </button>

      <ConfirmDialog
        open={confirming}
        message={t(
          "确定现在生成下个月的房租账单？会给所有已验证的租客发邮件通知。",
          "Generate next month's rent bills now? This will email all verified tenants."
        )}
        confirmLabel={t("确定生成", "Confirm Generate")}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
