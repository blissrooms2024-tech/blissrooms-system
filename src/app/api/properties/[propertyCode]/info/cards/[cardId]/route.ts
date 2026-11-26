import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUnitInfoAccess, resolveRoom } from "@/lib/unitInfoServer";
import { cardSchema, firstIssue } from "@/lib/unitInfoSchemas";
import { withActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ propertyCode: string; cardId: string }> };

async function load(ctx: Ctx) {
  const { propertyCode, cardId } = await ctx.params;
  const auth = await requireUnitInfoAccess(propertyCode);
  if (auth instanceof NextResponse) return auth;
  const card = await prisma.accessCard.findUnique({ where: { id: cardId } });
  if (!card || card.propertyId !== auth.property.id) {
    return NextResponse.json({ success: false, message: "找不到这张卡" }, { status: 404 });
  }
  return { ...auth, card };
}

async function handlePUT(req: NextRequest, ctx: Ctx) {
  const r = await load(ctx);
  if (r instanceof NextResponse) return r;
  const parsed = cardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 });
  const { roomCode, ...d } = parsed.data;
  const roomId = await resolveRoom(r.property.id, d.holder, roomCode);
  if (roomId instanceof NextResponse) return roomId;
  await prisma.accessCard.update({ where: { id: r.card.id }, data: { ...d, roomId } });
  return NextResponse.json({ success: true, message: "✅ 已更新" });
}

async function handleDELETE(_req: NextRequest, ctx: Ctx) {
  const r = await load(ctx);
  if (r instanceof NextResponse) return r;
  await prisma.accessCard.delete({ where: { id: r.card.id } });
  return NextResponse.json({ success: true, message: "✅ 已删除" });
}

export const PUT = withActivity(handlePUT);
export const DELETE = withActivity(handleDELETE);
