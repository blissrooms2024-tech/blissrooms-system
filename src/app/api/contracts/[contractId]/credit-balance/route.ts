import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const schema = z.object({ creditBalance: z.coerce.number().min(0, "请填金额") });

/** Admin-only direct correction of a contract's prepaid credit balance — for whenever the
 * running total (built up/consumed automatically by lump-sum overpayment and auto-settled
 * bills) doesn't match what Admin knows is actually true, the same escape hatch every other
 * amount in the system already has via "改金额". */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以改" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }

  await prisma.contract.update({
    where: { id: c.id },
    data: { creditBalance: parsed.data.creditBalance },
  });

  return NextResponse.json({ success: true, message: "✅ 预收余额已更新" });
}
