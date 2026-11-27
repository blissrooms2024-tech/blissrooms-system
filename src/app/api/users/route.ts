import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/id";
import { RULES } from "@/lib/config";
import { withActivity } from "@/lib/activity";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可看用户" }, { status: 403 });
  }

  const [users, rooms, contracts] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.room.findMany({ where: { currentTenantId: { not: null } }, select: { roomCode: true, currentTenantId: true } }),
    // Room.currentTenantId only reflects a SIGNED/ACTIVE occupancy — a tenant whose contract is
    // still DRAFT/PENDING_APPROVE/PENDING_SIGN (not signed yet) or whose contract already ended
    // has no room there, which otherwise shows as a bare "-" with no explanation. Falling back
    // to their most recent contract's room (tagged with that contract's status) means Admin
    // always sees SOMETHING for a tenant who has a contract on file, instead of just "-".
    prisma.contract.findMany({
      where: { tenantId: { not: null } },
      select: { tenantId: true, status: true, room: { select: { roomCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const roomCodesByTenant = new Map<string, string[]>();
  for (const r of rooms) {
    if (!r.currentTenantId) continue;
    const list = roomCodesByTenant.get(r.currentTenantId) ?? [];
    list.push(r.roomCode);
    roomCodesByTenant.set(r.currentTenantId, list);
  }

  // One fallback contract per tenant: the most recent ACTIVE one if there is one, otherwise
  // just the most recent contract regardless of status (contracts are already ordered newest
  // first, so the first one seen per tenant wins unless a later-seen one is ACTIVE).
  const fallbackByTenant = new Map<string, { roomCode: string; status: string }>();
  for (const c of contracts) {
    if (!c.tenantId) continue;
    const existing = fallbackByTenant.get(c.tenantId);
    if (!existing || (existing.status !== "ACTIVE" && c.status === "ACTIVE")) {
      fallbackByTenant.set(c.tenantId, { roomCode: c.room.roomCode, status: c.status });
    }
  }

  // Disabled accounts sink to the bottom — Admin cares about who's currently active first, and
  // a long list of already-moved-out tenants would otherwise bury them. Array.sort is stable,
  // so within each group the original createdAt order is kept.
  const sortedUsers = [...users].sort(
    (a, b) => (a.status === "DISABLED" ? 1 : 0) - (b.status === "DISABLED" ? 1 : 0)
  );

  return NextResponse.json({
    success: true,
    users: sortedUsers.map((u) => {
      const liveRoomCode = roomCodesByTenant.get(u.id)?.join(", ") || null;
      const fallback = liveRoomCode ? null : fallbackByTenant.get(u.id) ?? null;
      // A DISABLED tenant's contract sometimes never actually got flipped to MOVED_OUT (e.g. the
      // old auto-disable-on-expiry cron only ever touched the account, never the contract) —
      // showing the raw "ACTIVE" status next to a disabled account reads as a contradiction, so
      // treat it as moved out for display purposes here regardless of the stored enum value.
      const displayStatus = fallback && u.status === "DISABLED" && fallback.status === "ACTIVE" ? "MOVED_OUT" : fallback?.status ?? null;
      return {
        userCode: u.userCode,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        status: u.status,
        verified: u.verified,
        roomCode: liveRoomCode ?? fallback?.roomCode ?? null,
        // Only set when the room code above isn't a live occupancy — tells the frontend to
        // show it as "roomCode (status)" instead of a plain live unit.
        roomContractStatus: displayStatus,
      };
    }),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["BOSS", "ADMIN", "AGENT", "TENANT", "WORKER"]),
  phone: z.string().trim().optional().default(""),
  ic: z.string().trim().optional().default(""),
  password: z.string().trim().optional().default("1234"),
  commRate: z.coerce.number().optional(),
  bankName: z.string().trim().optional().default(""),
  bankAccountName: z.string().trim().optional().default(""),
  bankAccountNumber: z.string().trim().optional().default(""),
});

async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可建用户" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "姓名/Email/角色一定要填" }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) {
    return NextResponse.json({ success: false, message: "这个 Email 已经有人用了" }, { status: 409 });
  }

  const pw = d.password || "1234";
  await prisma.user.create({
    data: {
      userCode: await newId("U"),
      name: d.name,
      email: d.email,
      passwordHash: await hashPassword(pw),
      role: d.role,
      phone: d.phone,
      ic: d.ic,
      commRate: d.role === "AGENT" ? d.commRate || RULES.DEFAULT_COMM_RATE : null,
      bankName: d.bankName || null,
      bankAccountName: d.bankAccountName || null,
      bankAccountNumber: d.bankAccountNumber || null,
      status: "ACTIVE",
    },
  });

  return NextResponse.json({ success: true, message: `✅ 用户已建: ${d.name} (密码: ${pw})` });
}

export const POST = withActivity(handlePOST);
