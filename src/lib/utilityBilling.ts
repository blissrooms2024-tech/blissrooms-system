import { prisma } from "@/lib/prisma";
import { addMonths } from "@/lib/bills";
import { newId } from "@/lib/id";
import { billNote, whatsappText } from "@/lib/utilityText";
import {
  DEFAULT_RATES,
  KIND_LABELS,
  KIND_PAYMENT_TYPE,
  UTILITY_KINDS,
  finalBills,
  round2,
  splitUsage,
  type Credits,
  type MeterUsage,
  type Overrides,
  type SplitBy,
  type Tenancy,
  type UtilityKind,
} from "@/lib/utilitySplit";

/** Database side of 抄表开单: who lives in a unit in a given month, meters and their last
 * readings, rates, and issuing / undoing a month's bills. The split rules themselves live in
 * utilitySplit.ts. */

export const isKind = (k: unknown): k is UtilityKind => UTILITY_KINDS.includes(k as UtilityKind);
export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function periodBounds(period: string) {
  const start = new Date(`${period}-01T00:00:00.000Z`);
  const next = new Date(`${addMonths(period, 1)}-01T00:00:00.000Z`);
  return { start, last: new Date(next.getTime() - 86_400_000), next };
}

const day = (d: Date | null | undefined) => (d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null);

/** YYYY-MM of a moment, in Malaysia time. */
export const myMonth = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 7);

/** First month a meter is billed. Meters registered before start months existed begin in the
 * month they were registered. */
export const meterStart = (m: { startPeriod: string | null; createdAt: Date }) => m.startPeriod ?? myMonth(m.createdAt);

// ---------------------------------------------------------------------------------- rates
const rateKey = (k: UtilityKind) => `rate.${k}`;

