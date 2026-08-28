import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyAdminsMaintenanceWorkerSubmitted } from "@/lib/mail";

/** Worker marks their own IN_PROGRESS job as done — moves it to PENDING_REVIEW so Admin knows
 * to check the after-photos and close it out with a cost. Requires at least one after-photo,
 * matching the "最少1张" hint already shown on the upload slot. */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "WORKER") {
    return NextResponse.json({ success: false, message: "只有维修工人可以提交" }, { status: 403 });
  }
  const { requestId } = await params;
  const reqRow = await prisma.maintenanceRequest.findUnique({
    where: { requestCode: requestId },
    include: { contract: { select: { contractCode: true } } },
  });
  if (!reqRow) return NextResponse.json({ success: false, message: "找不到这个报修单" }, { status: 404 });
  if (reqRow.assignedWorkerId !== user.sub) {
    return NextResponse.json({ success: false, message: "这个报修单不是指派给你的" }, { status: 403 });
  }
  if (reqRow.status !== "IN_PROGRESS") {
    return NextResponse.json({ success: false, message: "只有处理中的任务才能提交" }, { status: 400 });
  }
  const afterPhotos = Array.isArray(reqRow.workerAfterPhotos) ? (reqRow.workerAfterPhotos as string[]) : [];
  if (afterPhotos.length === 0) {
    return NextResponse.json({ success: false, message: "请至少传1张完工后的照片" }, { status: 400 });
  }

  await prisma.maintenanceRequest.update({
    where: { requestCode: requestId },
    data: { status: "PENDING_REVIEW" },
  });

  await notifyAdminsMaintenanceWorkerSubmitted(
    { requestCode: reqRow.requestCode, contractCode: reqRow.contract.contractCode, roomCode: reqRow.roomCode, title: reqRow.title, status: "PENDING_REVIEW" },
    user.name,
    user.name
  );

  return NextResponse.json({ success: true, message: "✅ 已提交，等待 Admin 确认" });
}
