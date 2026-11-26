import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { notifyTenantBillCreated } from "@/lib/mail";
import { FEES, COMPANY, COMPANY_AUTO_SIGNATURE } from "@/lib/config";

const schema = z.object({
  commencementDate: z.string().trim().min(1, "请选新合同的生效日期"),
  newExpiredDate: z.string().trim().min(1, "请选新的到期日"),
  roomRental: z.coerce.number().min(0),
  carparkRental: z.coerce.number().min(0).default(0),
});

/** Admin processes a lease renewal by opening a FRESH contract — the tenant needs to see and
 * agree to the new terms (rent may have changed) and sign again, same as any new contract, not
 * just a quietly-extended expiry date. Deposits already paid under the old contract carry over
 * (recorded as already-Paid payments on the new one, so its own "还欠" never re-asks for them)
 * and a RM200 renewal admin fee bill is opened on the new contract. The old contract stays
 * ACTIVE until the new one is actually signed (see the sign endpoint), so nothing changes for
 * the tenant mid-process if the renewal is abandoned before signing. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以处理续约" }, { status: 403 });
  }
  const { contractId } = await params;
  const c = await prisma.contract.findUnique({
    where: { contractCode: contractId },
    include: { room: true, carparkRoom: true, tenant: true },
  });
  if (!c) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  if (c.status !== "ACTIVE") {
    return NextResponse.json({ success: false, message: "只能续约生效中的合同" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  }
  const d = parsed.data;
  const commencementDate = new Date(d.commencementDate);
  const newExpiredDate = new Date(d.newExpiredDate);
  if (isNaN(commencementDate.getTime()) || isNaN(newExpiredDate.getTime())) {
    return NextResponse.json({ success: false, message: "日期格式不对" }, { status: 400 });
  }
  if (newExpiredDate <= commencementDate) {
    return NextResponse.json({ success: false, message: "新的到期日要比新合同的生效日期晚" }, { status: 400 });
  }

  // If the room (or its carpark) had already been auto-vacated by the daily expiry check
  // (vacateExpiredContractRooms) before Admin got to processing this renewal, re-occupy it under
  // the OLD contract — it's still ACTIVE and the tenant hasn't signed the new one yet.
  await prisma.room.updateMany({
    where: { id: c.roomId, currentContractId: null },
    data: { status: "OCCUPIED", currentContractId: c.contractCode, currentTenantId: c.tenantId },
  });
  if (c.carparkRoomId) {
    await prisma.room.updateMany({
      where: { id: c.carparkRoomId, currentContractId: null },
      data: { status: "OCCUPIED", currentContractId: c.contractCode, currentTenantId: c.tenantId },
    });
  }

  const securityDeposit = Number(c.securityDeposit);
  const utilitiesDeposit = Number(c.utilitiesDeposit);
  const accessCardDeposit = Number(c.accessCardDeposit);
  const totalOutstanding = d.roomRental + d.carparkRental + securityDeposit + utilitiesDeposit + accessCardDeposit + FEES.RENEWAL;

  const months = Math.max(
    Math.round((newExpiredDate.getTime() - commencementDate.getTime()) / (30.44 * 24 * 3600 * 1000)),
    1
  );

  // Every renewal is company-signed, with no commission — Admin processes renewals directly
  // (not the original referring Agent, who already earned their commission on the first
  // signing), so unlike a brand-new contract this is unconditional, regardless of who the
  // Agent on the old contract was. The new contract's agentName becomes the company's own
  // name and its "Agent signed" step is auto-completed right here, same as a fresh
  // company-agent contract going through /approve.
  const isCompanyAgent = true;

  const newContractCode = await newId("CT");
  const newContract = await prisma.contract.create({
    data: {
      contractCode: newContractCode,
      roomId: c.roomId,
      carparkRoomId: c.carparkRoomId,
      propertyAddress: c.propertyAddress,
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      tenantIc: c.tenantIc,
      agentId: c.agentId,
      agentName: isCompanyAgent ? COMPANY.NAME : c.agentName,
      ...(isCompanyAgent ? { agentSignature: COMPANY_AUTO_SIGNATURE, agentSignDate: new Date() } : {}),
      moveInDate: c.moveInDate,
      commencementDate,
      expiredDate: newExpiredDate,
      tenureMonths: months,
      roomRental: d.roomRental,
      carparkRental: d.carparkRental,
      securityDeposit,
      utilitiesDeposit,
      earnestDeposit: d.roomRental,
      accessCardDeposit,
      adminFee: FEES.RENEWAL,
      totalOutstanding,
      status: "PENDING_SIGN",
      commStatus: "Pending",
      createdBy: user.name,
      approvedBy: user.name,
      approvedAt: new Date(),
      // IC doesn't change at renewal — carried over so the tenant can sign straight away
      // instead of being blocked on re-uploading it (the sign endpoint requires it on file).
      icFront: c.icFront,
      icBack: c.icBack,
      remarks: c.remarks,
      nationality: c.nationality,
      contactNumber: c.contactNumber,
      email: c.email,
      occupation: c.occupation,
      company: c.company,
      carPlate: c.carPlate,
      emergencyName: c.emergencyName,
      emergencyContact: c.emergencyContact,
      emergencyRelationship: c.emergencyRelationship,
      utilDryer: c.utilDryer,
      utilAircond: c.utilAircond,
      utilElectric: c.utilElectric,
      renewedFromContractId: c.contractCode,
    },
  });

  const carryOverDeposits = [
    { type: "DEPOSIT" as const, amount: securityDeposit },
    { type: "UTILITIES" as const, amount: utilitiesDeposit },
    { type: "ACCESS_CARD" as const, amount: accessCardDeposit },
  ].filter((x) => x.amount > 0);

  for (const dep of carryOverDeposits) {
    await prisma.payment.create({
      data: {
        paymentCode: await newId("PY"),
        contractId: newContract.id,
        roomCode: c.room.roomCode,
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        type: dep.type,
        amountDue: dep.amount,
        amountPaid: dep.amount,
        status: "Paid",
        paidDate: new Date(),
        method: "续约带过来 Carried Over",
        recordedBy: user.name,
        notes: `续约带过来 (原合同 ${c.contractCode})`,
      },
    });
  }

  const adminFeeDueDate = new Date();
  adminFeeDueDate.setDate(adminFeeDueDate.getDate() + 7);
  const adminFeePaymentCode = await newId("PY");
  await prisma.payment.create({
    data: {
      paymentCode: adminFeePaymentCode,
      contractId: newContract.id,
      roomCode: c.room.roomCode,
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      type: "ADMIN_FEE",
      amountDue: FEES.RENEWAL,
      amountPaid: 0,
      dueDate: adminFeeDueDate,
      status: "PENDING",
      recordedBy: user.name,
      notes: "续约行政费",
    },
  });

  if (c.tenant) {
    await notifyTenantBillCreated(
      c.tenant,
      {
        paymentCode: adminFeePaymentCode,
        contractCode: newContractCode,
        roomCode: c.room.roomCode,
        type: "ADMIN_FEE",
        amountDue: FEES.RENEWAL,
        amountPaid: 0,
        dueDate: adminFeeDueDate.toISOString(),
      },
      user.name
    );
  }

  await prisma.contract.update({
    where: { id: c.id },
    data: { renewalRequestedAt: null, renewalRequestedMonths: null },
  });

  return NextResponse.json({
    success: true,
    message: `✅ 续约新合同已建: ${newContractCode} (${isCompanyAgent ? "Agent 是公司本身, 已自动完成, 等租客签名" : "等 Agent 和租客签名"})。押金已经带过去, 并开了 RM${FEES.RENEWAL.toFixed(2)} 续约行政费账单。`,
    newContractCode,
  });
}
