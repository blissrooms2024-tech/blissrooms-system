import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { notifyTenantBillCreated } from "@/lib/mail";

/** Opens next month's RENTAL bill (and CARPARK bill, if the contract has one) for every ACTIVE
 * contract, due on the 5th of that next month. Skips a contract whose expiredDate falls before
 * that due date, and skips any contract whose tenant account isn't verified yet (User.verified)
 * — typically a legacy-imported record Admin hasn't finished checking. Idempotent per
 * contract+periodMonth, so re-running it (via cron retry, or an Admin's manual catch-up trigger)
 * never doubles up a tenant's rent bill. Shared by the scheduled cron and the Admin-triggered
 * manual "generate now" action, so both paths behave identically. */
export async function runMonthlyRentJob(recordedBy = "System (Cron)") {
  const now = new Date();
  const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonthIndex = (now.getMonth() + 1) % 12; // 0-indexed
  const periodMonth = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, "0")}`;
  const dueDate = new Date(nextMonthYear, nextMonthIndex, 5);

  const contracts = await prisma.contract.findMany({
    where: { status: "ACTIVE" },
    include: { room: true, tenant: true },
  });

  let rentalCreated = 0;
  let carparkCreated = 0;
  let skippedExpiring = 0;
  let skippedUnverified = 0;

  for (const c of contracts) {
    if (c.expiredDate && c.expiredDate < dueDate) {
      skippedExpiring++;
      continue;
    }
    if (!c.tenant || !c.tenant.verified) {
      skippedUnverified++;
      continue;
    }

    const existingRental = await prisma.payment.findFirst({
      where: { contractId: c.id, type: "RENTAL", periodMonth },
    });
    if (!existingRental) {
      const paymentCode = await newId("PY");
      await prisma.payment.create({
        data: {
          paymentCode,
          contractId: c.id,
          roomCode: c.room.roomCode,
          tenantId: c.tenantId,
          tenantName: c.tenantName,
          periodMonth,
          type: "RENTAL",
          amountDue: c.roomRental,
          amountPaid: 0,
          dueDate,
          status: "PENDING",
          recordedBy,
        },
      });
      rentalCreated++;
      if (c.tenant) {
        await notifyTenantBillCreated(
          c.tenant,
          {
            paymentCode,
            contractCode: c.contractCode,
            roomCode: c.room.roomCode,
            type: "RENTAL",
            amountDue: Number(c.roomRental),
            amountPaid: 0,
            dueDate: dueDate.toISOString(),
            periodMonth,
          },
          "system-cron"
        );
      }
    }

    if (Number(c.carparkRental) > 0) {
      const existingCarpark = await prisma.payment.findFirst({
        where: { contractId: c.id, type: "CARPARK", periodMonth },
      });
      if (!existingCarpark) {
        const paymentCode = await newId("PY");
        await prisma.payment.create({
          data: {
            paymentCode,
            contractId: c.id,
            roomCode: c.room.roomCode,
            tenantId: c.tenantId,
            tenantName: c.tenantName,
            periodMonth,
            type: "CARPARK",
            amountDue: c.carparkRental,
            amountPaid: 0,
            dueDate,
            status: "PENDING",
            recordedBy,
          },
        });
        carparkCreated++;
        if (c.tenant) {
          await notifyTenantBillCreated(
            c.tenant,
            {
              paymentCode,
              contractCode: c.contractCode,
              roomCode: c.room.roomCode,
              type: "CARPARK",
              amountDue: Number(c.carparkRental),
              amountPaid: 0,
              dueDate: dueDate.toISOString(),
              periodMonth,
            },
            "system-cron"
          );
        }
      }
    }
  }

  return { periodMonth, rentalCreated, carparkCreated, skippedExpiring, skippedUnverified };
}
