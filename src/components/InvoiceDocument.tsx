"use client";

import { COMPANY, CONTRACT_IMAGES, paymentTypeLabelEn } from "@/lib/config";
import { fmtDate } from "@/lib/format";

export interface InvoiceData {
  paymentCode: string;
  type: string;
  customLabel: string | null;
  periodMonth: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string | null;
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
.docSheet .bank{margin-top:18px;border:1px solid #d5dee8;border-radius:6px;padding:10px 14px;font-size:12px;background:#fafbfd;}
.docSheet .bank .lbl{font-size:10.5px;font-weight:700;letter-spacing:1px;color:#0f2a5c;margin-bottom:4px;}
.docSheet .note{margin-top:18px;font-size:11.5px;color:#666;text-align:center;font-style:italic;}
`;

export default function InvoiceDocument({ inv }: { inv: InvoiceData }) {
  const outstanding = Math.max(inv.amountDue - inv.amountPaid, 0);
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
          <div className="title">INVOICE</div>
          <div className="titleMeta">
            No: <b>{inv.paymentCode}</b>
            <br />
            Due Date: <b>{inv.dueDate ? fmtDate(inv.dueDate) : "-"}</b>
            <br />
            For Contract: <b>{inv.contractCode}</b>
          </div>
        </div>
      </div>

      <div className="billTo">
        <div className="lbl">BILL TO</div>
        <b>{inv.tenantName}</b>
        {inv.tenantIc && (
          <>
            <br />
            NRIC/Passport: {inv.tenantIc}
          </>
        )}
        {inv.propertyAddress && (
          <>
            <br />
            {inv.propertyAddress}
          </>
        )}
        <br />
        {inv.isCarpark ? (
          <>
            Car Park: {inv.roomCode}
            {inv.carparkLotNumber ? ` (Lot ${inv.carparkLotNumber})` : ""}
          </>
        ) : (
          <>
            Room: {inv.roomCode}
            {inv.carparkRoomCode
              ? ` · Car Park: ${inv.carparkRoomCode}${inv.carparkLotNumber ? ` (Lot ${inv.carparkLotNumber})` : ""}`
              : ""}
          </>
        )}
      </div>

      <table className="items">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Amount (RM)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {paymentTypeLabelEn(inv.type, inv.customLabel)}
              {inv.type === "CARPARK" && inv.carparkLotNumber ? ` (Lot ${inv.carparkLotNumber})` : ""}
              {inv.periodMonth ? ` (${inv.periodMonth})` : ""}
            </td>
            <td className="num">{Number(inv.amountDue).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="totals">
        <div className="row">
          <span>Subtotal</span>
          <span>RM{Number(inv.amountDue).toLocaleString()}</span>
        </div>
        <div className="totalRow">
          <span>Total Due</span>
          <span>RM{outstanding.toLocaleString()}</span>
        </div>
      </div>

      <div className="bank">
        <div className="lbl">PAYMENT DETAILS</div>
        Bank: {COMPANY.BANK}
        <br />
        Account Name: {COMPANY.NAME}
        <br />
        Account No: {COMPANY.ACC_NO}
        <br />
        Please upload your transaction slip in the tenant portal after payment.
      </div>

      <p className="note">Thank you for staying with Bliss Rooms.</p>
    </div>
  );
}
