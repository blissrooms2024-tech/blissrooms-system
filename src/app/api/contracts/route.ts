import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { newId } from "@/lib/id";
import { serialize } from "@/lib/serialize";
import { ensureTenantAccount } from "@/lib/tenantAccount";
import { contractFormSchema } from "@/lib/schemas/contract";
import { RULES } from "@/lib/config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (!["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const where = user.role === "AGENT" ? { agentId: user.sub } : {};
  const [contracts, paidGroups] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { room: { select: { roomCode: true } } },
    }),
    prisma.payment.groupBy({ by: ["contractId"], _sum: { amountPaid: true } }),
  ]);

  const paidMap = new Map(paidGroups.map((g) => [g.contractId, Number(g._sum.amountPaid ?? 0)]));

  const list = contracts.map((c) => {
    const paid = paidMap.get(c.id) ?? 0;
    const outstanding = Math.max(Number(c.totalOutstanding) - paid, 0);
    return serialize({ ...c, _paid: paid, _outstanding: outstanding });
  });

  return NextResponse.json({ success: true, contracts: list });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "只有 Agent 或 Admin 可建合同" }, { status: 403 });
  }

  const parsed = contractFormSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "房间和租客姓名一定要填" }, { status: 400 });
  }
  const d = parsed.data;

  const room = await prisma.room.findUnique({ where: { roomCode: d.roomCode } });
  if (!room) return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });
  if (room.status !== "VACANT") {
    return NextResponse.json(
      { success: false, message: `这间房不是空房 (${room.status}), 不能开合同` },
      { status: 409 }
    );
  }

  let agentId = user.sub;
  let agentName = user.name;
  if (user.role === "ADMIN" && d.agentId) {
    const a = await prisma.user.findUnique({ where: { userCode: d.agentId } });
    if (a) {
      agentId = a.id;
      agentName = a.name;
    }
  }

  const total =
    d.roomRental + d.securityDeposit + d.utilitiesDeposit + d.accessCardDeposit + d.adminFee + d.carparkRental;

  const now = new Date();
  const autoDeleteAt = new Date(now.getTime() + RULES.DRAFT_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000);

  const tenantId = d.email ? await ensureTenantAccount(d) : null;

  const contract = await prisma.contract.create({
    data: {
      contractCode: await newId("CT"),
      roomId: room.id,
      propertyAddress: room.propertyName,
      tenantId,
      tenantName: d.tenantName,
      tenantIc: d.tenantIc,
      agentId,
      agentName,
      moveInDate: d.moveInDate,
      commencementDate: d.commencementDate,
      expiredDate: d.expiredDate,
      tenureMonths: d.tenureMonths,
      roomRental: d.roomRental,
      carparkRental: d.carparkRental,
      securityDeposit: d.securityDeposit,
      utilitiesDeposit: d.utilitiesDeposit,
      earnestDeposit: d.roomRental,
      accessCardDeposit: d.accessCardDeposit,
      adminFee: d.adminFee,
      totalOutstanding: total,
      status: "DRAFT",
      commStatus: "Pending",
      createdBy: user.name,
      autoDeleteAt,
      remarks: d.remarks,
      nationality: d.nationality,
      contactNumber: d.contactNumber,
      email: d.email,
      occupation: d.occupation,
      company: d.company,
      carPlate: d.carPlate,
      emergencyName: d.emergencyName,
      emergencyContact: d.emergencyContact,
      emergencyRelationship: d.emergencyRelationship,
      utilDryer: d.utilDryer,
      utilAircond: d.utilAircond,
      utilElectric: d.utilElectric,
    },
  });

  await prisma.room.update({
    where: { roomCode: d.roomCode },
    data: { status: "RESERVED", currentContractId: contract.contractCode },
  });

  const utils = [d.utilElectric && "Electric", d.utilAircond && "Aircond", d.utilDryer && "Dryer"].filter(Boolean);
  const utilMsg = utils.length ? ` | 水电: ${utils.join(", ")}` : " | 水电: 无勾选";
  const tenantMsg = tenantId && d.email ? ` | 租客账号: ${d.email}` : "";

  return NextResponse.json({
    success: true,
    message: `✅ 合同已建: ${contract.contractCode} (草稿)${utilMsg}${tenantMsg}`,
    id: contract.contractCode,
  });
}
