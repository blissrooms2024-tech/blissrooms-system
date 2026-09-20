"use client";

import { COMPANY, CONTRACT_IMAGES } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import { amountInWordsRM } from "@/lib/numberToWords";

export interface PayslipLine {
  label: string;
  amount: number;
}

export interface PayslipData {
  payPeriod: string; // e.g. "September 2026"
  issuedDate: string; // ISO date
  name: string;
  staffId: string;
  bankName: string | null;
  position: string;
  icPassport: string | null;
  accountNo: string | null;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
}

const DOC_STYLE = `
.docSheet{font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#1a1a1a;}
.docSheet .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #0f2a5c;padding-bottom:14px;margin-bottom:18px;gap:16px;}
.docSheet .hd .brand{display:flex;align-items:center;gap:10px;}
.docSheet .hd .brand img{height:48px;width:auto;}
.docSheet .hd .nm{font-size:16px;font-weight:700;color:#0f2a5c;}
.docSheet .hd .meta{font-size:10px;color:#555;line-height:1.5;margin-top:3px;}
.docSheet .hd .titleBlock{text-align:right;flex-shrink:0;}
.docSheet .hd .title{font-size:24px;font-weight:800;letter-spacing:1.5px;color:#0f2a5c;}
.docSheet .hd .titleMeta{font-size:11.5px;color:#333;line-height:1.6;margin-top:4px;}
.docSheet .hd .titleMeta b{color:#0f2a5c;}
.docSheet .infoGrid{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;margin:18px 0;font-size:12.5px;border:1px solid #e3e7ee;border-radius:6px;padding:12px 16px;background:#fafbfd;}
.docSheet .infoGrid .lbl{font-size:10px;color:#888;}
.docSheet .infoGrid .val{font-weight:600;margin-bottom:8px;}
.docSheet table.pay{width:100%;border-collapse:collapse;margin:16px 0;}
.docSheet table.pay th{background:#0f2a5c;color:#fff;text-align:left;padding:8px 10px;font-size:11.5px;font-weight:700;}
.docSheet table.pay td{padding:7px 10px;border-bottom:1px solid #e3e7ee;font-size:12px;}
.docSheet table.pay .num{text-align:right;}
.docSheet table.pay .subRow td{font-weight:700;background:#eef1f7;border-top:1.5px solid #0f2a5c;}
.docSheet .netPay{margin-top:18px;display:flex;justify-content:space-between;align-items:center;background:#0f2a5c;color:#fff;border-radius:6px;padding:14px 18px;}
.docSheet .netPay .lbl{font-size:12px;letter-spacing:1px;opacity:.85;}
.docSheet .netPay .amt{font-size:22px;font-weight:800;}
.docSheet .words{margin-top:8px;font-size:11.5px;font-style:italic;color:#555;text-align:right;}
.docSheet .paidStamp{display:inline-block;margin-top:16px;padding:5px 14px;border:2px solid #147a3d;color:#147a3d;font-weight:700;letter-spacing:1.5px;font-size:12px;border-radius:4px;}
.docSheet .sigRow{display:flex;justify-content:space-between;margin-top:48px;gap:24px;}
.docSheet .sigBox{flex:1;text-align:center;}
.docSheet .sigBox .line{border-top:1px solid #999;margin-top:36px;padding-top:5px;font-size:11px;color:#555;}
.docSheet .note{margin-top:22px;font-size:11px;color:#888;text-align:center;font-style:italic;}
`;

export default function PayslipDocument({ p }: { p: PayslipData }) {
  const grossEarnings = p.earnings.reduce((s, l) => s + l.amount, 0);
  const totalDeductions = p.deductions.reduce((s, l) => s + l.amount, 0);
  const netPay = grossEarnings - totalDeductions;

  return (
    <div className="docSheet">
      <style>{DOC_STYLE}</style>

      <div className="hd">
        <div className="brand">
          {CONTRACT_IMAGES.logo && <img src={CONTRACT_IMAGES.logo} alt="logo" />}
          <div>
            <div className="nm">{COMPANY.NAME}</div>
            <div className="meta">
              Reg. No.: {COMPANY.REG_NO}
              <br />
              {COMPANY.ADDRESS}
            </div>
          </div>
        </div>
        <div className="titleBlock">
          <div className="title">PAYSLIP</div>
          <div className="titleMeta">
            Pay Period: <b>{p.payPeriod}</b>
            <br />
            Pay Type: <b>Commission</b>
            <br />
            Issued Date: <b>{fmtDate(p.issuedDate)}</b>
          </div>
        </div>
      </div>

      <div className="infoGrid">
        <div>
          <div className="lbl">NAME</div>
          <div className="val">{p.name}</div>
          <div className="lbl">STAFF ID</div>
          <div className="val">{p.staffId}</div>
          <div className="lbl">BANK</div>
          <div className="val">{p.bankName || "-"}</div>
        </div>
        <div>
          <div className="lbl">POSITION</div>
          <div className="val">{p.position}</div>
          <div className="lbl">IC / PASSPORT</div>
          <div className="val">{p.icPassport || "-"}</div>
          <div className="lbl">ACCOUNT NO.</div>
          <div className="val">{p.accountNo || "-"}</div>
        </div>
      </div>

      <table className="pay">
        <thead>
          <tr>
            <th>Earnings</th>
            <th className="num">Amount (RM)</th>
          </tr>
        </thead>
        <tbody>
          {p.earnings.length === 0 ? (
            <tr>
              <td colSpan={2} style={{ color: "#999" }}>
                No commission this period
              </td>
            </tr>
          ) : (
            p.earnings.map((l, i) => (
              <tr key={i}>
                <td>{l.label}</td>
                <td className="num">{l.amount.toLocaleString()}</td>
              </tr>
            ))
          )}
          <tr className="subRow">
            <td>Gross Earnings</td>
            <td className="num">RM{grossEarnings.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <table className="pay">
        <thead>
          <tr>
            <th>Deductions</th>
            <th className="num">Amount (RM)</th>
          </tr>
        </thead>
        <tbody>
          {p.deductions.length === 0 ? (
            <tr>
              <td colSpan={2} style={{ color: "#999" }}>
                None
              </td>
            </tr>
          ) : (
            p.deductions.map((l, i) => (
              <tr key={i}>
                <td>{l.label}</td>
                <td className="num">{l.amount.toLocaleString()}</td>
              </tr>
            ))
          )}
          <tr className="subRow">
            <td>Total Deductions</td>
            <td className="num">RM{totalDeductions.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="netPay">
        <span className="lbl">NET PAY</span>
        <span className="amt">RM{netPay.toLocaleString()}</span>
      </div>
      <div className="words">{amountInWordsRM(netPay)}</div>

      <div className="paidStamp">PAID</div>

      <div className="sigRow">
        <div className="sigBox">
          <div className="line">Authorised By ({COMPANY.NAME})</div>
        </div>
        <div className="sigBox">
          <div className="line">Received By ({p.name})</div>
        </div>
      </div>

      <p className="note">This payslip is computer-generated and valid without a signature.</p>
    </div>
  );
}
