"use client";

import { COMPANY, CONTRACT_IMAGES, paymentTypeLabel } from "@/lib/config";
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
  tenantName: string;
  tenantIc: string | null;
  propertyAddress: string | null;
}

const DOC_STYLE = `
.docSheet{font-family:"Times New Roman",Georgia,serif;font-size:13px;line-height:1.7;color:#1a1a1a;}
.docSheet .hd{text-align:center;border-bottom:2.5px solid #0b5394;padding-bottom:12px;margin-bottom:18px;}
.docSheet .hd .nm{font-size:20px;font-weight:700;letter-spacing:1px;color:#0b5394;}
.docSheet .hd .meta{font-size:10.5px;color:#555;line-height:1.5;margin-top:4px;}
.docSheet .title{text-align:center;font-size:17px;font-weight:700;letter-spacing:2px;margin:6px 0 20px;color:#146c2e;}
.docSheet .refRow{display:flex;justify-content:space-between;margin-bottom:18px;font-size:12.5px;}
.docSheet table.items{width:100%;border-collapse:collapse;margin:16px 0;}
.docSheet table.items th{background:#eef7f0;text-align:left;padding:7px 9px;font-size:12px;border:1px solid #cfe6d6;}
.docSheet table.items td{padding:7px 9px;border:1px solid #cfe6d6;}
.docSheet table.items .num{text-align:right;}
.docSheet .totalRow td{font-weight:700;background:#f4faf5;}
.docSheet .paidStamp{display:inline-block;margin-top:16px;padding:6px 16px;border:2.5px solid #146c2e;color:#146c2e;font-weight:700;letter-spacing:2px;transform:rotate(-3deg);border-radius:4px;}
.docSheet .note{margin-top:18px;font-size:12px;color:#444;}
.docSheet .closing{margin-top:30px;}
`;

export default function ReceiptDocument({ r }: { r: ReceiptData }) {
  return (
    <div className="docSheet">
      <style>{DOC_STYLE}</style>

      <div className="hd">
        {CONTRACT_IMAGES.logo && (
          <img
            src={CONTRACT_IMAGES.logo}
            alt="logo"
            style={{ display: "block", margin: "0 auto 8px", maxHeight: 90, width: "auto" }}
          />
        )}
        <div className="nm">{COMPANY.NAME}</div>
        <div className="meta">
          Reg. No.: {COMPANY.REG_NO}
          <br />
          {COMPANY.ADDRESS}
          <br />
          TEL: {COMPANY.TEL} &nbsp;·&nbsp; {COMPANY.EMAIL}
        </div>
      </div>

      <div className="title">OFFICIAL RECEIPT</div>

      <div className="refRow">
        <div>
          Receipt No: {r.paymentCode}
          <br />
          Contract: {r.contractCode} · Room: {r.roomCode}
        </div>
        <div>Date Paid: {r.paidDate ? fmtDate(r.paidDate) : "-"}</div>
      </div>

      <div>
        Received From: <b>{r.tenantName}</b>
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
              {paymentTypeLabel(r.type, r.customLabel)}
              {r.periodMonth ? ` (${r.periodMonth})` : ""}
            </td>
            <td>{r.method || "-"}</td>
            <td className="num">{Number(r.amountPaid).toLocaleString()}</td>
          </tr>
          <tr className="totalRow">
            <td colSpan={2}>Total Amount Received</td>
            <td className="num">RM{Number(r.amountPaid).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="paidStamp">PAID IN FULL</div>

      <p className="note">Thank you for your payment. This receipt is computer-generated and valid without a signature.</p>

      <div className="closing">
        For <b>{COMPANY.NAME}</b>
      </div>
    </div>
  );
}
