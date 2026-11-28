"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sheet from "./Sheet";
import Pill from "./Pill";
import { useLanguage } from "./LanguageProvider";
import { IconBed, IconBuilding, IconChevronRight, IconContract, IconSearch, IconX } from "./icons";
import { contractStatusLabel, contractStatusTone, roomStatusLabel } from "@/lib/config";

type Results = {
  q: string;
  units: { code: string; name: string; building: string | null; unitNo: string | null }[];
  rooms: { code: string; unitName: string; type: string | null; isCarpark: boolean; status: string }[];
  contracts: { code: string; tenantName: string; roomCode: string; status: string; phone: string | null }[];
};

const ROOM_TONE: Record<string, "rose" | "teal" | "amber" | "gray" | "violet"> = { VACANT: "rose", OCCUPIED: "teal", RESERVED: "amber", MAINTENANCE: "gray", STORE: "violet" };

/** The home page's search: one box for a room number, a tenant's name, a phone number or a
 * contract number, straight to the page. Opens as a sheet so results have the whole screen. */
export default function GlobalSearch() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-md items-center gap-2 rounded-xl bg-white/15 px-3.5 text-left text-[14px] text-white/85 ring-1 ring-white/25 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
      >
        <IconSearch size={18} className="shrink-0" />
        <span className="truncate">{t("搜房号、租客、电话、合同号", "Room, tenant, phone, contract #")}</span>
      </button>
      {open && <SearchSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        const d = await r.json();
        if (d.success) setRes(d);
      } catch {
        /* typing on: a newer search replaces this one */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [term]);

  // Only show results for what's in the box now.
  const shown = term.length >= 2 && res && res.q === term ? res : null;
  const rows = shown
    ? [
        ...shown.units.map((u) => ({
          key: `u-${u.code}`,
          href: `/units/${u.code}`,
          icon: IconBuilding,
          tile: "bg-amber-50 text-amber-700",
          title: u.name,
          sub: [u.code, u.building, u.unitNo].filter(Boolean).join(" · "),
          pill: null as null | { tone: "rose" | "teal" | "amber" | "gray" | "violet"; l: string },
          group: t("楼盘", "Properties"),
        })),
        ...shown.rooms.map((r) => ({
          key: `r-${r.code}`,
          href: `/rooms/${r.code}`,
          icon: IconBed,
          tile: "bg-brand-light text-brand",
          title: r.code,
          sub: [r.unitName, r.isCarpark ? t("车位", "Carpark") : r.type].filter(Boolean).join(" · "),
          pill: { tone: ROOM_TONE[r.status] ?? "gray", l: roomStatusLabel(r.status, locale) },
          group: t("房间", "Rooms"),
        })),
        ...shown.contracts.map((c) => ({
          key: `c-${c.code}`,
          href: `/contracts/${c.code}`,
          icon: IconContract,
          tile: "bg-teal-50 text-teal-700",
          title: c.tenantName,
          sub: [c.roomCode, c.code, c.phone].filter(Boolean).join(" · "),
          pill: { tone: contractStatusTone(c.status), l: contractStatusLabel(c.status, locale) },
          group: t("合同 / 租客", "Contracts / tenants"),
        })),
      ]
    : [];

  return (
    <Sheet open onClose={onClose} title={t("搜索", "Search")} tall>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (rows[0]) {
            onClose();
            router.push(rows[0].href);
          }
        }}
        className="relative"
      >
        <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
          placeholder={t("例如 PXC-01、Siti、6789、CT-U2", "e.g. PXC-01, Siti, 6789, CT-U2")}
          className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={t("清除", "Clear")}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <IconX size={16} />
          </button>
        )}
      </form>

      <div className="mt-3 min-h-[40vh]" aria-live="polite">
        {term.length < 2 && (
          <p className="px-1 text-sm text-gray-500">
            {t("打房号、租客名字、电话最后几个号码，或者合同号。", "Type a room number, a tenant's name, the last digits of a phone number, or a contract number.")}
          </p>
        )}
        {term.length >= 2 && !shown && loading && <p className="px-1 text-sm text-gray-400">{t("搜索中…", "Searching…")}</p>}
        {shown && rows.length === 0 && (
          <p className="px-1 text-sm text-gray-500">
            {t(`找不到「${term}」。房号可以只打一部分（PXC-0），电话打最后 4 个号码就好。`, `Nothing for “${term}”. Try part of a room number (PXC-0) or the last 4 digits of a phone.`)}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="-mx-2">
            {rows.map((r, i) => (
              <li key={r.key}>
                {(i === 0 || rows[i - 1].group !== r.group) && <p className="px-2 pb-1 pt-2 text-[12px] font-semibold text-gray-500">{r.group}</p>}
                <Link href={r.href} onClick={onClose} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-gray-50">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${r.tile}`}>
                    <r.icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-gray-900">{r.title}</span>
                    <span className="block truncate text-[12px] text-gray-500">{r.sub}</span>
                  </span>
                  {r.pill && <Pill tone={r.pill.tone}>{r.pill.l}</Pill>}
                  <IconChevronRight size={16} className="shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
