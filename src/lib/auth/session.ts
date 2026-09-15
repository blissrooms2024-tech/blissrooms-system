import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "brs_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 6; // 6 hours — matches original CacheService session TTL

export interface SessionPayload {
  sub: string; // User.id
  userCode: string;
  name: string;
  email: string;
  role: Role;
  verified: boolean;
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Server Components / Route Handlers / Server Actions only (reads the cookie jar).
 * Re-checks the user still exists and is ACTIVE on every call — a valid JWT alone isn't
 * enough, otherwise a deleted/disabled account (including one wiped via the danger-zone
 * reset) keeps working for the rest of its 6-hour token lifetime. */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true } });
  if (!user || user.status !== "ACTIVE") return null;

  return payload;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
