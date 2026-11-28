import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/session";
import { computePnl, monthsBetween, type PnlCell } from "@/lib/pnl";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/config";

function resolveRange(sp: URLSearchParams): { from: string; to: string; label: string } | { error: string } {
  const now = new Date();
  const period = sp.get("period") || "month";
  if (period === "month") {
    const month = sp.get("month") || now.toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "月份格式不对, 要 YYYY-MM" };
    return { from: month, to: month, label: month };
  }
  const year = Number(sp.get("year")) || now.getFullYear();
  if (year < 2000 || year > 2100) return { error: "年份不对" };
  if (period === "quarter") {
    const q = Number(sp.get("q"));
    if (![1, 2, 3, 4].includes(q)) return { error: "季度要是 1–4" };
    const fm = (q - 1) * 3 + 1;
    return { from: `${year}-${String(fm).padStart(2, "0")}`, to: `${year}-${String(fm + 2).padStart(2, "0")}`, label: `${year} Q${q}` };
  }
  if (period === "year") return { from: `${year}-01`, to: `${year}-12`, label: String(year) };
  return { error: "period 要是 month / quarter / year" };
}

/** GET /api/pnl?period=month&month=2026-11 | period=quarter&year=2026&q=4 | period=year&year=2026
 *  Add &format=xlsx to download it as an Excel file. Boss/Admin only. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "BOSS" && user.role !== "ADMIN")) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const range = resolveRange(req.nextUrl.searchParams);
  if ("error" in range) return NextResponse.json({ success: false, message: range.error }, { status: 400 });
  if (monthsBetween(range.from, range.to).length > 24) {
    return NextResponse.json({ success: false, message: "期间太长" }, { status: 400 });
  }

  const pnl = await computePnl(range.from, range.to);

  if (req.nextUrl.searchParams.get("format") === "xlsx") {
    const buf = await toExcel(range.label, pnl);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="BlissRooms_PnL_${range.label.replace(/\s/g, "_")}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ success: true, label: range.label, from: range.from, to: range.to, ...pnl });
}

function costLabel(key: string) {
  if (key === "LEGACY_MAINTENANCE") return "维修（旧记录）";
  if (key === "LEGACY_COMMISSION") return "Agent 佣金（旧记录）";
  return EXPENSE_CATEGORY_LABELS[key] ?? key;
}

async function toExcel(label: string, pnl: Awaited<ReturnType<typeof computePnl>>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("P&L");
  const expenseCats = Array.from(
    new Set([...pnl.units.flatMap((u) => Object.keys(u.expenses)), ...Object.keys(pnl.overhead.expenses)])
  ).sort();

  ws.addRow([`Bliss Rooms — 损益表 P&L ${label}`]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const header = [
    "单位 Unit",
    "名称 Name",
    "租金 Rent",
    "车位 Carpark",
    "其他收入 Other",
    "营业额 Revenue",
    "屋主租金 Owner rent",
    "屋主分成 Landlord share",
    ...expenseCats.map((c) => EXPENSE_CATEGORY_LABELS[c] ?? c),
    "旧维修 Legacy maint.",
    "旧佣金 Legacy comm.",
    "总成本 Total cost",
    "净利润 Net",
  ];
  const h = ws.addRow(header);
  h.font = { bold: true };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFFD" } };

  const rowOf = (code: string, name: string, c: PnlCell) => [
    code,
    name,
    c.revenue.RENTAL,
    c.revenue.CARPARK,
    c.revenue.OTHER,
    c.revenueTotal,
    c.ownerRent,
    c.landlordShare,
    ...expenseCats.map((k) => c.expenses[k] ?? 0),
    c.legacyMaintenance,
    c.legacyCommission,
    c.costTotal,
    c.net,
  ];
  for (const u of pnl.units) ws.addRow(rowOf(u.propertyCode ?? "-", u.name ?? "未分配单位", u));
  ws.addRow(rowOf("小计", "所有单位 All units", pnl.unitsTotal)).font = { bold: true };
  ws.addRow(rowOf("公司", "公司开销 Company overhead", pnl.overhead));
  const last = ws.addRow(["总计", "公司净利润 Company net", "", "", "", pnl.unitsTotal.revenueTotal]);
  last.getCell(header.length).value = pnl.companyNet;
  last.getCell(header.length - 1).value = pnl.unitsTotal.costTotal + pnl.overhead.costTotal;
  last.font = { bold: true };

  ws.columns.forEach((col, i) => {
    col.width = i < 2 ? 18 : 14;
    if (i >= 2) col.numFmt = "#,##0.00";
  });

  if (pnl.trend.length > 1) {
    const t = wb.addWorksheet("每月 Monthly");
    t.addRow(["月份 Month", "营业额 Revenue", "总成本 Cost", "净利润 Net"]).font = { bold: true };
    for (const m of pnl.trend) t.addRow([m.month, m.revenue, m.cost, m.net]);
    t.columns.forEach((c, i) => {
      c.width = 16;
      if (i > 0) c.numFmt = "#,##0.00";
    });
  }

  const d = wb.addWorksheet("支出明细 Costs");
  d.addRow(["单位 Unit", "日期 Date", "类别 Category", "名称 Label", "编号 Ref", "金额 Amount", "备注 Notes"]).font = { bold: true };
  for (const u of [...pnl.units, { propertyCode: "公司", lines: pnl.overhead.lines }]) {
    for (const l of u.lines) {
      d.addRow([u.propertyCode ?? "-", l.date, costLabel(l.key), l.label, l.ref, l.amount, l.notes ?? ""]);
    }
  }
  d.columns.forEach((c, i) => {
    c.width = [10, 12, 14, 22, 22, 12, 50][i];
    if (i === 5) c.numFmt = "#,##0.00";
  });

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
