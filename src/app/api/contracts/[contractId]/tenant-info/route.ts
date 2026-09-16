import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

// Personal-info fields the tenant may correct themselves, regardless of contract status —
// rental amounts, dates, and the tenant identity itself stay Admin-only (edited via the
// main contract edit endpoint, only while the contract is still DRAFT/PENDING_APPROVE).
const schema = z.object({
  nationality: z.string().trim().optional().default(""),
  contactNumber: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  occupation: z.string().trim().optional().default(""),
  company: z.string().trim().optional().default(""),
  carPlate: z.string().trim().optional().default(""),
  emergencyName: z.string().trim().optional().default(""),
  emergencyContact: z.string().trim().optional().default(""),
  emergencyRelationship: z.string().trim().optional().default(""),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "请重新登录" }, { status: 401 });

  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });
  // Not gated on role === "TENANT": an Agent can also be the tenant on their own contract.
  if (contract.tenantId !== user.sub) {
    return NextResponse.json({ success: false, message: "只有这张合同的租客本人可以改" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });
  }
  const d = parsed.data;

  await prisma.contract.update({
    where: { contractCode: contractId },
    data: {
      nationality: d.nationality,
      contactNumber: d.contactNumber,
      email: d.email,
      occupation: d.occupation,
      company: d.company,
      carPlate: d.carPlate,
      emergencyName: d.emergencyName,
      emergencyContact: d.emergencyContact,
      emergencyRelationship: d.emergencyRelationship,
    },
  });

  return NextResponse.json({ success: true, message: "✅ 资料已更新" });
}
