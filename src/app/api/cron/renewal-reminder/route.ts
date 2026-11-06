import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { RULES } from "@/lib/config";
import { notifyAdminsRenewalReminder } from "@/lib/mail";

/** Vercel Cron hits this daily. Finds ACTIVE contracts whose expiredDate is already past, or
 * falls inside the renewal notice window — same threshold as the "⏰ 快到期" badge and the
 * /contracts/renewal candidates list — and haven't been renewed yet (renewing pushes
 * expiredDate out past the cutoff, which is what makes a contract drop off this list on its
 * own). Only emails Admin about contracts that weren't already flagged on a previous run
 * (tracked via a dedicated Log row per contract), so it's one notice per contract entering
 * the window, not the same list re-sent every day for the whole notice period. Sends nothing
 * if there's nothing new to flag. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const cutoff = new Date(startOfToday);
  cutoff.setMonth(cutoff.getMonth() + RULES.NOTICE_MONTHS);

  const contracts = await prisma.contract.findMany({
    where: { status: "ACTIVE", expiredDate: { lte: cutoff } },
    orderBy: { expiredDate: "asc" },
    include: { room: { select: { roomCode: true } } },
  });

  if (contracts.length === 0) {
    return NextResponse.json({ success: true, flagged: 0 });
  }

  const alreadyFlagged = await prisma.log.findMany({
    where: { type: "RenewalReminderSent", relatedId: { in: contracts.map((c) => c.contractCode) } },
    select: { relatedId: true },
  });
  const alreadyFlaggedSet = new Set(alreadyFlagged.map((l) => l.relatedId));

  const newlyFlagged = contracts.filter((c) => !alreadyFlaggedSet.has(c.contractCode));
  if (newlyFlagged.length === 0) {
    return NextResponse.json({ success: true, flagged: 0 });
  }

  const payload = newlyFlagged.map((c) => ({
    contractCode: c.contractCode,
    tenantName: c.tenantName,
    roomCode: c.room.roomCode,
    expiredDate: c.expiredDate ? c.expiredDate.toISOString() : null,
    daysToExpiry: c.expiredDate ? Math.ceil((c.expiredDate.getTime() - startOfToday.getTime()) / (24 * 3600 * 1000)) : null,
  }));

  await notifyAdminsRenewalReminder(payload);

  for (const c of newlyFlagged) {
    await prisma.log.create({
      data: { logCode: await newId("LG"), type: "RenewalReminderSent", relatedId: c.contractCode, triggeredBy: "system-cron" },
    });
  }

  return NextResponse.json({ success: true, flagged: newlyFlagged.length, contractCodes: newlyFlagged.map((c) => c.contractCode) });
}
