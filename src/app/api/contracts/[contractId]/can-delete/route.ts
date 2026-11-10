import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** Admin's pre-check before even showing the delete confirmation — tells the UI upfront
 * whether a plain delete will succeed or will need the force-delete (password) path, so the
 * confirm dialog can show the real reason instead of Admin clicking through a delete that's
 * going to fail anyway. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删" }, { status: 403 });
  }

  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const [paymentCount, commissionCount, maintenanceCount, warningCount, moveFormCount] = await Promise.all([
    prisma.payment.count({ where: { contractId: contract.id } }),
    prisma.commission.count({ where: { contractId: contract.id } }),
    prisma.maintenanceRequest.count({ where: { contractId: contract.id } }),
    prisma.warningLetter.count({ where: { contractId: contract.id } }),
    prisma.moveInOutForm.count({ where: { contractId: contract.id } }),
  ]);

  const parts: string[] = [];
  if (paymentCount) parts.push(`${paymentCount}笔收款`);
  if (commissionCount) parts.push(`${commissionCount}笔佣金`);
  if (maintenanceCount) parts.push(`${maintenanceCount}笔报修`);
  if (warningCount) parts.push(`${warningCount}封警告信`);
  if (moveFormCount) parts.push(`${moveFormCount}份Move-in/out表格`);

  return NextResponse.json({
    success: true,
    canDelete: parts.length === 0,
    reason: parts.length > 0 ? `这张合同已经有${parts.join("、")}记录` : null,
  });
}