export async function getRates(): Promise<Record<UtilityKind, number>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: UTILITY_KINDS.map(rateKey) } } });
  const out = { ...DEFAULT_RATES };
  for (const r of rows) {
    const k = r.key.slice(5);
    const v = Number(r.value);
    if (isKind(k) && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

export async function setRates(rates: Partial<Record<UtilityKind, number>>, by: string) {
  for (const k of UTILITY_KINDS) {
    const v = rates[k];
    if (v === undefined) continue;
    await prisma.appSetting.upsert({
      where: { key: rateKey(k) },
      create: { key: rateKey(k), value: String(v), updatedBy: by },
      update: { value: String(v), updatedBy: by },
    });
  }
}

// ---------------------------------------------------------------------------------- aircon plan
/** How a room's aircon is paid. PREPAID: tenants top up the smart meter. POSTPAID: billed
 * monthly from the room's aircon meter in 抄表开单. SWITCHING: an aircon meter is registered
 * but only starts next month, so top-ups carry on until then. `from` = first billed month. */
export async function airconPlan(roomId: string) {
  const meters = await prisma.utilityMeter.findMany({
    where: { roomId, kind: "AC", active: true },
    select: { startPeriod: true, createdAt: true },
  });
  if (!meters.length) return { plan: "PREPAID" as const, from: null };
  const from = meters.map(meterStart).sort()[0];
  return { plan: from <= myMonth(new Date()) ? ("POSTPAID" as const) : ("SWITCHING" as const), from };
}

/** Aircon rooms with no aircon meter in 抄表开单 yet — still on prepaid top-up — by unit. */
export async function prepaidAirconRooms() {
  const [rooms, units] = await Promise.all([
    prisma.room.findMany({
      where: { hasAircon: true, isCarpark: false, status: { not: "STORE" }, utilityMeters: { none: { kind: "AC", active: true } } },
      select: { roomCode: true, propertyId: true, propertyName: true },
      orderBy: { roomCode: "asc" },
    }),
    prisma.property.findMany({
      where: { OR: [{ status: null }, { status: { not: "Inactive" } }] },
      select: { id: true, propertyCode: true, name: true },
    }),
  ]);
  const byId = new Map(units.map((u) => [u.id, u]));
  const byName = new Map(units.map((u) => [u.name, u]));
  const out = new Map<string, { propertyCode: string; name: string; rooms: string[] }>();
  for (const r of rooms) {
    // Older rooms sometimes only carry the unit's name, not its id.
    const u = (r.propertyId ? byId.get(r.propertyId) : undefined) ?? byName.get(r.propertyName);
    if (!u) continue;
    const row = out.get(u.propertyCode) ?? { propertyCode: u.propertyCode, name: u.name, rooms: [] };
    row.rooms.push(r.roomCode);
    out.set(u.propertyCode, row);
  }
  return [...out.values()].sort((a, b) => a.propertyCode.localeCompare(b.propertyCode));
}

// ---------------------------------------------------------------------------------- unit
export async function findUnit(propertyCode: string) {
  return prisma.property.findUnique({ where: { propertyCode }, select: { id: true, propertyCode: true, name: true } });
}

/** Rooms of a unit (carparks aren't lived in). Older rooms imported from the spreadsheet era
 * sometimes only carry the unit's name, not its id. */
export async function unitRooms(unit: { id: string; name: string }) {
  return prisma.room.findMany({
    where: { isCarpark: false, OR: [{ propertyId: unit.id }, { propertyName: unit.name }] },
    select: { id: true, roomCode: true, status: true, hasAircon: true },
    orderBy: { roomCode: "asc" },
  });
}

const LIVE = ["ACTIVE", "EXPIRING"] as const;
const ENDED = ["EXPIRED", "MOVED_OUT", "TERMINATED", "RENEWED"] as const;

export type TenancyRow = Tenancy & {
  /** Prepaid balance still to use, by kind (e.g. aircon top-up left over). */
  credit: Partial<Record<UtilityKind, number>>;
  tenantId: string | null;
  contactNumber: string | null;
  expiredDate: string | null;
  status: string;
  /** endDate as entered (null = until the contract ends); until = the day it actually ends. */
  exemptions: { id: string; kind: UtilityKind; startDate: string; endDate: string | null; until: string | null; reason: string; current: boolean }[];
};

/** Everyone who lived in the unit at some point during the month — one entry per tenancy.
 * A renewal's old and new contract (same tenant, same room) count once. */
export async function getTenancies(roomIds: string[], period: string): Promise<TenancyRow[]> {
  if (!roomIds.length) return [];
  const { start, last } = periodBounds(period);
  const contracts = await prisma.contract.findMany({
    where: { roomId: { in: roomIds }, status: { in: [...LIVE, ...ENDED] } },
    select: {
      id: true,
      contractCode: true,
      roomId: true,
      tenantId: true,
      tenantName: true,
      status: true,
      moveInDate: true,
      commencementDate: true,
      expiredDate: true,
      occupants: true,
      utilElectric: true,
      utilAircond: true,
      utilDryer: true,
      contactNumber: true,
      room: { select: { roomCode: true } },
      moveForms: { where: { type: "MOVE_OUT" }, select: { formDate: true, submittedAt: true } },
      utilityExemptions: { orderBy: { startDate: "asc" } },
      utilityCredits: { select: { kind: true, amount: true } },
    },
  });

  const movedIn = (c: (typeof contracts)[number]) => c.moveInDate ?? c.commencementDate;
  const lived = contracts.filter((c) => {
    const from = movedIn(c);
    if (from && from > last) return false;
    if ((LIVE as readonly string[]).includes(c.status)) return true;
    const out = c.moveForms[0]?.formDate ?? c.moveForms[0]?.submittedAt ?? c.expiredDate;
    return !out || out >= start;
  });

  const keyOf = (c: (typeof contracts)[number]) => `${c.roomId}|${c.tenantId ?? c.tenantName.trim().toLowerCase()}`;
  const startMs = (c: (typeof contracts)[number]) => movedIn(c)?.getTime() ?? 0;
  const kept = new Map<string, (typeof contracts)[number]>();
  for (const c of lived) {
    const prev = kept.get(keyOf(c));
    if (!prev || startMs(c) > startMs(prev) || (startMs(c) === startMs(prev) && (LIVE as readonly string[]).includes(c.status))) kept.set(keyOf(c), c);
  }

  return [...kept.values()]
    .sort((a, b) => a.room.roomCode.localeCompare(b.room.roomCode) || startMs(a) - startMs(b))
    .map((c) => {
      const exemptions = c.utilityExemptions
        .filter((e) => isKind(e.kind))
        .map((e) => {
          const until = e.endDate ?? c.expiredDate;
          return {
            id: e.id,
            kind: e.kind as UtilityKind,
            startDate: day(e.startDate)!,
            endDate: day(e.endDate),
            reason: e.reason,
            current: e.startDate <= last && (!until || until >= start),
            until: day(until),
          };
        });
      const exempt: Tenancy["exempt"] = {};
      for (const e of exemptions) if (e.current) exempt[e.kind] = { reason: e.reason, until: e.until };
      const credit: TenancyRow["credit"] = {};
      for (const r of c.utilityCredits) if (isKind(r.kind)) credit[r.kind] = round2((credit[r.kind] ?? 0) + Number(r.amount));
      for (const k of UTILITY_KINDS) if ((credit[k] ?? 0) <= 0) delete credit[k];
      return {
        contractId: c.id,
        contractCode: c.contractCode,
        roomId: c.roomId,
        roomCode: c.room.roomCode,
        tenantName: c.tenantName,
        tenantId: c.tenantId,
        contactNumber: c.contactNumber,
        expiredDate: day(c.expiredDate),
        status: c.status,
        occupants: c.occupants,
        pays: { ELECTRIC: c.utilElectric, LAUNDRY: c.utilDryer, AC: c.utilAircond },
        exempt,
        exemptions,
        credit,
      };
    });
}

/** The reading a meter's bill for `period` starts from: the latest earlier reading, else the
 * reading it was registered with. */
async function previousReadings(meterIds: string[], period: string) {
  const rows = meterIds.length
    ? await prisma.meterReading.findMany({
        where: { meterId: { in: meterIds }, period: { lt: period } },
        orderBy: { period: "desc" },
        select: { meterId: true, period: true, reading: true, usage: true },
      })
    : [];
  const out = new Map<string, { reading: number; period: string }>();
  for (const r of rows) if (r.reading !== null && !out.has(r.meterId)) out.set(r.meterId, { reading: Number(r.reading), period: r.period });
  // kWh used the month before, to spot a mistyped reading.
  const lastUsage = new Map<string, number>();
  for (const r of rows) if (!lastUsage.has(r.meterId)) lastUsage.set(r.meterId, Number(r.usage));
  return { out, lastUsage };
}

/** Everything the 抄表开单 page needs for one unit and one month. */
export async function getUnitBilling(unit: { id: string; propertyCode: string; name: string }, period: string) {
  const [rooms, meters, rates, run] = await Promise.all([
    unitRooms(unit),
    prisma.utilityMeter.findMany({
      where: { propertyId: unit.id, active: true },
      include: { room: { select: { roomCode: true } } },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    getRates(),
    prisma.utilityBillRun.findUnique({
      where: { propertyId_period: { propertyId: unit.id, period } },
      include: {
        payments: { select: { id: true, paymentCode: true, contractId: true, roomCode: true, tenantName: true, type: true, amountDue: true, status: true } },
        readings: { select: { meterId: true, previous: true, reading: true, usage: true, rate: true, photoUrl: true } },
      },
    }),
  ]);
  const tenancies = await getTenancies(
    rooms.map((r) => r.id),
    period
  );
  const { out: prev, lastUsage } = await previousReadings(
    meters.map((m) => m.id),
    period
  );
  // Shared meters first (electricity, then washer & dryer), then each room's meter by room.
  const rows = [...meters]
    .sort((a, b) => Number(!!a.roomId) - Number(!!b.roomId) || UTILITY_KINDS.indexOf(a.kind as UtilityKind) - UTILITY_KINDS.indexOf(b.kind as UtilityKind) || (a.room?.roomCode ?? "").localeCompare(b.room?.roomCode ?? ""))
    .map((m) => {
      const p = prev.get(m.id);
      return {
        id: m.id,
        kind: m.kind as UtilityKind,
        roomId: m.roomId,
        roomCode: m.room?.roomCode ?? null,
        label: m.label,
        meterNo: m.meterNo,
        inputMode: m.inputMode as "READING" | "USAGE",
        startPeriod: meterStart(m),
        startReading: m.startReading === null ? null : Number(m.startReading),
        previous: p ? p.reading : m.startReading === null ? null : Number(m.startReading),
        previousPeriod: p?.period ?? null,
        lastUsage: lastUsage.get(m.id) ?? null,
      };
    });
  return {
    unit,
    period,
    rates,
    rooms: rooms.map((r) => ({ id: r.id, roomCode: r.roomCode, status: r.status, hasAircon: r.hasAircon })),
    /** Meters billed this month. */
    meters: rows.filter((m) => m.startPeriod <= period),
    /** Meters registered to start in a later month (e.g. aircon switching to monthly billing). */
    upcoming: rows.filter((m) => m.startPeriod > period),
    tenancies,
    run: run
      ? {
          runCode: run.runCode,
          splitBy: run.splitBy as SplitBy,
          dueDate: day(run.dueDate),
          totalAmount: Number(run.totalAmount),
          billedAmount: Number(run.billedAmount),
          companyAmount: Number(run.companyAmount),
          creditAmount: Number(run.creditAmount),
          details: run.details,
          createdBy: run.createdBy,
          createdAt: run.createdAt.toISOString(),
          payments: run.payments.map((p) => ({ ...p, amountDue: Number(p.amountDue) })),
          readings: run.readings.map((r) => ({
            meterId: r.meterId,
            previous: r.previous === null ? null : Number(r.previous),
            reading: r.reading === null ? null : Number(r.reading),
            usage: Number(r.usage),
            rate: Number(r.rate),
            photoUrl: r.photoUrl,
          })),
        }
      : null,
  };
}
export type UnitBilling = Awaited<ReturnType<typeof getUnitBilling>>;

// ---------------------------------------------------------------------------------- issue
export interface MeterInput {
  meterId: string;
  /** READING mode */
  previous?: number | null;
  reading?: number | null;
  /** USAGE mode, or a manual kWh when the meter was reset */
  usage?: number | null;
  photoUrl?: string | null;
}

export class BillingError extends Error {}

/** Works out usage per meter from what was typed. */
export function usageFromInputs(
  meters: UnitBilling["meters"],
  inputs: MeterInput[],
  rates: Record<UtilityKind, number>
): { usages: MeterUsage[]; readings: Map<string, { previous: number | null; reading: number | null; usage: number; photoUrl: string | null }> } {
  const byId = new Map(inputs.map((i) => [i.meterId, i]));
  const usages: MeterUsage[] = [];
  const readings = new Map<string, { previous: number | null; reading: number | null; usage: number; photoUrl: string | null }>();
  for (const m of meters) {
    const i = byId.get(m.id);
    if (!i) throw new BillingError(`${m.roomCode ?? KIND_LABELS[m.kind].zh} 的电表还没填`);
    let usage: number;
    let previous: number | null = null;
    let reading: number | null = null;
    if (m.inputMode === "READING" && i.reading !== undefined && i.reading !== null && (i.usage === undefined || i.usage === null)) {
      previous = i.previous ?? m.previous;
      reading = i.reading;
      if (previous === null || previous === undefined) throw new BillingError(`${m.roomCode ?? KIND_LABELS[m.kind].zh}：请填上个月的读数`);
      if (!Number.isFinite(reading) || reading < previous) throw new BillingError(`${m.roomCode ?? KIND_LABELS[m.kind].zh}：这个月的读数比上个月小，请检查（换了电表就直接填度数）`);
      usage = round2(reading - previous);
    } else {
      usage = Number(i.usage);
      if (!Number.isFinite(usage) || usage < 0) throw new BillingError(`${m.roomCode ?? KIND_LABELS[m.kind].zh}：度数不对`);
      usage = round2(usage);
      if (i.reading !== undefined && i.reading !== null) reading = i.reading;
    }
    usages.push({ meterId: m.id, kind: m.kind, roomId: m.roomId, roomCode: m.roomCode, label: m.label, usage, rate: rates[m.kind] });
    readings.set(m.id, { previous, reading, usage, photoUrl: i.photoUrl ?? null });
  }
  return { usages, readings };
}

export async function issueRun(opts: {
  unit: { id: string; propertyCode: string; name: string };
  period: string;
  splitBy: SplitBy;
  dueDate: string;
  inputs: MeterInput[];
  overrides: Overrides;
  /** contractIds left out of this month's split on purpose (e.g. moved out long ago) */
  skip: string[];
  by: string;
}) {
  const data = await getUnitBilling(opts.unit, opts.period);
  if (data.run) throw new BillingError(`${opts.unit.propertyCode} ${opts.period} 已经开过账单了（${data.run.runCode}）`);
  if (!data.meters.length) {
    throw new BillingError(data.upcoming.length ? `这个单位的电表 ${data.upcoming[0].startPeriod} 才开始收` : "这个单位还没有登记电表");
  }

  const { usages, readings } = usageFromInputs(data.meters, opts.inputs, data.rates);
  const tenancies = data.tenancies.filter((t) => !opts.skip.includes(t.contractId));
  const result = splitUsage(usages, tenancies, opts.splitBy);
  const credits: Credits = Object.fromEntries(tenancies.map((t) => [t.contractId, t.credit]));
  const final = finalBills(result, opts.overrides, credits);
  // Bills fully paid from a prepaid balance get no bill — only the balance going down.
  const toBill = final.bills.filter((b) => b.amount > 0);
  const due = new Date(`${opts.dueDate}T00:00:00.000Z`);

  const tenancyById = new Map(tenancies.map((t) => [t.contractId, t]));
  const codes = await Promise.all(toBill.map(() => newId("PY")));
  const runCode = await newId("UB");

  const notes = toBill.map((b) => {
    const tb = result.tenants.find((t) => t.tenancy.contractId === b.contractId)!;
    const lines = tb.lines.filter((l) => l.kind === b.kind);
    const ms = lines.map((l) => {
      const mr = result.meters.find((x) => x.meter.meterId === l.meterId)!;
      const rd = readings.get(l.meterId)!;
      return { usage: mr.meter.usage, rate: mr.meter.rate, amount: mr.amount, previous: rd.previous, reading: rd.reading };
    });
    return billNote(b.kind, opts.period, ms, lines.find((l) => l.share)?.share ?? null, round2(b.amount + b.credit), b.computed, b.credit);
  });

  const details = {
    splitBy: opts.splitBy,
    meters: result.meters.map((m) => ({ ...m.meter, amount: m.amount, shareTotal: m.shareTotal, vacant: m.vacant, ...readings.get(m.meter.meterId) })),
    tenants: result.tenants.map((t) => ({
      contractId: t.tenancy.contractId,
      contractCode: t.tenancy.contractCode,
      roomCode: t.tenancy.roomCode,
      tenantName: t.tenancy.tenantName,
      occupants: t.tenancy.occupants,
      exempt: t.tenancy.exempt,
      lines: t.lines,
    })),
    skipped: opts.skip,
    overrides: opts.overrides,
    bills: final.bills,
  };

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.utilityBillRun.create({
      data: {
        runCode,
        propertyId: opts.unit.id,
        period: opts.period,
        splitBy: opts.splitBy,
        dueDate: due,
        totalAmount: result.total,
        billedAmount: final.billed,
        companyAmount: final.company,
        creditAmount: final.credited,
        details: JSON.parse(JSON.stringify(details)),
        createdBy: opts.by,
      },
    });
    for (const m of usages) {
      const r = readings.get(m.meterId)!;
      await tx.meterReading.upsert({
        where: { meterId_period: { meterId: m.meterId, period: opts.period } },
        create: { meterId: m.meterId, period: opts.period, previous: r.previous, reading: r.reading, usage: r.usage, rate: m.rate, photoUrl: r.photoUrl, runId: created.id, createdBy: opts.by },
        update: { previous: r.previous, reading: r.reading, usage: r.usage, rate: m.rate, photoUrl: r.photoUrl, runId: created.id, createdBy: opts.by },
      });
    }
    for (const b of final.bills.filter((x) => x.credit > 0)) {
      await tx.utilityCredit.create({
        data: {
          contractId: b.contractId,
          kind: b.kind,
          amount: -b.credit,
          note: `${opts.period} ${KIND_LABELS[b.kind].zh}账单扣除（${runCode}）`,
          runId: created.id,
          createdBy: opts.by,
        },
      });
    }
    for (const [i, b] of toBill.entries()) {
      const t = tenancyById.get(b.contractId)!;
      await tx.payment.create({
        data: {
          paymentCode: codes[i],
          contractId: b.contractId,
          roomCode: t.roomCode,
          tenantId: t.tenantId,
          tenantName: t.tenantName,
          periodMonth: opts.period,
          type: KIND_PAYMENT_TYPE[b.kind],
          amountDue: b.amount,
          amountPaid: 0,
          dueDate: due,
          status: "PENDING",
          recordedBy: opts.by,
          notes: notes[i],
          utilityRunId: created.id,
        },
      });
    }
    return created;
  });

  const perTenant = new Map<string, { tenancy: TenancyRow; lines: { kind: UtilityKind; amount: number; note: string; paymentCode: string }[] }>();
  toBill.forEach((b, i) => {
    const t = tenancyById.get(b.contractId)!;
    if (!perTenant.has(b.contractId)) perTenant.set(b.contractId, { tenancy: t, lines: [] });
    perTenant.get(b.contractId)!.lines.push({ kind: b.kind, amount: b.amount, note: notes[i], paymentCode: codes[i] });
  });

  return {
    run,
    result,
    final,
    perTenant: [...perTenant.values()],
    whatsapp: whatsappText(
      opts.unit.propertyCode,
      opts.period,
      usages,
      toBill.map((b) => ({ roomCode: tenancyById.get(b.contractId)!.roomCode, amount: b.amount })),
      opts.dueDate
    ),
  };
}

/** Undo a month's bills — only while none of them has been paid or had a slip uploaded. */
export async function voidRun(runCode: string) {
  const run = await prisma.utilityBillRun.findUnique({ where: { runCode }, include: { payments: true, property: { select: { propertyCode: true } } } });
  if (!run) throw new BillingError("找不到这次开单");
  const touched = run.payments.filter((p) => p.status !== "PENDING");
  if (touched.length) throw new BillingError(`有 ${touched.length} 张账单已经付款或上传了交易单，不能撤销；请到合同里个别处理`);
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { utilityRunId: run.id } }),
    prisma.meterReading.deleteMany({ where: { runId: run.id } }),
    // Prepaid balance this month used goes back to the tenants.
    prisma.utilityCredit.deleteMany({ where: { runId: run.id } }),
    prisma.utilityBillRun.delete({ where: { id: run.id } }),
  ]);
  return run;
}

