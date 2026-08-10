import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Vercel Cron hits this daily. Deletes DRAFT contracts whose autoDeleteAt has passed
 * (3 days after creation, per RULES.DRAFT_AUTO_DELETE_DAYS) and frees the room back to VACANT. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const expired = await prisma.contract.findMany({
    where: { status: "DRAFT", autoDeleteAt: { lt: new Date() } },
    include: { room: true },
  });

  let deleted = 0;
  for (const c of expired) {
    if (c.room.currentContractId === c.contractCode && c.room.status !== "OCCUPIED") {
      await prisma.room.update({ where: { id: c.roomId }, data: { status: "VACANT", currentContractId: null } });
    }
    try {
      await prisma.contract.delete({ where: { id: c.id } });
      deleted++;
    } catch {
      // has related payments/etc — skip rather than orphaning data
    }
  }

  return NextResponse.json({ success: true, deleted });
}
