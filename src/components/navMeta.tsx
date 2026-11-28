/**
 * Icon, colour and group for each management page, shared by the phone tab bar, the 更多 page
 * and the home quick actions so the same page always looks the same wherever it appears.
 * Colour follows the group (tenancy = violet, money = teal, team & system = slate).
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
export type NavGroup = "property" | "tenancy" | "payments" | "money" | "team";

export const TONE_CLASS: Record<Tone, string> = {
  violet: "bg-brand-light text-brand",
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

const GROUP_TONE: Record<NavGroup, Tone> = { property: "amber", tenancy: "violet", payments: "teal", money: "teal", team: "slate" };

/** How 更多 (and the menus) are grouped: the place first, then the work. */
export const NAV_GROUPS: { key: NavGroup; zh: string; en: string }[] = [
  { key: "property", zh: "楼盘", en: "Properties" },
  { key: "tenancy", zh: "租务", en: "Tenancy" },
  { key: "payments", zh: "收款", en: "Payments" },
  { key: "money", zh: "财务", en: "Finance" },
  { key: "team", zh: "团队", en: "Team" },
];

const meta = (icon: NavIcon, group: NavGroup) => ({ icon, group, tone: GROUP_TONE[group] });

export const NAV_META: Record<string, { icon: NavIcon; group: NavGroup; tone: Tone }> = {
  "/dashboard": meta(IconHome, "tenancy"),
  "/units": meta(IconBuilding, "property"),
  "/rooms": meta(IconBed, "property"),
  "/contracts": meta(IconContract, "tenancy"),
  "/contracts/new": meta(IconSignature, "tenancy"),
  "/contracts/renewal": meta(IconRefresh, "tenancy"),
  "/maintenance": meta(IconWrench, "tenancy"),
  "/warning-letters": meta(IconAlert, "tenancy"),
  "/vouchers": meta(IconTicket, "tenancy"),
  "/finance": meta(IconPie, "money"),
  "/pnl": meta(IconTrend, "money"),
  "/payments/review": meta(IconWallet, "payments"),
  "/payments/outstanding": meta(IconReceipt, "payments"),
  "/payments/bulk": meta(IconMegaphone, "payments"),
  "/payments/utility-report": meta(IconChart, "payments"),
  "/utilities": meta(IconBolt, "payments"),
  "/agent-commissions": meta(IconCash, "money"),
  "/claims": meta(IconReceiptCheck, "money"),
  "/quote": meta(IconCalculator, "money"),
  "/activity": meta(IconClock, "team"),
  "/todos": meta(IconListCheck, "team"),
  "/meetings": meta(IconNotes, "team"),
  "/users": meta(IconUsers, "team"),
  "/profile": meta(IconUser, "team"),
};

export const navMeta = (href: string) => NAV_META[href] ?? meta(IconChart, "team");

/** Menu labels start with an emoji ("📈 损益表 P&L"); the icon replaces it in the new layouts. */
export const plainLabel = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
