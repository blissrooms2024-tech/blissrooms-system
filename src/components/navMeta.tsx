/**
 * Icon, colour and group for each management page, shared by the phone tab bar, the 更多 page
 * and the home quick actions so the same page always looks the same wherever it appears.
 * Colour follows the group (daily work = violet, records = amber, reports = teal).
 */
import type { ComponentType } from "react";
import {
  IconAlert,
  IconBed,
  IconBolt,
  IconBuilding,
  IconCalculator,
  IconCash,
  IconChart,
  IconClock,
  IconContract,
  IconHome,
  IconListCheck,
  IconMegaphone,
  IconNotes,
  IconPie,
  IconReceipt,
  IconReceiptCheck,
  IconRefresh,
  IconSignature,
  IconTicket,
  IconTrend,
  IconUser,
  IconUsers,
  IconWallet,
  IconWrench,
} from "./icons";

export type NavIcon = ComponentType<{ size?: number; className?: string }>;
export type Tone = "violet" | "teal" | "amber" | "rose" | "slate";
export type NavGroup = "daily" | "records" | "reports";

export const TONE_CLASS: Record<Tone, string> = {
  violet: "bg-brand-light text-brand",
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

const GROUP_TONE: Record<NavGroup, Tone> = { daily: "violet", records: "amber", reports: "teal" };

/** How 更多 (and the menus) are grouped: by the kind of work — what to clear every day, the
 * records themselves, and the reports. */
export const NAV_GROUPS: { key: NavGroup; zh: string; en: string }[] = [
  { key: "daily", zh: "每日处理", en: "Daily work" },
  { key: "records", zh: "资料", en: "Records" },
  { key: "reports", zh: "报表", en: "Reports" },
];

const meta = (icon: NavIcon, group: NavGroup) => ({ icon, group, tone: GROUP_TONE[group] });

export const NAV_META: Record<string, { icon: NavIcon; group: NavGroup; tone: Tone }> = {
  "/dashboard": meta(IconHome, "daily"),
  "/payments/review": meta(IconWallet, "daily"),
  "/payments/outstanding": meta(IconReceipt, "daily"),
  "/maintenance": meta(IconWrench, "daily"),
  "/payments/bulk": meta(IconMegaphone, "daily"),
  "/utilities": meta(IconBolt, "daily"),
  "/claims": meta(IconReceiptCheck, "daily"),
  "/todos": meta(IconListCheck, "daily"),
  "/quote": meta(IconCalculator, "daily"),
  "/units": meta(IconBuilding, "records"),
  "/rooms": meta(IconBed, "records"),
  "/contracts": meta(IconContract, "records"),
  "/contracts/new": meta(IconSignature, "records"),
  "/contracts/renewal": meta(IconRefresh, "records"),
  "/users": meta(IconUsers, "records"),
  "/vouchers": meta(IconTicket, "records"),
  "/meetings": meta(IconNotes, "records"),
  "/profile": meta(IconUser, "records"),
  "/finance": meta(IconPie, "reports"),
  "/pnl": meta(IconTrend, "reports"),
  "/payments/utility-report": meta(IconChart, "reports"),
  "/agent-commissions": meta(IconCash, "reports"),
  "/warning-letters": meta(IconAlert, "reports"),
  "/activity": meta(IconClock, "reports"),
};

export const navMeta = (href: string) => NAV_META[href] ?? meta(IconChart, "records");

/** Menu labels start with an emoji ("📈 损益表 P&L"); the icon replaces it in the new layouts. */
export const plainLabel = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
