import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";

/** Admin manually ends a contract because the tenant moved out early (for whatever reason,
 * well before expiredDate) — sets it MOVED_OUT and frees the room immediately, same as
 * terminate-arrears but without the rent-arrears precondition or deposit forfeiture note,
 * since this isn't a punitive termination. Also disables the tenant's own login, the same way
 * the daily lease-expiry check does — but only if they're a pure Tenant (not an Agent who
 * happens to be the tenant on their own contract) with no other ACTIVE contract elsewhere. */
async function handlePOST(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以处理搬出" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, carparkRoom: true, tenant: true },
  });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (contract.status !== "ACTIVE") {
    return NextResponse.json({ success: false, message: "只能处理生效中的合同" }, { status: 409 });
  }

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: { status: "MOVED_OUT" },
  });

  if (contract.room.currentContractId === contract.contractCode) {
    await prisma.room.update({
      where: { id: contract.roomId },
      data: { status: "VACANT", currentContractId: null, currentTenantId: null },
    });
  }
  if (contract.carparkRoom && contract.carparkRoom.currentContractId === contract.contractCode) {
    await prisma.room.update({
      where: { id: contract.carparkRoom.id },
      data: { status: "VACANT", currentContractId: null, currentTenantId: null },
    });
  }

  let tenantDisabled = false;
  if (contract.tenant && contract.tenant.role === "TENANT" && contract.tenant.status === "ACTIVE") {
    const otherActiveContracts = await prisma.contract.count({
      where: { tenantId: contract.tenant.id, status: "ACTIVE", NOT: { id: contract.id } },
    });
    if (otherActiveContracts === 0) {
      await prisma.user.update({ where: { id: contract.tenant.id }, data: { status: "DISABLED" } });
      tenantDisabled = true;
    }
  }

  return NextResponse.json({
    success: true,
    message: `✅ 合同已标记搬出, 房间已放回空房${tenantDisabled ? ", 租客账号已停用" : ""}`,
  });
}

export const POST = withActivity(handlePOST);
