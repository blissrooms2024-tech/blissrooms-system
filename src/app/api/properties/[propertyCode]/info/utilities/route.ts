import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUnitInfoAccess } from "@/lib/unitInfoServer";
import { firstIssue, utilitySchema } from "@/lib/unitInfoSchemas";
import { withActivity } from "@/lib/activity";

/** Add a utility bill account (electric / water / sewerage / WiFi …) to a unit. */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const parsed = utilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: firstIssue(parsed.error) }, { status: 400 });
  await prisma.utilityAccount.create({ data: { ...parsed.data, propertyId: auth.property.id } });
  return NextResponse.json({ success: true, message: "✅ 已添加" });
}

export const POST = withActivity(handlePOST);
