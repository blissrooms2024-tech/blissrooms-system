import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/id";
import { legacyImportRowSchema, LEGACY_IMPORT_COLUMNS } from "@/lib/schemas/legacyImport";

const SHEET_NAME = "旧合同导入";
const EXAMPLE_EMAIL = "demo@example.com";

interface RowResult {
  row: number;
  status: "imported" | "skipped" | "error";
  message: string;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  // ExcelJS occasionally hands back a Date it couldn't fully parse (a bad custom date format in
  // the cell) with a NaN internal time — .toISOString() throws on that, which would otherwise
  // crash the whole upload before any row's own try/catch runs. Treat it as blank instead; the
  // per-row schema validation below will report "日期格式不对" for that cell like any other bad value.
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "");
  return String(value).trim();
}

// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas/newlines, and "" as
// an escaped quote inside a quoted field. Good enough for a data-entry template, not a general
// CSV library.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以导入旧合同" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, message: "请上传 Excel 文件" }, { status: 400 });
  }

  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
  let dataRows: string[][];

  if (isCsv) {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
    const allRows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
    dataRows = allRows.slice(1); // drop header row
  } else {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(arrayBuffer);
    } catch {
      return NextResponse.json(
        { success: false, message: "读不到这个文件，请确认是 .xlsx 或 .csv 格式" },
        { status: 400 }
      );
    }
    const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
    if (!sheet) {
      return NextResponse.json({ success: false, message: `找不到 "${SHEET_NAME}" 这个 sheet` }, { status: 400 });
    }
    dataRows = [];
    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      dataRows.push(LEGACY_IMPORT_COLUMNS.map((_, idx) => cellToString(row.getCell(idx + 1).value)));
    }
  }

  const results: RowResult[] = [];
  let imported = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2; // +2: 1-indexed, plus the header row
    const cells = dataRows[i];
    const raw: Record<string, string> = {};
    LEGACY_IMPORT_COLUMNS.forEach((key, idx) => {
      raw[key] = (cells[idx] ?? "").trim();
    });

    const isBlank = Object.values(raw).every((v) => !v);
    if (isBlank) continue;

    if (raw.email.toLowerCase() === EXAMPLE_EMAIL) {
      results.push({ row: rowNum, status: "skipped", message: "示范数据行，已跳过" });
      continue;
    }

    const parsed = legacyImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      results.push({ row: rowNum, status: "error", message: msg });
      continue;
    }
    const d = parsed.data;

    try {
      const room = await prisma.room.findUnique({ where: { roomCode: d.roomCode }, include: { property: true } });
      if (!room) {
        results.push({ row: rowNum, status: "error", message: `找不到房间 ${d.roomCode}` });
        continue;
      }
      if (room.currentTenantId) {
        results.push({ row: rowNum, status: "error", message: `${d.roomCode} 已经有租客了，不能重复导入` });
        continue;
      }

      let carparkRoom = null;
      if (d.carparkRoomCode) {
        if (d.carparkRoomCode === d.roomCode) {
          results.push({ row: rowNum, status: "error", message: "车位不能跟主房间是同一间" });
          continue;
        }
        carparkRoom = await prisma.room.findUnique({ where: { roomCode: d.carparkRoomCode } });
        if (!carparkRoom || !carparkRoom.isCarpark) {
          results.push({ row: rowNum, status: "error", message: `找不到车位 ${d.carparkRoomCode}` });
          continue;
        }
        if (carparkRoom.currentTenantId) {
          results.push({ row: rowNum, status: "error", message: `车位 ${d.carparkRoomCode} 已经有租客了，不能重复导入` });
          continue;
        }
      }

      let tenant = await prisma.user.findFirst({ where: { role: "TENANT", ic: d.tenantIc } });
      if (!tenant) {
        const emailTaken = await prisma.user.findUnique({ where: { email: d.email } });
        if (emailTaken) {
          results.push({
            row: rowNum,
            status: "error",
            message: `Email ${d.email} 已经有账号了 (${emailTaken.name})，但 IC 对不上，请检查资料`,
          });
          continue;
        }
        const icDigits = d.tenantIc.replace(/\D/g, "");
        const pw = icDigits.length >= 4 ? icDigits.slice(-4) : "1234";
        tenant = await prisma.user.create({
          data: {
            userCode: await newId("U"),
            name: d.tenantName,
            email: d.email,
            passwordHash: await hashPassword(pw),
            role: "TENANT",
            phone: d.phone,
            ic: d.tenantIc,
            status: "ACTIVE",
          },
        });
      }

      let agentId = user.sub;
      let agentName = user.name;
      if (d.agentCode) {
        const agent = await prisma.user.findUnique({ where: { userCode: d.agentCode } });
        if (agent) {
          agentId = agent.id;
          agentName = agent.name;
        }
      }

      const total =
        d.roomRental + d.securityDeposit + d.utilitiesDeposit + d.accessCardDeposit + d.adminFee + d.carparkRental;
      const contractCode = await newId("CT");

      await prisma.$transaction([
        prisma.contract.create({
          data: {
            contractCode,
            roomId: room.id,
            carparkRoomId: carparkRoom?.id,
            propertyAddress: room.property?.address || room.propertyName,
            tenantId: tenant.id,
            tenantName: d.tenantName,
            tenantIc: d.tenantIc,
            agentId,
            agentName,
            moveInDate: d.moveInDate,
            commencementDate: d.commencementDate,
            expiredDate: d.expiredDate,
            tenureMonths: d.tenureMonths,
            roomRental: d.roomRental,
            carparkRental: d.carparkRental,
            securityDeposit: d.securityDeposit,
            utilitiesDeposit: d.utilitiesDeposit,
            earnestDeposit: d.roomRental,
            accessCardDeposit: d.accessCardDeposit,
            adminFee: d.adminFee,
            totalOutstanding: total,
            status: "ACTIVE",
            commStatus: "Pending",
            createdBy: user.name,
            remarks: d.remarks ? `${d.remarks} (旧合同导入)` : "旧合同导入",
            nationality: d.nationality,
            contactNumber: d.phone,
            email: d.email,
            occupation: d.occupation,
            company: d.company,
            carPlate: d.carPlate,
            emergencyName: d.emergencyName,
            emergencyContact: d.emergencyContact,
            emergencyRelationship: d.emergencyRelationship,
            utilDryer: d.utilDryer,
            utilAircond: d.utilAircond,
            utilElectric: d.utilElectric,
          },
        }),
        prisma.room.update({
          where: { id: room.id },
          data: { status: "OCCUPIED", currentContractId: contractCode, currentTenantId: tenant.id },
        }),
        ...(carparkRoom
          ? [
              prisma.room.update({
                where: { id: carparkRoom.id },
                data: { status: "OCCUPIED", currentContractId: contractCode, currentTenantId: tenant.id },
              }),
            ]
          : []),
      ]);

      imported++;
      results.push({ row: rowNum, status: "imported", message: `✅ ${contractCode} (${d.tenantName} · ${d.roomCode})` });
    } catch (e) {
      results.push({
        row: rowNum,
        status: "error",
        message: "系统出错: " + (e instanceof Error ? e.message : String(e)),
      });
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    total: results.length,
    results,
  });
}
