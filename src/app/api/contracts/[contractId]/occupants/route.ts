import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";

const schema = z.object({ occupants: z.coerce.number().int().min(1).max(10) });

/** POST /api/contracts/CT-0012/occupants — how many people live in the room (Admin). Used when a
 * unit's shared usage is split by headcount. */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以改" }, { status: 403 });
  const { contractId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "人数要是 1 到 10" }, { status: 400 });
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId }, select: { id: true, tenantName: true } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  await prisma.contract.update({ where: { id: c.id }, data: { occupants: parsed.data.occupants } });
  return NextResponse.json({ success: true, message: `${contractId} ${c.tenantName} 入住人数改为 ${parsed.data.occupants} 人` });
}

export const POST = withActivity(handlePOST);
