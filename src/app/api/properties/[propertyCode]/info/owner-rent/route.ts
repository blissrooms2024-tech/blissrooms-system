import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withActivity } from "@/lib/activity";
import { requireUnitInfoAccess } from "@/lib/unitInfoServer";
import { addMonths, isPeriod, myDay, periodOf } from "@/lib/bills";

/** Mark a month's owner rent as paid. No expense is booked here: the P&L already counts the
 * fixed owner rent for every month of the lease. */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { user, property } = auth;

  const parsed = z.object({ period: z.string().refine(isPeriod) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "月份格式不对" }, { status: 400 });
  const { period } = parsed.data;
  if (period > addMonths(periodOf(myDay()), 1)) {
    return NextResponse.json({ success: false, message: "不能标记太远的未来月份" }, { status: 400 });
  }

  const info = await prisma.propertyInfo.findUnique({ where: { propertyId: property.id }, select: { ownerRentPaidPeriod: true } });
  const newPaid = info?.ownerRentPaidPeriod && info.ownerRentPaidPeriod > period ? info.ownerRentPaidPeriod : period;
  await prisma.propertyInfo.upsert({
    where: { propertyId: property.id },
    create: { propertyId: property.id, ownerRentPaidPeriod: newPaid, updatedBy: user.name },
    update: { ownerRentPaidPeriod: newPaid, updatedBy: user.name },
  });
  return NextResponse.json({ success: true, message: `${property.propertyCode} 屋主租金 ${period} 已标记已付` });
}

export const POST = withActivity(handlePOST);
