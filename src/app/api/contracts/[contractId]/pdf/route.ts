import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadDataUrl } from "@/lib/storage";

const schema = z.object({ dataUrl: z.string().min(1) });

// Attaches the scanned/signed PDF of an already-existing (often legacy-imported) contract —
// separate from the main contract edit endpoint, which locks once a contract is ACTIVE.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以上传合同 PDF" }, { status: 403 });
  }
  const { contractId } = await params;
  const contract = await prisma.contract.findUnique({ where: { contractCode: contractId } });
  if (!contract) return NextResponse.json({ success: false, message: "找不到合同" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "请先选文件" }, { status: 400 });
  }

  let url: string;
  try {
    url = await uploadDataUrl(parsed.data.dataUrl, `${contractId}_contract_${Date.now()}.pdf`);
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "上传失败: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }

  await prisma.contract.update({ where: { contractCode: contractId }, data: { pdfLink: url } });

  return NextResponse.json({ success: true, message: "✅ 合同 PDF 已上传", url });
}
