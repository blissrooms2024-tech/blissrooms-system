import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { notifyTenantBillCreated } from "@/lib/mail";

/** Recurring/utility-style charges only — DEPOSIT/ADMIN_FEE/ACCESS_CARD/RENTAL are per-contract
 * move-in terms, not something you'd blast out to a whole unit at once. */
const BULK_BILL_TYPES = ["UTILITIES", "AC", "DRYER", "ELECTRIC", "OTHER"] as const;

const schema = z
  .object({
    type: z.enum(BULK_BILL_TYPES),
    amount: z.coerce.number().positive(),
    dueDate: z.string().trim().min(1),
    periodMonth: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
    customLabel: z.string().trim().optional().default(""),
    contractCodes: z.array(z.string().trim().min(1)).min(1),
  })
  .refine((d) => d.type !== "OTHER" || d.customLabel, { message: "「其他」类型要填费用名称" });

/** Admin opens the same bill (same type/amount) for every selected tenant in a unit at once —
 * e.g. splitting a property's electricity bill evenly across all occupied rooms. Each tenant
 * still goes through the normal upload-slip → Admin-review flow individually afterward. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以开账单" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "资料格式不对";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
  const d = parsed.data;

  const contracts = await prisma.contract.findMany({
    where: { contractCode: { in: d.contractCodes } },
    include: { room: true, tenant: true },
  });

  let created = 0;
  for (const c of contracts) {
    const paymentCode = await newId("PY");
    await prisma.payment.create({
      data: {
        paymentCode,
        contractId: c.id,
        roomCode: c.room.roomCode,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        periodMonth: d.periodMonth,
        type: d.type,
        amountDue: d.amount,
        amountPaid: 0,
        dueDate: new Date(d.dueDate),
        status: "PENDING",
        recordedBy: user.name,
        notes: d.notes,
        customLabel: d.type === "OTHER" ? d.customLabel : null,
      },
    });
    created++;

    if (c.tenant) {
      await notifyTenantBillCreated(
        c.tenant,
        {
          paymentCode,
          contractCode: c.contractCode,
          roomCode: c.room.roomCode,
          type: d.type,
          amountDue: d.amount,
          amountPaid: 0,
          dueDate: d.dueDate,
          periodMonth: d.periodMonth,
        },
        user.name
      );
    }
  }

  return NextResponse.json({ success: true, message: `✅ 已给 ${created} 位租客开账单，每人 RM${d.amount}` });
}
