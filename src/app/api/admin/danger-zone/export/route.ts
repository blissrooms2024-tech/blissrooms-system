import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** Full JSON snapshot of everything the danger-zone reset is about to delete, so Admin has a
 * backup on their own computer before wiping. Not a restore tool — just a safety net. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以看" }, { status: 403 });
  }

  const [users, properties, rooms, contracts, payments, commissions, moveForms, maintenance, warningLetters, logs] =
    await Promise.all([
      prisma.user.findMany({ where: { role: { not: "ADMIN" } } }),
      prisma.property.findMany(),
      prisma.room.findMany(),
      prisma.contract.findMany(),
      prisma.payment.findMany(),
      prisma.commission.findMany(),
      prisma.moveInOutForm.findMany(),
      prisma.maintenanceRequest.findMany(),
      prisma.warningLetter.findMany(),
      prisma.log.findMany(),
    ]);

  return NextResponse.json(
    serialize({
      exportedAt: new Date(),
      users,
      properties,
      rooms,
      contracts,
      payments,
      commissions,
      moveForms,
      maintenance,
      warningLetters,
      logs,
    })
  );
}
