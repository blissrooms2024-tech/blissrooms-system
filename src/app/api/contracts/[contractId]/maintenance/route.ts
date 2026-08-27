import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { newId } from "@/lib/id";
import { uploadDataUrl } from "@/lib/storage";
import { notifyAdminsMaintenanceSubmitted } from "@/lib/mail";

function canView(user: SessionPayload, contract: { agentId: string; tenantId: string | null }) {
  if (user.role === "BOSS" || user.role === "ADMIN") return true;
  if (user.role === "AGENT" && contract.agentId === user.sub) return true;
  if (user.role === "TENANT" && contract.tenantId === user.sub) return true;
  return false;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (!canView(user, c)) {
    return NextResponse.json({ success: false, message: "没有权限查看这张合同" }, { status: 403 });
  }

  const requests = await prisma.maintenanceRequest.findMany({
    where: { contractId: c.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, requests: serialize(requests) });
}

const createSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  photos: z.array(z.string().min(1)).max(5).optional().default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TENANT") {
    return NextResponse.json({ success: false, message: "只有租客本人可以提交报修" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (c.tenantId !== user.sub) {
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以提交报修" }, { status: 403 });
  }
  if (c.status !== "ACTIVE") {
    return NextResponse.json({ success: false, message: "合同不是生效状态, 不能报修" }, { status: 409 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请填标题" }, { status: 400 });
  }
  const d = parsed.data;

  const room = await prisma.room.findUnique({ where: { id: c.roomId } });
  const requestCode = await newId("MR");

  let photoUrls: string[] = [];
  try {
    photoUrls = await Promise.all(
      d.photos.map((dataUrl, i) => uploadDataUrl(dataUrl, `${contractId}_MAINT_${requestCode}_${i}_${Date.now()}.jpg`))
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "图片上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }

  await prisma.maintenanceRequest.create({
    data: {
      requestCode,
      contractId: c.id,
      roomCode: room?.roomCode ?? "",
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      title: d.title,
      description: d.description,
      photos: photoUrls,
    },
  });

  await notifyAdminsMaintenanceSubmitted(
    { requestCode, contractCode: contractId, roomCode: room?.roomCode ?? "", title: d.title, status: "SUBMITTED" },
    c.tenantName,
    user.name
  );

  return NextResponse.json({ success: true, message: "✅ 报修已提交，Admin 会尽快处理" });
}