/** Units with meters, and whether `period` has been billed — for the overview and the home page. */
export async function billingOverview(period: string) {
  const units = await prisma.property.findMany({
    where: { utilityMeters: { some: { active: true } } },
    select: {
      id: true,
      propertyCode: true,
      name: true,
      utilityMeters: { where: { active: true }, select: { kind: true, roomId: true, createdAt: true, startPeriod: true } },
      utilityRuns: {
        where: { period },
        select: {
          runCode: true,
          totalAmount: true,
          billedAmount: true,
          companyAmount: true,
          creditAmount: true,
          payments: { select: { status: true, amountPaid: true } },
          readings: { select: { usage: true, meter: { select: { kind: true } } } },
        },
      },
    },
    orderBy: { propertyCode: "asc" },
  });
  return units.map((u) => {
    const run = u.utilityRuns[0];
    // Meters billed this month. A unit whose meters all start later (e.g. registered this month,
    // or aircon switching over next month) isn't flagged as missing for this month.
    const billed = u.utilityMeters.filter((m) => meterStart(m) <= period);
    const since = u.utilityMeters.map(meterStart).sort()[0];
    return {
      propertyCode: u.propertyCode,
      name: u.name,
      kinds: UTILITY_KINDS.filter((k) => (billed.length ? billed : u.utilityMeters).some((m) => m.kind === k)),
      meterCount: (billed.length ? billed : u.utilityMeters).length,
      since,
      startsLater: !billed.length,
      run: run
        ? {
            runCode: run.runCode,
            total: Number(run.totalAmount),
            billed: Number(run.billedAmount),
            company: Number(run.companyAmount),
            credit: Number(run.creditAmount),
            bills: run.payments.length,
            paid: run.payments.filter((p) => p.status === "Paid").length,
            collected: round2(run.payments.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.amountPaid), 0)),
            kwh: kwhByKind(run.readings),
          }
        : null,
    };
  });
}

