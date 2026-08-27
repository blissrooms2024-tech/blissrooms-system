import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { notifyTenantMaintenanceUpdated } from "@/lib/mail";

const schema = z.object({
  status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  assignedTo: z.string().trim().optional(),
  adminNote: z.string().trim().optional(),
  workerType: z.enum(["IN_HOUSE", "OUTSOURCED"]).optional(),
  assignedWorkerId: z.string().trim().optional(),
  invoiceDataUrl: z.string().min(1).optional(),
  cost: z.coerce.number().optional(),
  markCostPaid: z.boolean().optional(),
});

/** Admin-only: move a request through its status flow, assign a worker (in-house account or
 * outsourced contractor name), and record the cost once it's done — either an in-house wage or
 * an outsourced invoice. Every field is independently optional so Admin can e.g. just assign a
 * worker without also changing status, or just record cost when finalizing. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以更新报修单" }, { status: 403 });
  }

  const { requestId } = await params;
  const reqRow = await prisma.maintenanceRequest.findUnique({
    where: { requestCode: requestId },
    include: { contract: { select: { contractCode: true } } },
  });
  if (!reqRow) return NextResponse.json({ success: false, message: "找不到这个报修单" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;

  let invoiceUrl: string | undefined;
  if (d.invoiceDataUrl) {
    try {
      invoiceUrl = await uploadDataUrl(d.invoiceDataUrl, `${reqRow.contractId}_INVOICE_${reqRow.requestCode}_${Date.now()}.jpg`);
    } catch (e) {
      return NextResponse.json(
        { success: false, message: "单据上传失败: " + (e instanceof Error ? e.message : String(e)) },
        { status: 500 }
      );
    }
  }

  await prisma.maintenanceRequest.update({
    where: { requestCode: requestId },
    data: {
      ...(d.status ? { status: d.status, resolvedAt: d.status === "COMPLETED" ? new Date() : reqRow.resolvedAt } : {}),
      ...(d.assignedTo !== undefined ? { assignedTo: d.assignedTo } : {}),
      ...(d.adminNote !== undefined ? { adminNote: d.adminNote } : {}),
      ...(d.workerType !== undefined ? { workerType: d.workerType } : {}),
      ...(d.assignedWorkerId !== undefined ? { assignedWorkerId: d.assignedWorkerId || null } : {}),
      ...(invoiceUrl ? { invoiceUrl } : {}),
      ...(d.cost !== undefined ? { cost: d.cost } : {}),
      ...(d.markCostPaid ? { costPaidAt: new Date() } : {}),
    },
  });

  if (d.status && reqRow.tenantId) {
    const tenant = await prisma.user.findUnique({ where: { id: reqRow.tenantId } });
    if (tenant) {
      await notifyTenantMaintenanceUpdated(
        tenant,
        { requestCode: reqRow.requestCode, contractCode: reqRow.contract.contractCode, roomCode: reqRow.roomCode, title: reqRow.title, status: d.status },
        user.name
      );
    }
  }

  return NextResponse.json({ success: true, message: "✅ 报修单已更新" });
}
