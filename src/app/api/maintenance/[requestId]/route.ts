import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";
import { newId } from "@/lib/id";
import { notifyTenantMaintenanceUpdated, notifyTenantMaintenanceNoteAdded } from "@/lib/mail";

const schema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
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
    include: { contract: { select: { contractCode: true, room: { select: { propertyId: true } } } } },
  });
  if (!reqRow) return NextResponse.json({ success: false, message: "找不到这个报修单" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;

  // Once a job's cost has actually been paid out, the Expense it booked is already fixed in
  // the books — silently changing the figure here would leave that Expense wrong with no
  // trace. Correcting a mistake at that point means editing the Expense directly, not this.
  if (d.cost !== undefined && reqRow.costPaidAt) {
    return NextResponse.json({ success: false, message: "已经出过钱了, 不能再改费用 (会跟已登记的支出对不上)" }, { status: 409 });
  }

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
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
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

  // Paying a maintenance job out (in-house wage or outsourced invoice) is real money leaving
  // the company — book it as an actual MAINTENANCE Expense the moment it's first marked paid,
  // same principle as the voucher-redemption Expense: a cost only ever recorded on the request
  // itself (never here) would make the property's finance report silently understate what the
  // company actually spent. Only fires once (reqRow.costPaidAt is still null the first time).
  let expenseWarning = "";
  if (d.markCostPaid && !reqRow.costPaidAt) {
    const finalCost = d.cost ?? (reqRow.cost ? Number(reqRow.cost) : null);
    const propertyId = reqRow.contract.room.propertyId;
    if (finalCost && finalCost > 0 && propertyId) {
      const workerType = d.workerType ?? reqRow.workerType;
      const assignedTo = d.assignedTo !== undefined ? d.assignedTo : reqRow.assignedTo;
      const now = new Date();
      await prisma.expense.create({
        data: {
          expenseCode: await newId("EX"),
          propertyId,
          category: "MAINTENANCE",
          customLabel: reqRow.title,
          amount: finalCost,
          periodMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
          expenseDate: now,
          notes: `报修单 ${reqRow.requestCode} (${reqRow.roomCode}) — ${workerType === "OUTSOURCED" ? "外包" : "员工"}: ${assignedTo ?? "-"}`,
          recordedBy: user.name,
        },
      });
    } else if (finalCost && finalCost > 0 && !propertyId) {
      expenseWarning = " | ⚠️ 这间房没有关联楼盘，没有登记支出";
    }
  }

  if (reqRow.tenantId && (d.status || (d.adminNote !== undefined && d.adminNote && d.adminNote !== reqRow.adminNote))) {
    const tenant = await prisma.user.findUnique({ where: { id: reqRow.tenantId } });
    if (tenant) {
      const info = { requestCode: reqRow.requestCode, contractCode: reqRow.contract.contractCode, roomCode: reqRow.roomCode, title: reqRow.title, status: d.status ?? reqRow.status };
      if (d.status) {
        await notifyTenantMaintenanceUpdated(tenant, info, user.name);
      } else {
        await notifyTenantMaintenanceNoteAdded(tenant, info, d.adminNote!, user.name);
      }
    }
  }

  return NextResponse.json({ success: true, message: `✅ 报修单已更新${expenseWarning}` });
}

/** Admin-only: remove a maintenance request outright (e.g. a duplicate or test entry). If the
 * job's cost was already paid out, the Expense it booked is left untouched — same convention
 * as deleting a Payment record elsewhere in the app, which never un-books anything either. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除报修单" }, { status: 403 });
  }

  const { requestId } = await params;
  const reqRow = await prisma.maintenanceRequest.findUnique({ where: { requestCode: requestId } });
  if (!reqRow) return NextResponse.json({ success: false, message: "找不到这个报修单" }, { status: 404 });

  await prisma.maintenanceRequest.delete({ where: { requestCode: requestId } });

  return NextResponse.json({ success: true, message: `✅ 报修单 ${requestId} 已删除` });
}