function kwhByKind(readings: { usage: unknown; meter: { kind: string } }[]) {
  const out: Record<UtilityKind, number> = { ELECTRIC: 0, LAUNDRY: 0, AC: 0 };
  for (const r of readings) if (isKind(r.meter.kind)) out[r.meter.kind] = round2(out[r.meter.kind] + Number(r.usage));
  return out;
}

/** The unit's last 12 billed months: kWh by kind, amounts, and how much is paid. */
export async function unitHistory(unitId: string) {
  const runs = await prisma.utilityBillRun.findMany({
    where: { propertyId: unitId },
    orderBy: { period: "desc" },
    take: 12,
    select: {
      period: true,
      runCode: true,
      totalAmount: true,
      billedAmount: true,
      companyAmount: true,
      creditAmount: true,
      payments: { select: { status: true, amountPaid: true } },
      readings: { select: { usage: true, meter: { select: { kind: true } } } },
    },
  });
  return runs.map((r) => ({
    period: r.period,
    runCode: r.runCode,
    total: Number(r.totalAmount),
    billed: Number(r.billedAmount),
    company: Number(r.companyAmount),
    credit: Number(r.creditAmount),
    bills: r.payments.length,
    paid: r.payments.filter((p) => p.status === "Paid").length,
    collected: round2(r.payments.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.amountPaid), 0)),
    kwh: kwhByKind(r.readings),
  }));
}
export type UnitHistory = Awaited<ReturnType<typeof unitHistory>>;

/** Last full month — the one that gets billed. */
export function defaultBillingPeriod(todayMY: Date) {
  const cur = `${todayMY.getUTCFullYear()}-${String(todayMY.getUTCMonth() + 1).padStart(2, "0")}`;
  return addMonths(cur, -1);
}
