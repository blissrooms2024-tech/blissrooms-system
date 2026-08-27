import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const workers = await prisma.user.findMany({
    where: { role: "WORKER", status: "ACTIVE" },
    select: { id: true, userCode: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, workers });
}
