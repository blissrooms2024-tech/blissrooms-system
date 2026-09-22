"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "./Modal";
import { fmtDate } from "@/lib/format";

const SESSION_KEY = "lease_expiry_reminder_shown";
const REMINDER_DAYS = 60;

interface Card {
  contractCode: string;
  status: string;
  expiredDate: string | null;
  daysToExpiry: number | null;
  moveOutNoticeDate: string | null;
  renewalRequestedAt: string | null;
}

/** Nags a tenant once per browser session (not every page nav, just once after they log in)
 * when any of their contracts is inside the 60-day expiry window and they haven't already
 * told the system what they want (renew or move out) — the contract puts that decision on
 * them, and Admin has no obligation to remind them, so the app does it instead. */
export default function LeaseExpiryReminder() {
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // Fall through — if we can't check, just show it once and not worry about repeats.
    }
    fetch("/api/contracts/my-cards")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        const due = (data.cards as Card[]).find(
          (c) =>
            c.status === "ACTIVE" &&
            c.daysToExpiry !== null &&
            c.daysToExpiry < REMINDER_DAYS &&
            !c.moveOutNoticeDate &&
            !c.renewalRequestedAt
        );
        if (due) {
          setCard(due);
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            // Can't persist the "already shown" flag — worst case it shows again next nav.
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!card) return null;

  const overdue = card.daysToExpiry !== null && card.daysToExpiry < 0;

  return (
    <Modal onClose={() => setCard(null)}>
      <h3 className="mb-2 text-lg font-bold text-brand">⏰ 租约快到期了</h3>
      <p className="text-sm text-gray-600">
        合同 <b>{card.contractCode}</b> 的到期日是 <b>{fmtDate(card.expiredDate)}</b>
        {overdue ? (
          <span className="font-semibold text-red-600">
            {" "}
            (已经过期 {Math.abs(card.daysToExpiry!)} 天)
          </span>
        ) : (
          <span className="font-semibold text-amber-600"> (还剩 {card.daysToExpiry} 天)</span>
        )}
        。要续约还是搬出，请尽快决定，可以在「我的租约」页面申请。
      </p>
      <Link
        href="/my-tenancy"
        onClick={() => setCard(null)}
        className="btn-primary mt-3.5 inline-block text-sm"
      >
        去处理
      </Link>
    </Modal>
  );
}
