import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import type { MoveType } from "@/generated/prisma/enums";

const schema = z.object({ type: z.enum(["MoveIn", "MoveOut"]) });

/** Admin reopens a tenant-submitted Move-in/Move-out form for editing. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以重新开放" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const type: MoveType = parsed.data.type === "MoveOut" ? "MOVE_OUT" : "MOVE_IN";

  const forms = await prisma.moveInOutForm.findMany({
    where: { contractId: c.id, type },
    orderBy: { id: "asc" },
  });
  const latest = forms.length ? forms[forms.length - 1] : null;
  if (!latest) return NextResponse.json({ success: false, message: "还没有表单可以开放" }, { status: 404 });

  await prisma.moveInOutForm.update({ where: { id: latest.id }, data: { locked: false } });

  return NextResponse.json({ success: true, message: "✅ 已允许租客重新修改这张表单" });
}
