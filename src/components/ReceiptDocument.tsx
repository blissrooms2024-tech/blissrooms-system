"use client";

import { COMPANY, CONTRACT_IMAGES, paymentTypeLabelEn } from "@/lib/config";
import { fmtDate } from "@/lib/format";

export interface ReceiptData {
  paymentCode: string;
  type: string;
  customLabel: string | null;
  periodMonth: string | null;
  amountPaid: number;
  method: string | null;
  paidDate: string | null;
  contractCode: string;
  roomCode: string;
  isCarpark: boolean;
  carparkRoomCode: string | null;
  carparkLotNumber: string | null;
  tenantName: string;
  tenantIc: string | null;
  propertyAddress: string | null;
}

const DOC_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.docSheet{font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#1a1a1a;}
.docSheet .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #0f2a5c;padding-bottom:14px;margin-bottom:18px;gap:16px;}
.docSheet .hd .brand{display:flex;align-items:center;gap:10px;}
.docSheet .hd .brand img{height:48px;width:auto;}
.docSheet .hd .nm{font-size:16px;font-weight:700;color:#0f2a5c;}
.docSheet .hd .meta{font-size:10px;color:#555;line-height:1.5;margin-top:3px;}
.docSheet .hd .titleBlock{text-align:right;flex-shrink:0;}
.docSheet .hd .title{font-size:24px;font-weight:800;letter-spacing:1.5px;color:#0f2a5c;}
.docSheet .hd .titleMeta{font-size:11.5px;color:#333;line-height:1.6;margin-top:4px;}
.docSheet .hd .titleMeta b{color:#0f2a5c;}
.docSheet .billTo{margin:18px 0;font-size:12.5px;}
.docSheet .billTo .lbl{font-size:10.5px;font-weight:700;letter-spacing:1px;color:#0f2a5c;margin-bottom:3px;}
.docSheet table.items{width:100%;border-collapse:collapse;margin:16px 0;}
.docSheet table.items th{background:#0f2a5c;color:#fff;text-align:left;padding:8px 10px;font-size:11.5px;font-weight:700;}
.docSheet table.items td{padding:8px 10px;border-bottom:1px solid #e3e7ee;font-size:12.5px;}
.docSheet table.items .num{text-align:right;}
.docSheet .totals{margin-top:6px;margin-left:auto;width:260px;font-size:12.5px;}
.docSheet .totals .row{display:flex;justify-content:space-between;padding:4px 10px;}
.docSheet .totals .totalRow{display:flex;justify-content:space-between;padding:8px 10px;font-weight:700;font-size:14px;background:#eef1f7;color:#0f2a5c;border-top:2px solid #0f2a5c;}
.docSheet .paidStamp{display:inline-block;margin-top:16px;padding:5px 14px;border:2px solid #147a3d;color:#147a3d;font-weight:700;letter-spacing:1.5px;font-size:12px;border-radius:4px;}
.docSheet .note{margin-top:22px;font-size:11.5px;color:#666;text-align:center;font-style:italic;}
`;

export default function ReceiptDocument({ r }: { r: ReceiptData }) {
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
              <br />
              TEL: {COMPANY.TEL} &nbsp;·&nbsp; {COMPANY.EMAIL}
            </div>
          </div>
        </div>
        <div className="titleBlock">
          <div className="title">RECEIPT</div>
          <div className="titleMeta">
            No: <b>{r.paymentCode}</b>
            <br />
            Date: <b>{r.paidDate ? fmtDate(r.paidDate) : "-"}</b>
            <br />
            For Contract: <b>{r.contractCode}</b>
            <br />
            <span style={{ color: "#147a3d", fontWeight: 700 }}>PAID</span>
          </div>
        </div>
      </div>

      <div className="billTo">
        <div className="lbl">RECEIVED FROM</div>
        <b>{r.tenantName}</b>
        {r.tenantIc && (
          <>
            <br />
            NRIC/Passport: {r.tenantIc}
          </>
        )}
        {r.propertyAddress && (
          <>
            <br />
            {r.propertyAddress}
          </>
        )}
        <br />
        {r.isCarpark ? (
          <>
            Car Park: {r.roomCode}
            {r.carparkLotNumber ? ` (Lot ${r.carparkLotNumber})` : ""}
          </>
        ) : (
          <>
            Room: {r.roomCode}
            {r.carparkRoomCode
              ? ` · Car Park: ${r.carparkRoomCode}${r.carparkLotNumber ? ` (Lot ${r.carparkLotNumber})` : ""}`
              : ""}
          </>
        )}
      </div>

      <table className="items">
        <thead>
          <tr>
            <th>Description</th>
            <th>Payment Method</th>
            <th className="num">Amount (RM)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {paymentTypeLabelEn(r.type, r.customLabel)}
              {r.type === "CARPARK" && r.carparkLotNumber ? ` (Lot ${r.carparkLotNumber})` : ""}
              {r.periodMonth ? ` (${r.periodMonth})` : ""}
            </td>
            <td>{r.method || "-"}</td>
            <td className="num">{Number(r.amountPaid).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="totals">
        <div className="row">
          <span>Subtotal</span>
          <span>RM{Number(r.amountPaid).toLocaleString()}</span>
        </div>
        <div className="totalRow">
          <span>Total Paid</span>
          <span>RM{Number(r.amountPaid).toLocaleString()}</span>
        </div>
      </div>

      <div className="paidStamp">PAID IN FULL</div>

      <p className="note">Thank you for staying with Bliss Rooms.</p>
    </div>
  );
}
