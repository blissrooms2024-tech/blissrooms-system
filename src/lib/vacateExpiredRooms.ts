import { prisma } from "@/lib/prisma";

/** The moment a contract's lease term ends, its room should show as available again for
 * Admin/Agent to re-market — there's no grace period here (unlike the tenant-login
 * auto-disable), since Admin already follows up on overdue tenants via the 续约管理 list and
 * WhatsApp. Only the ROOM side is touched — the Contract itself stays ACTIVE (billing,
 * outstanding tracking and the renewal list all key off that), so processing a renewal on the
 * same contract (see the renew endpoint) simply re-occupies the room it had freed up. */
export async function vacateExpiredContractRooms() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const expired = await prisma.contract.findMany({
    where: { status: "ACTIVE", expiredDate: { lt: startOfToday } },
    select: {
      contractCode: true,
      roomId: true,
      carparkRoomId: true,
      room: { select: { id: true, currentContractId: true, status: true } },
      carparkRoom: { select: { id: true, currentContractId: true, status: true } },
    },
  });

  let vacated = 0;
  for (const c of expired) {
    if (c.room.currentContractId === c.contractCode && c.room.status !== "VACANT") {
      await prisma.room.update({
        where: { id: c.room.id },
        data: { status: "VACANT", currentContractId: null, currentTenantId: null },
      });
      vacated++;
    }
    if (c.carparkRoom && c.carparkRoom.currentContractId === c.contractCode && c.carparkRoom.status !== "VACANT") {
      await prisma.room.update({
        where: { id: c.carparkRoom.id },
        data: { status: "VACANT", currentContractId: null, currentTenantId: null },
      });
      vacated++;
    }
  }
  return { vacated };
}
