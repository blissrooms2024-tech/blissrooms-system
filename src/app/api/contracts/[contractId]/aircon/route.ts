import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { airconPlan, getRates, myMonth } from "@/lib/utilityBilling";
import { round2 } from "@/lib/utilitySplit";

/** Today's date in Malaysia, YYYY-MM-DD. */
const myMonthDay = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

/** GET /api/contracts/CT-0001/aircon — how this tenancy's aircon is paid (top-up or monthly
 * billing) and, for monthly billing, each month's meter reading, kWh and bill. Only months the
 * tenant lived in the room are shown, never an earlier tenant's usage. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    select: {
      id: true,
      agentId: true,
      tenantId: true,
      roomId: true,
      status: true,
      moveInDate: true,
      commencementDate: true,
      expiredDate: true,
      utilAircond: true,
      room: { select: { hasAircon: true } },
      moveForms: { where: { type: "MOVE_OUT" }, select: { formDate: true, submittedAt: true } },
    },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  const allowed = user.role === "BOSS" || user.role === "ADMIN" || (user.role === "AGENT" && c.agentId === user.sub) || c.tenantId === user.sub;
  if (!allowed) return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });

  const [plan, rates] = await Promise.all([airconPlan(c.roomId), getRates()]);

  // The months this tenancy covers: from moving in to moving out (or the end of the contract).
  const movedIn = c.moveInDate ?? c.commencementDate;
  const ended = !["ACTIVE", "EXPIRING"].includes(c.status);
  const out = ended ? (c.moveForms[0]?.formDate ?? c.moveForms[0]?.submittedAt ?? c.expiredDate) : null;
  const first = movedIn ? myMonth(movedIn) : "0000-01";
  const last = out ? myMonth(out) : "9999-12";

  const [readings, bills, credits] = await Promise.all([
    prisma.meterReading.findMany({
      where: { meter: { roomId: c.roomId, kind: "AC" }, period: { gte: first, lte: last } },
      orderBy: { period: "desc" },
      take: 36,
      select: { period: true, previous: true, reading: true, usage: true, rate: true, photoUrl: true },
    }),
    prisma.payment.findMany({
      where: { contractId: c.id, type: "AC", periodMonth: { not: null } },
      select: { paymentCode: true, periodMonth: true, amountDue: true, status: true, dueDate: true },
    }),
    prisma.utilityCredit.findMany({
      where: { contractId: c.id, kind: "AC" },
      select: { amount: true, run: { select: { period: true } } },
    }),
  ]);
  // Prepaid balance left, and how much of it each month's bill used.
  const balance = round2(credits.reduce((s, r) => s + Number(r.amount), 0));
  const usedIn = new Map<string, number>();
  for (const r of credits) if (r.run) usedIn.set(r.run.period, round2((usedIn.get(r.run.period) ?? 0) - Number(r.amount)));
  const today = myMonthDay();

  const months = new Map<
    string,
    { period: string; usage: number; amount: number; meters: { previous: number | null; reading: number | null; usage: number; rate: number; photoUrl: string | null }[] }
  >();
  for (const r of readings) {
    const m = months.get(r.period) ?? { period: r.period, usage: 0, amount: 0, meters: [] };
    const usage = Number(r.usage);
    const rate = Number(r.rate);
    m.usage = round2(m.usage + usage);
    m.amount = round2(m.amount + usage * rate);
    m.meters.push({ previous: r.previous === null ? null : Number(r.previous), reading: r.reading === null ? null : Number(r.reading), usage, rate, photoUrl: r.photoUrl });
    months.set(r.period, m);
  }

  return NextResponse.json({
    success: true,
    hasAircon: c.room.hasAircon,
    plan: plan.plan,
    from: plan.from,
    rate: rates.AC,
    /** False when the contract doesn't charge aircon (company pays it). */
    pays: c.utilAircond,
    /** Unused top-up still to come off aircon bills. */
    balance: Math.max(0, balance),
    months: [...months.values()].map((m) => {
      const bill = bills.find((b) => b.periodMonth === m.period);
      const due = bill?.dueDate ? bill.dueDate.toISOString().slice(0, 10) : null;
      const unpaid = bill && (bill.status === "PENDING" || bill.status === "REJECTED");
      return {
        ...m,
        credit: usedIn.get(m.period) ?? 0,
        bill: bill
          ? {
              paymentCode: bill.paymentCode,
              amountDue: Number(bill.amountDue),
              status: bill.status,
              dueDate: due,
              overdueDays: unpaid && due && due < today ? Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000) : 0,
            }
          : null,
      };
    }),
  });
}
