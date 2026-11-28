import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { uploadDataUrl } from "@/lib/storage";
import { requireUnitInfoAccess } from "@/lib/unitInfoServer";
import { withActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ propertyCode: string }> };
const MAX_PHOTOS = 20;

async function handlePOST(req: NextRequest, { params }: Ctx) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { user, property } = auth;

  const parsed = z.object({ dataUrl: z.string().startsWith("data:image/") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "请选一张照片" }, { status: 400 });

  const info = await prisma.propertyInfo.findUnique({ where: { propertyId: property.id }, select: { photos: true } });
  if ((info?.photos.length ?? 0) >= MAX_PHOTOS) {
    return NextResponse.json({ success: false, message: `最多 ${MAX_PHOTOS} 张照片` }, { status: 400 });
  }
  try {
    const url = await uploadDataUrl(parsed.data.dataUrl, `${property.propertyCode}_UNIT_${Date.now()}.jpg`);
    const saved = await prisma.propertyInfo.upsert({
      where: { propertyId: property.id },
      create: { propertyId: property.id, photos: [url], updatedBy: user.name },
      update: { photos: { push: url }, updatedBy: user.name },
      select: { photos: true },
    });
    return NextResponse.json({ success: true, message: "✅ 照片已上传", photos: saved.photos });
  } catch (e) {
    return NextResponse.json({ success: false, message: "上传失败: " + (e as Error).message }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireUnitInfoAccess((await params).propertyCode);
  if (auth instanceof NextResponse) return auth;
  const { property } = auth;

  const parsed = z.object({ url: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "缺少照片" }, { status: 400 });
  const info = await prisma.propertyInfo.findUnique({ where: { propertyId: property.id }, select: { photos: true } });
  const photos = (info?.photos ?? []).filter((p) => p !== parsed.data.url);
  if (info) await prisma.propertyInfo.update({ where: { propertyId: property.id }, data: { photos } });
  return NextResponse.json({ success: true, message: "✅ 照片已删除", photos });
}

export const POST = withActivity(handlePOST);
export const DELETE = withActivity(handleDELETE);
