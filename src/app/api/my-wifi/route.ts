import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/** WiFi name/password for the unit(s) the logged-in tenant currently lives in. Only the WiFi
 * fields are ever returned here — never the other unit passwords. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const contracts = await prisma.contract.findMany({
    where: { tenantId: user.sub, status: { in: ["ACTIVE", "EXPIRING"] } },
    select: {
      room: {
        select: {
          roomCode: true,
          property: {
            select: { propertyCode: true, name: true, info: { select: { wifiName: true, wifiPassword: true } } },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const wifi: { propertyName: string; roomCode: string; wifiName: string | null; wifiPassword: string | null }[] = [];
  for (const c of contracts) {
    const p = c.room.property;
    if (!p || seen.has(p.propertyCode)) continue;
    const info = p.info;
    if (!info?.wifiName && !info?.wifiPassword) continue;
    seen.add(p.propertyCode);
    wifi.push({ propertyName: p.name, roomCode: c.room.roomCode, wifiName: info.wifiName, wifiPassword: info.wifiPassword });
  }
  return NextResponse.json({ success: true, wifi });
}
