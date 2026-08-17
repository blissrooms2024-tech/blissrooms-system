import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE, type SessionPayload } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/roleHome";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` and `middleware()` -> `proxy()`.

// Always allowed, regardless of session state (auth API endpoints, plus Vercel Cron —
// those requests carry an `Authorization: Bearer CRON_SECRET` header, never a session
// cookie, and each cron route verifies that header itself).
const PUBLIC_API_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/verify",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/cron",
];

// Allowed without a session, but redirected away from if a valid session exists.
const GUEST_ONLY_PATHS = ["/login", "/reset-password"];

// Path prefix -> roles allowed to see it. Anything not listed here is allowed
// for any authenticated role (defense-in-depth role checks also happen per-page/route).
const ROLE_GUARDS: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/dashboard", roles: ["BOSS", "ADMIN"] },
  { prefix: "/users", roles: ["ADMIN"] },
  { prefix: "/my-tenancy", roles: ["TENANT"] },
  { prefix: "/rooms", roles: ["BOSS", "ADMIN", "AGENT"] },
  { prefix: "/contracts", roles: ["BOSS", "ADMIN", "AGENT"] },
];

async function verify(token: string): Promise<SessionPayload | null> {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/login-bg/")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verify(token) : null;

  const isGuestPath = GUEST_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isGuestPath) {
    if (session) return NextResponse.redirect(new URL(ROLE_HOME[session.role] ?? "/login", req.url));
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role] ?? "/login", req.url));
  }

  const guard = ROLE_GUARDS.find((g) => pathname.startsWith(g.prefix));
  if (guard && !guard.roles.includes(session.role)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role] ?? "/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
