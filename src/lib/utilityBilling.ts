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

// ---------------------------------------------------------------------------------- unit
export async function findUnit(propertyCode: string) {
  return prisma.property.findUnique({ where: { propertyCode }, select: { id: true, propertyCode: true, name: true } });
}

/** Rooms of a unit (carparks aren't lived in). Older rooms imported from the spreadsheet era
 * sometimes only carry the unit's name, not its id. */
export async function unitRooms(unit: { id: string; name: string }) {
  return prisma.room.findMany({
    where: { isCarpark: false, OR: [{ propertyId: unit.id }, { propertyName: unit.name }] },
    select: { id: true, roomCode: true, status: true },
    orderBy: { roomCode: "asc" },
  });
}

const LIVE = ["ACTIVE", "EXPIRING"] as const;
const ENDED = ["EXPIRED", "MOVED_OUT", "TERMINATED", "RENEWED"] as const;

export type TenancyRow = Tenancy & {
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
      };
    });
}

/** The reading a meter's bill for `period` starts from: the latest earlier reading, else the
 * reading it was registered with. */
async function previousReadings(meterIds: string[], period: string) {
  const rows = meterIds.length
    ? await prisma.meterReading.findMany({
        where: { meterId: { in: meterIds }, period: { lt: period }, reading: { not: null } },
        orderBy: { period: "desc" },
        select: { meterId: true, period: true, reading: true },
      })
    : [];
  const out = new Map<string, { reading: number; period: string }>();
  for (const r of rows) if (!out.has(r.meterId)) out.set(r.meterId, { reading: Number(r.reading), period: r.period });
  return out;
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
  const prev = await previousReadings(
    meters.map((m) => m.id),
    period
  );
  return {
    unit,
    period,
    rates,
    rooms: rooms.map((r) => ({ id: r.id, roomCode: r.roomCode, status: r.status })),
    // Shared meters first (electricity, then washer & dryer), then each room's meter by room.
    meters: [...meters]
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
          startReading: m.startReading === null ? null : Number(m.startReading),
          previous: p ? p.reading : m.startReading === null ? null : Number(m.startReading),
          previousPeriod: p?.period ?? null,
        };
      }),
    tenancies,
    run: run
      ? {
          runCode: run.runCode,
          splitBy: run.splitBy as SplitBy,
          dueDate: day(run.dueDate),
          totalAmount: Number(run.totalAmount),
          billedAmount: Number(run.billedAmount),
          companyAmount: Number(run.companyAmount),
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
  if (!data.meters.length) throw new BillingError("这个单位还没有登记电表");

  const { usages, readings } = usageFromInputs(data.meters, opts.inputs, data.rates);
  const tenancies = data.tenancies.filter((t) => !opts.skip.includes(t.contractId));
  const result = splitUsage(usages, tenancies, opts.splitBy);
  const final = finalBills(result, opts.overrides);
  const due = new Date(`${opts.dueDate}T00:00:00.000Z`);

  const tenancyById = new Map(tenancies.map((t) => [t.contractId, t]));
  const codes = await Promise.all(final.bills.map(() => newId("PY")));
  const runCode = await newId("UB");

  const notes = final.bills.map((b) => {
    const tb = result.tenants.find((t) => t.tenancy.contractId === b.contractId)!;
    const lines = tb.lines.filter((l) => l.kind === b.kind);
    const ms = lines.map((l) => {
      const mr = result.meters.find((x) => x.meter.meterId === l.meterId)!;
      const rd = readings.get(l.meterId)!;
      return { usage: mr.meter.usage, rate: mr.meter.rate, amount: mr.amount, previous: rd.previous, reading: rd.reading };
    });
    return billNote(b.kind, opts.period, ms, lines.find((l) => l.share)?.share ?? null, b.amount, b.computed);
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
    for (const [i, b] of final.bills.entries()) {
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
  final.bills.forEach((b, i) => {
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
      final.bills.map((b) => ({ roomCode: tenancyById.get(b.contractId)!.roomCode, amount: b.amount })),
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
      utilityMeters: { select: { kind: true, roomId: true, active: true, createdAt: true } },
      utilityRuns: { where: { period }, select: { runCode: true, billedAmount: true, companyAmount: true, payments: { select: { status: true } } } },
    },
    orderBy: { propertyCode: "asc" },
  });
  return units.map((u) => {
    const run = u.utilityRuns[0];
    const active = u.utilityMeters.filter((m) => m.active);
    // The month the unit's first meter was registered (Malaysia time). A month before that was
    // billed outside the system, so it isn't flagged as missing — it can still be billed late.
    const since = new Date(Math.min(...u.utilityMeters.map((m) => m.createdAt.getTime())) + 8 * 3600_000).toISOString().slice(0, 7);
    return {
      propertyCode: u.propertyCode,
      name: u.name,
      kinds: UTILITY_KINDS.filter((k) => active.some((m) => m.kind === k)),
      meterCount: active.length,
      since,
      registeredLater: since > period,
      run: run
        ? {
            runCode: run.runCode,
            billed: Number(run.billedAmount),
            company: Number(run.companyAmount),
            bills: run.payments.length,
            paid: run.payments.filter((p) => p.status === "Paid").length,
          }
        : null,
    };
  });
}

/** Last full month — the one that gets billed. */
export function defaultBillingPeriod(todayMY: Date) {
  const cur = `${todayMY.getUTCFullYear()}-${String(todayMY.getUTCMonth() + 1).padStart(2, "0")}`;
  return addMonths(cur, -1);
}
