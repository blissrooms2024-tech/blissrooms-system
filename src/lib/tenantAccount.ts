import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/id";

/** Mirrors Apps Script `ensureTenantAccount_`: reuse an existing user by email, or create a
 * new TENANT account with password = last 4 digits of their IC (fallback "1234"). */
export async function ensureTenantAccount(d: {
  email?: string;
  tenantName?: string;
  tenantIc?: string;
  contactNumber?: string;
}): Promise<string | null> {
  if (!d.email) return null;
  const email = d.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;

  const icDigits = (d.tenantIc || "").replace(/\D/g, "");
  const pw = icDigits.length >= 4 ? icDigits.slice(-4) : icDigits || "1234";

  const user = await prisma.user.create({
    data: {
      userCode: await newId("U"),
      name: d.tenantName || email,
      email,
      passwordHash: await hashPassword(pw),
      role: "TENANT",
      phone: d.contactNumber || "",
      ic: d.tenantIc || "",
      status: "ACTIVE",
    },
  });
  return user.id;
}
