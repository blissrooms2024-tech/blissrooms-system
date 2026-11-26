import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUnitInfoAccess } from "@/lib/unitInfoServer";
import { firstIssue, utilitySchema } from "@/lib/unitInfoSchemas";

type Ctx = { params: Promise<{ propertyCode: string; utilityId: string }> };

async function load(ctx: Ctx) {
  const { propertyCode, utilityId } = await ctx.params;
  const auth = await requireUnitInfoAccess(propertyCode);
  if (auth instanceof NextResponse) return auth;
  const acc = await prisma.utilityAccount.findUnique({ where: { id: utilityId } });
  if (!acc || acc.propertyId !== auth.property.id) {
    return NextResponse.json({ success: false, message: "找不到这个账户" }, { status: 404 });
  }
  return { ...auth, acc };
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const r = await load(ctx);
  if (r instanceof NextResponse) return r;
  const parsed = utilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 });
  await prisma.utilityAccount.update({ where: { id: r.acc.id }, data: parsed.data });
  return NextResponse.json({ success: true, message: "✅ 已更新" });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await load(ctx);
  if (r instanceof NextResponse) return r;
  await prisma.utilityAccount.delete({ where: { id: r.acc.id } });
  return NextResponse.json({ success: true, message: "✅ 已删除" });
}
