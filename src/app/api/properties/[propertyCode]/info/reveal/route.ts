import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/id";
import { pickSecrets, requireUnitInfoAccess } from "@/lib/unitInfoServer";

/** Returns the unit's passwords and records who looked (shown on the unit page). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { user, property } = auth;

  const info = await prisma.propertyInfo.findUnique({ where: { propertyId: property.id } });
  await prisma.log.create({
    data: {
      logCode: await newId("LG"),
      type: "SECRET_VIEW",
      subject: `查看 ${property.propertyCode} 密码`,
      relatedId: property.propertyCode,
      triggeredBy: user.name,
      status: "OK",
    },
  });
  return NextResponse.json({ success: true, secrets: pickSecrets(info as Record<string, unknown> | null) });
}
