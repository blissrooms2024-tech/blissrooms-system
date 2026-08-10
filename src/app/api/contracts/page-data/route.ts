import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (!["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const where = user.role === "AGENT" ? { agentId: user.sub } : {};

  const [contracts, paidGroups, vacantRooms, agents] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { room: { select: { roomCode: true } } },
    }),
    prisma.payment.groupBy({ by: ["contractId"], _sum: { amountPaid: true } }),
    prisma.room.findMany({ where: { status: "VACANT" }, select: { roomCode: true, propertyName: true } }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { role: "AGENT", status: "ACTIVE" },
          select: { userCode: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const paidMap = new Map(paidGroups.map((g) => [g.contractId, Number(g._sum.amountPaid ?? 0)]));
  const list = contracts.map((c) => {
    const paid = paidMap.get(c.id) ?? 0;
    const outstanding = Math.max(Number(c.totalOutstanding) - paid, 0);
    return serialize({ ...c, _paid: paid, _outstanding: outstanding });
  });

  return NextResponse.json({ success: true, contracts: list, vacant: vacantRooms, agents });
}
