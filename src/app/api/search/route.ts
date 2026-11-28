import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** GET /api/search?q= — the home page's one search box: units, rooms, and contracts (by contract
 * number, tenant name or phone), best matches first. Boss / Admin see everything; an Agent sees
 * every unit and room but only their own contracts.
 *
 * The tables are small (hundreds of rows), so this matches in memory: that lets a phone number be
 * found however it was typed ("012-345 6789", "0123456789", "+60 12…"). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const q = raw.toLowerCase();
  const digits = raw.replace(/\D/g, "");
  if (q.length < 2) return NextResponse.json({ success: true, q: raw, units: [], rooms: [], contracts: [] });

  const [units, rooms, contracts] = await Promise.all([
    prisma.property.findMany({
      select: { propertyCode: true, name: true, building: { select: { name: true } }, info: { select: { unitNo: true } }, address: true },
    }),
    prisma.room.findMany({ select: { roomCode: true, propertyName: true, status: true, roomType: true, isCarpark: true } }),
    prisma.contract.findMany({
      where: user.role === "AGENT" ? { agentId: user.sub } : {},
      select: { contractCode: true, tenantName: true, contactNumber: true, status: true, expiredDate: true, room: { select: { roomCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Starts-with beats contains, so "PXC" lists PXC before ABC-PXC.
  const score = (...fields: (string | null | undefined)[]) => {
    let best = 0;
    for (const f of fields) {
      const v = (f ?? "").toLowerCase();
      if (!v) continue;
      if (v === q) return 3;
      if (v.startsWith(q)) best = Math.max(best, 2);
      else if (v.includes(q)) best = Math.max(best, 1);
    }
    return best;
  };
  const top = <T,>(rows: { s: number; v: T }[], n: number) =>
    rows
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map((r) => r.v);

  const live = (s: string) => ["ACTIVE", "PENDING_SIGN", "PENDING_APPROVE"].includes(s);
  return NextResponse.json({
    success: true,
    q: raw,
    units: top(
      units.map((u) => ({
        s: score(u.propertyCode, u.name, u.building?.name, u.info?.unitNo, u.address),
        v: { code: u.propertyCode, name: u.name, building: u.building?.name !== u.name ? (u.building?.name ?? null) : null, unitNo: u.info?.unitNo ?? null },
      })),
      5
    ),
    rooms: top(
      rooms.map((r) => ({
        s: score(r.roomCode),
        v: { code: r.roomCode, unitName: r.propertyName, type: r.roomType, isCarpark: r.isCarpark, status: r.status as string },
      })),
      6
    ),
    contracts: top(
      contracts.map((c) => {
        const phone = (c.contactNumber ?? "").replace(/\D/g, "");
        // A phone match needs at least 4 digits typed, so "12" doesn't match every number.
        const phoneHit = digits.length >= 4 && phone.includes(digits.replace(/^60/, "").replace(/^0/, ""));
        // Live tenancies first among equal matches.
        const s = Math.max(score(c.contractCode, c.tenantName, c.room.roomCode), phoneHit ? 2 : 0);
        return {
          s: s ? s + (live(c.status) ? 0.5 : 0) : 0,
          v: { code: c.contractCode, tenantName: c.tenantName, roomCode: c.room.roomCode, status: c.status as string, phone: phoneHit ? c.contactNumber : null },
        };
      }),
      8
    ),
  });
}
