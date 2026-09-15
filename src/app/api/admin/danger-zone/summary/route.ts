import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Counts feeding the danger-zone confirmation screen, so Admin can sanity-check what's about
 * to be wiped before typing the confirmation phrase. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以看" }, { status: 403 });
  }

  const [users, properties, rooms, contracts, payments, commissions, moveForms, maintenance, warningLetters, logs] =
    await Promise.all([
      prisma.user.count({ where: { role: { not: "ADMIN" } } }),
      prisma.property.count(),
      prisma.room.count(),
      prisma.contract.count(),
      prisma.payment.count(),
      prisma.commission.count(),
      prisma.moveInOutForm.count(),
      prisma.maintenanceRequest.count(),
      prisma.warningLetter.count(),
      prisma.log.count(),
    ]);

  return NextResponse.json({
    success: true,
    counts: { users, properties, rooms, contracts, payments, commissions, moveForms, maintenance, warningLetters, logs },
  });
}
