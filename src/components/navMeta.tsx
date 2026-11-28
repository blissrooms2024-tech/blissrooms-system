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
  IconBook,
  IconSnow,
  IconBox,
  IconDoorIn,
  IconHeadset,
} from "./icons";

export type NavIcon = ComponentType<{ size?: number; className?: string }>;
export type Tone = "violet" | "teal" | "amber" | "rose" | "slate";
export type NavGroup = "tenancy" | "money" | "team" | "lease" | "pay" | "living";

export const TONE_CLASS: Record<Tone, string> = {
  violet: "bg-brand-light text-brand",
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

const GROUP_TONE: Record<NavGroup, Tone> = {
  tenancy: "violet",
  money: "teal",
  team: "slate",
  // Tenant groups (租约 / 付款 / 居住服务) — same colour logic: paperwork violet, money teal.
  lease: "violet",
  pay: "teal",
  living: "amber",
};

export const NAV_GROUPS: { key: NavGroup; zh: string; en: string }[] = [
  { key: "tenancy", zh: "租务", en: "Tenancy" },
  { key: "money", zh: "财务", en: "Money" },
  { key: "team", zh: "团队与系统", en: "Team & system" },
  { key: "lease", zh: "租约", en: "My tenancy" },
  { key: "pay", zh: "付款", en: "Payments" },
  { key: "living", zh: "居住服务", en: "Living here" },
];

const meta = (icon: NavIcon, group: NavGroup) => ({ icon, group, tone: GROUP_TONE[group] });

export const NAV_META: Record<string, { icon: NavIcon; group: NavGroup; tone: Tone }> = {
  "/dashboard": meta(IconHome, "tenancy"),
  "/units": meta(IconBuilding, "tenancy"),
  "/rooms": meta(IconBed, "tenancy"),
  "/contracts": meta(IconContract, "tenancy"),
  "/contracts/new": meta(IconSignature, "tenancy"),
  "/contracts/renewal": meta(IconRefresh, "tenancy"),
  "/maintenance": meta(IconWrench, "tenancy"),
  "/warning-letters": meta(IconAlert, "tenancy"),
  "/vouchers": meta(IconTicket, "tenancy"),
  "/finance": meta(IconPie, "money"),
  "/pnl": meta(IconTrend, "money"),
  "/payments/review": meta(IconWallet, "money"),
  "/payments/outstanding": meta(IconReceipt, "money"),
  "/payments/bulk": meta(IconMegaphone, "money"),
  "/payments/utility-report": meta(IconChart, "money"),
  "/utilities": meta(IconBolt, "money"),
  "/agent-commissions": meta(IconCash, "money"),
  "/claims": meta(IconReceiptCheck, "money"),
  "/quote": meta(IconCalculator, "money"),
  "/activity": meta(IconClock, "team"),
  "/todos": meta(IconListCheck, "team"),
  "/meetings": meta(IconNotes, "team"),
  "/users": meta(IconUsers, "team"),
  "/profile": meta(IconUser, "team"),
  // Tenant pages
  "/my-home": meta(IconHome, "lease"),
  "/my-tenancy": meta(IconContract, "lease"),
  "/my-movein": meta(IconDoorIn, "lease"),
  "/my-moveout": meta(IconBox, "lease"),
  "/my-warnings": meta(IconAlert, "lease"),
  "/my-bills": meta(IconWallet, "pay"),
  "/my-aircon": meta(IconSnow, "pay"),
  "/my-vouchers": meta(IconTicket, "pay"),
  "/my-maintenance": meta(IconWrench, "living"),
  "/my-guide": meta(IconBook, "living"),
  "/support": meta(IconHeadset, "living"),
};

export const navMeta = (href: string) => NAV_META[href] ?? meta(IconChart, "team");

/** Menu labels start with an emoji ("📈 损益表 P&L"); the icon replaces it in the new layouts. */
export const plainLabel = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
