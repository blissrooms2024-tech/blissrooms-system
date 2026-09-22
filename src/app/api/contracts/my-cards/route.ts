import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  // Not restricted to role === "TENANT": an Agent can also be the tenant on their own contract,
  // the query below is already scoped to their own tenantId either way.
  if (user.role !== "TENANT" && user.role !== "AGENT") {
    return NextResponse.json({ success: false, message: "只有租客可以看" }, { status: 403 });
  }

  const contracts = await prisma.contract.findMany({
    where: { tenantId: user.sub },
    orderBy: { createdAt: "desc" },
    include: {
      room: { select: { roomCode: true, isCarpark: true, carparkLotNumber: true } },
      carparkRoom: { select: { roomCode: true, carparkLotNumber: true } },
    },
  });

  const [paidGroups, depositPaidGroups, moveForms, unpaidBills, openMaintenance, warningLetters] = await Promise.all([
    prisma.payment.groupBy({
      by: ["contractId"],
      where: { contractId: { in: contracts.map((c) => c.id) }, status: "Paid" },
      _sum: { amountPaid: true },
    }),
    prisma.payment.groupBy({
      by: ["contractId"],
      where: { contractId: { in: contracts.map((c) => c.id) }, status: "Paid", type: "DEPOSIT" },
      _sum: { amountPaid: true },
    }),
    prisma.moveInOutForm.findMany({
      where: { contractId: { in: contracts.map((c) => c.id) } },
      select: { contractId: true, type: true },
    }),
    prisma.payment.findMany({
      where: { contractId: { in: contracts.map((c) => c.id) }, status: { in: ["PENDING", "REJECTED"] } },
      select: { contractId: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        contractId: { in: contracts.map((c) => c.id) },
        status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] },
      },
      select: { contractId: true },
    }),
    prisma.warningLetter.findMany({
      where: { contractId: { in: contracts.map((c) => c.id) } },
      select: { contractId: true },
    }),
  ]);

  const paidMap = new Map(paidGroups.map((g) => [g.contractId, Number(g._sum.amountPaid ?? 0)]));
  const depositPaidMap = new Map(depositPaidGroups.map((g) => [g.contractId, Number(g._sum.amountPaid ?? 0)]));
  const moveSet = new Set(moveForms.map((m) => `${m.contractId}_${m.type}`));
  const unpaidBillCount = new Map<string, number>();
  for (const b of unpaidBills) unpaidBillCount.set(b.contractId, (unpaidBillCount.get(b.contractId) ?? 0) + 1);
  const openMaintenanceCount = new Map<string, number>();
  for (const m of openMaintenance) openMaintenanceCount.set(m.contractId, (openMaintenanceCount.get(m.contractId) ?? 0) + 1);
  const warningLetterCount = new Map<string, number>();
  for (const w of warningLetters) warningLetterCount.set(w.contractId, (warningLetterCount.get(w.contractId) ?? 0) + 1);

  const cards = contracts.map((c) => {
    const paid = paidMap.get(c.id) ?? 0;
    const outstanding = Math.max(Number(c.totalOutstanding) - paid, 0);
    const depositOutstanding = Math.max(
      Number(c.securityDeposit) - (depositPaidMap.get(c.id) ?? 0),
      0
    );
    const daysToExpiry = c.expiredDate
      ? Math.ceil((new Date(c.expiredDate).getTime() - Date.now()) / (24 * 3600 * 1000))
      : null;
    return {
      contractCode: c.contractCode,
      roomCode: c.room.roomCode,
      status: c.status,
      // Either the main room itself IS the carpark, or there's a separate linked carpark
      // add-on — either way, show the tenant which lot is theirs.
      carparkRoomCode: c.room.isCarpark ? c.room.roomCode : (c.carparkRoom?.roomCode ?? null),
      carparkLotNumber: c.room.isCarpark ? c.room.carparkLotNumber : (c.carparkRoom?.carparkLotNumber ?? null),
      totalOutstanding: Number(c.totalOutstanding),
      paid,
      outstanding,
      depositOutstanding,
      agentSigned: !!c.agentSignature,
      tenantSigned: !!c.tenantSignature,
      // Legacy-imported contracts go straight to ACTIVE with no digital signature on either
      // side — they were signed on paper before import, so the sign-in-app flow and the
      // original move-in form (already recorded in the old Google Form) don't apply.
      isLegacy: c.status === "ACTIVE" && !c.agentSignature && !c.tenantSignature,
      hasICFront: !!c.icFront,
      hasICBack: !!c.icBack,
      moveInDone: moveSet.has(`${c.id}_MOVE_IN`),
      moveOutDone: moveSet.has(`${c.id}_MOVE_OUT`),
      unpaidBillCount: unpaidBillCount.get(c.id) ?? 0,
      openMaintenanceCount: openMaintenanceCount.get(c.id) ?? 0,
      warningLetterCount: warningLetterCount.get(c.id) ?? 0,
      expiredDate: c.expiredDate,
      daysToExpiry,
      moveOutNoticeDate: c.moveOutNoticeDate,
      nationality: c.nationality,
      contactNumber: c.contactNumber,
      email: c.email,
      occupation: c.occupation,
      company: c.company,
      carPlate: c.carPlate,
      emergencyName: c.emergencyName,
      emergencyContact: c.emergencyContact,
      emergencyRelationship: c.emergencyRelationship,
      pdfLink: c.pdfLink,
    };
  });

  return NextResponse.json({ success: true, cards });
}
