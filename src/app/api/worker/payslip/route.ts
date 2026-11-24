import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Formal monthly payslip for an in-house Worker's paid maintenance jobs — grouped by the
 * month each job was actually paid out (MaintenanceRequest.costPaidAt), same convention as the
 * Agent's commission payslip (grouped by Contract.commPaidAt), since that's the real payout
 * event, not whenever the job happened to be completed. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "WORKER") {
    return NextResponse.json({ success: false, message: "只有维修工人可以看" }, { status: 403 });
  }

  const paidJobs = await prisma.maintenanceRequest.findMany({
    where: { assignedWorkerId: user.sub, costPaidAt: { not: null }, cost: { not: null } },
    select: { requestCode: true, roomCode: true, title: true, cost: true, costPaidAt: true },
    orderBy: { costPaidAt: "desc" },
  });

  const months = [...new Set(paidJobs.map((j) => j.costPaidAt!.toISOString().slice(0, 7)))];

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || months[0] || new Date().toISOString().slice(0, 7);

  const lines = paidJobs
    .filter((j) => j.costPaidAt!.toISOString().slice(0, 7) === month)
    .map((j) => ({
      label: `Maintenance — ${j.title} (Room ${j.roomCode}, ${j.requestCode})`,
      amount: Number(j.cost),
    }));

  const me = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { name: true, userCode: true, ic: true, bankName: true, bankAccountNumber: true },
  });

  return NextResponse.json({
    success: true,
    months,
    month,
    worker: me,
    lines,
  });
}
