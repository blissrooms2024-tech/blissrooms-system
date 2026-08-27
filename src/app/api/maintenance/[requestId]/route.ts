import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyTenantMaintenanceUpdated } from "@/lib/mail";

const schema = z.object({
  status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  assignedTo: z.string().trim().optional(),
  adminNote: z.string().trim().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以更新报修状态" }, { status: 403 });
  }

  const { requestId } = await params;
  const reqRow = await prisma.maintenanceRequest.findUnique({
    where: { requestCode: requestId },
    include: { contract: { select: { contractCode: true } } },
  });
  if (!reqRow) return NextResponse.json({ success: false, message: "找不到这个报修单" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请选状态" }, { status: 400 });
  }
  const d = parsed.data;

  await prisma.maintenanceRequest.update({
    where: { requestCode: requestId },
    data: {
      status: d.status,
      assignedTo: d.assignedTo,
      adminNote: d.adminNote,
      resolvedAt: d.status === "COMPLETED" ? new Date() : reqRow.resolvedAt,
    },
  });

  if (reqRow.tenantId) {
    const tenant = await prisma.user.findUnique({ where: { id: reqRow.tenantId } });
    if (tenant) {
      await notifyTenantMaintenanceUpdated(
        tenant,
        { requestCode: reqRow.requestCode, contractCode: reqRow.contract.contractCode, roomCode: reqRow.roomCode, title: reqRow.title, status: d.status },
        user.name
      );
    }
  }

  return NextResponse.json({ success: true, message: "✅ 报修状态已更新" });
}
