import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUnitInfoAccess, resolveRoom } from "@/lib/unitInfoServer";
import { cardSchema, firstIssue } from "@/lib/unitInfoSchemas";
import { withActivity } from "@/lib/activity";

/** Add an access card / key / remote to a unit. */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { property } = auth;

  const parsed = cardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 });
  const { roomCode, ...d } = parsed.data;

  const roomId = await resolveRoom(property.id, d.holder, roomCode);
  if (roomId instanceof NextResponse) return roomId;

  await prisma.accessCard.create({ data: { ...d, propertyId: property.id, roomId } });
  return NextResponse.json({ success: true, message: "✅ 已添加" });
}

export const POST = withActivity(handlePOST);
