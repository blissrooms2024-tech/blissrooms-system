import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionPayload } from "@/lib/auth/session";
import { INFO_FIELDS, SECRET_KEYS } from "@/lib/unitInfo";

/** Unit info is Boss/Admin only (Agents can see the unit page but not passwords/accounts). */
export async function requireUnitInfoAccess(
  propertyCode: string
): Promise<{ user: SessionPayload; property: { id: string; propertyCode: string; name: string } } | NextResponse> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以看单位资料" }, { status: 403 });
  }
  const property = await prisma.property.findUnique({
    where: { propertyCode },
    select: { id: true, propertyCode: true, name: true },
  });
  if (!property) return NextResponse.json({ success: false, message: "找不到这个单位" }, { status: 404 });
  return { user, property };
}

type Raw = Record<string, unknown>;

/** Turns a PropertyInfo row into JSON with passwords replaced by "is it filled in?" flags. */
export function maskInfo(info: Raw | null): { values: Record<string, string | number | null>; secretsSet: Record<string, boolean> } {
  const values: Record<string, string | number | null> = {};
  const secretsSet: Record<string, boolean> = {};
  for (const f of INFO_FIELDS) {
    const v = info?.[f.key];
    if (f.secret) {
      secretsSet[f.key] = v !== null && v !== undefined && v !== "";
      continue;
    }
    if (v === null || v === undefined) values[f.key] = null;
    else if (v instanceof Date) values[f.key] = v.toISOString().slice(0, 10);
    else values[f.key] = v as string | number;
  }
  return { values, secretsSet };
}

/**
 * Validates a partial update. Only keys present in `input` are touched; "" / null clears.
 * Returns the Prisma data object, or an error message.
 */
export function parseInfoUpdate(input: unknown): { data: Record<string, string | number | Date | null> } | { error: string } {
  if (!input || typeof input !== "object") return { error: "资料格式不对" };
  const data: Record<string, string | number | Date | null> = {};
  for (const [key, raw] of Object.entries(input as Raw)) {
    const f = INFO_FIELDS.find((x) => x.key === key);
    if (!f) return { error: `未知字段: ${key}` };
    const s = raw === null || raw === undefined ? "" : String(raw).trim();
    if (s === "") {
      data[key] = null;
      continue;
    }
    if (f.type === "int") {
      const n = Number(s);
      const max = key === "ownerRentDueDay" ? 31 : 1_000_000;
      const min = key === "ownerRentDueDay" ? 1 : 0;
      if (!Number.isInteger(n) || n < min || n > max) return { error: `${f.zh} 要填 ${min}–${max} 的整数` };
      data[key] = n;
    } else if (f.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(`${s}T00:00:00Z`).getTime())) return { error: `${f.zh} 日期格式不对` };
      data[key] = new Date(`${s}T00:00:00.000Z`);
    } else {
      const max = f.type === "textarea" ? 2000 : 200;
      if (s.length > max) return { error: `${f.zh} 太长了（最多 ${max} 字）` };
      data[key] = s;
    }
  }
  return { data };
}

export function pickSecrets(info: Raw | null): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of SECRET_KEYS) out[k] = (info?.[k] as string | null | undefined) ?? null;
  return out;
}

/** holder=ROOM needs a room in this unit; any other holder clears the room link. */
export async function resolveRoom(
  propertyId: string,
  holder: string,
  roomCode: string | null
): Promise<string | null | NextResponse> {
  if (holder !== "ROOM") return null;
  if (!roomCode) return NextResponse.json({ success: false, message: "请选择房间" }, { status: 400 });
  const room = await prisma.room.findUnique({ where: { roomCode }, select: { id: true, propertyId: true } });
  if (!room || room.propertyId !== propertyId) {
    return NextResponse.json({ success: false, message: "这个房间不属于这个单位" }, { status: 400 });
  }
  return room.id;
}
