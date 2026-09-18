import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

/** Powers the red count badge on the tenant sidebar's 警告信 link (cheap enough to poll from
 * AppShell on every navigation, same as the maintenance-summary badge) and the full list on
 * the 我的警告信 page — one endpoint for both since the letter count per tenant is always
 * small. */
export async function GET() {
  const user = await getCurrentUser();
  // Not restricted to role === "TENANT": an Agent can also be the tenant on their own contract,
  // the query below is already scoped to their own tenantId either way.
  if (!user || (user.role !== "TENANT" && user.role !== "AGENT")) {
    return NextResponse.json({ success: false, message: "只有租客可以看" }, { status: 403 });
  }

  const letters = await prisma.warningLetter.findMany({
    where: { contract: { tenantId: user.sub } },
    orderBy: { createdAt: "desc" },
    include: { contract: { select: { contractCode: true } } },
  });

  return NextResponse.json({
    success: true,
    count: letters.length,
    letters: serialize(
      letters.map((l) => ({
        letterCode: l.letterCode,
        contractCode: l.contract.contractCode,
        message: l.message,
        sentBy: l.sentBy,
        triggeredBy: l.triggeredBy,
        createdAt: l.createdAt,
      }))
    ),
  });
}
