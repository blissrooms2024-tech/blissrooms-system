import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { myDay } from "@/lib/bills";

const PAGE = 50;
const DAY_MS = 24 * 3600 * 1000;
const MY_OFFSET_MS = 8 * 3600 * 1000;

/** GET /api/activity?range=today|7d|30d|all&userId=&q=&cursor= — Boss/Admin only. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const range = sp.get("range") ?? "7d";
  const days = range === "today" ? 1 : range === "30d" ? 30 : range === "all" ? null : 7;
  // Midnight Malaysia time, as an instant.
  const since = days ? new Date(myDay().getTime() - MY_OFFSET_MS - (days - 1) * DAY_MS) : null;
  const q = (sp.get("q") ?? "").trim().slice(0, 60);
  const userId = sp.get("userId") || null;
  const cursor = sp.get("cursor") || null;

  const where: Prisma.ActivityLogWhereInput = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(userId ? { userId } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" } },
            { target: { contains: q, mode: "insensitive" } },
            { area: { contains: q, mode: "insensitive" } },
            { userName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, people] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    cursor ? Promise.resolve(null) : prisma.activityLog.groupBy({ by: ["userId", "userName"], _count: { _all: true }, orderBy: { userName: "asc" } }),
  ]);

  const hasMore = rows.length > PAGE;
  const items = rows.slice(0, PAGE).map((a) => ({
    id: a.id,
    at: a.createdAt.toISOString(),
    userName: a.userName,
    role: a.role,
    method: a.method,
    area: a.area,
    target: a.target,
    summary: a.summary,
  }));
  return NextResponse.json({
    success: true,
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    people: people?.filter((p) => p.userId).map((p) => ({ userId: p.userId!, userName: p.userName, count: p._count._all })) ?? null,
  });
}
