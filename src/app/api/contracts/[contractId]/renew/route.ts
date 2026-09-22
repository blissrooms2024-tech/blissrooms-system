import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { notifyTenantBillCreated } from "@/lib/mail";
import { FEES } from "@/lib/config";

const schema = z.object({
  newExpiredDate: z.string().trim().min(1, "请选新的到期日"),
});

/** Admin processes a lease renewal: pushes the contract's expiredDate out and opens a flat
 * RM200 admin/renewal fee bill (per the contract's own terms — same PENDING-bill-then-tenant-
 * uploads-proof flow as any other charge, not auto-marked paid). Tenants don't self-serve this
 * — the contract explicitly reserves Admin's right to decline a renewal, so the tenant's only
 * path is to contact Admin directly, who then comes here. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以处理续约" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, tenant: true },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (c.status !== "ACTIVE") {
    return NextResponse.json({ success: false, message: "只能续约生效中的合同" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }
  const newExpiredDate = new Date(parsed.data.newExpiredDate);
  if (isNaN(newExpiredDate.getTime())) {
    return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
  }
  if (c.expiredDate && newExpiredDate <= c.expiredDate) {
    return NextResponse.json({ success: false, message: "新的到期日要比现在的到期日晚" }, { status: 400 });
  }

  const paymentCode = await newId("PY");
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  await prisma.$transaction([
    prisma.contract.update({ where: { id: c.id }, data: { expiredDate: newExpiredDate } }),
    prisma.payment.create({
      data: {
        paymentCode,
        contractId: c.id,
        roomCode: c.room.roomCode,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        type: "ADMIN_FEE",
        amountDue: FEES.RENEWAL,
        amountPaid: 0,
        dueDate,
        status: "PENDING",
        recordedBy: user.name,
        notes: "续约行政费",
      },
    }),
  ]);

  if (c.tenant) {
    await notifyTenantBillCreated(
      c.tenant,
      {
        paymentCode,
        contractCode: c.contractCode,
        roomCode: c.room.roomCode,
        type: "ADMIN_FEE",
        amountDue: FEES.RENEWAL,
        amountPaid: 0,
        dueDate: dueDate.toISOString(),
      },
      user.name
    );
  }

  return NextResponse.json({
    success: true,
    message: `✅ 已续约到 ${newExpiredDate.toLocaleDateString("en-GB")}, 并开了 RM${FEES.RENEWAL} 续约行政费账单`,
  });
}
