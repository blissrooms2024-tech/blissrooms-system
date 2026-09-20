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
  carparkLotNumber: string | null;
  tenantName: string;
  tenantIc: string | null;
  propertyAddress: string | null;
}

const DOC_STYLE = `
.docSheet{font-family:"Times New Roman",Georgia,serif;font-size:13px;line-height:1.7;color:#1a1a1a;}
.docSheet .hd{text-align:center;border-bottom:2.5px solid #0b5394;padding-bottom:12px;margin-bottom:18px;}
.docSheet .hd .nm{font-size:20px;font-weight:700;letter-spacing:1px;color:#0b5394;}
.docSheet .hd .meta{font-size:10.5px;color:#555;line-height:1.5;margin-top:4px;}
.docSheet .title{text-align:center;font-size:17px;font-weight:700;letter-spacing:2px;margin:6px 0 20px;}
.docSheet .refRow{display:flex;justify-content:space-between;margin-bottom:18px;font-size:12.5px;}
.docSheet table.items{width:100%;border-collapse:collapse;margin:16px 0;}
.docSheet table.items th{background:#f0f4f9;text-align:left;padding:7px 9px;font-size:12px;border:1px solid #d5dee8;}
.docSheet table.items td{padding:7px 9px;border:1px solid #d5dee8;}
.docSheet table.items .num{text-align:right;}
.docSheet .totalRow td{font-weight:700;background:#f7f9fc;}
.docSheet .note{margin-top:18px;font-size:12px;color:#444;}
.docSheet .bank{margin-top:14px;border:1px solid #d5dee8;border-radius:6px;padding:10px 14px;font-size:12px;background:#fafbfd;}
.docSheet .closing{margin-top:30px;}
`;

export default function InvoiceDocument({ inv }: { inv: InvoiceData }) {
  const outstanding = Math.max(inv.amountDue - inv.amountPaid, 0);
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

      <div className="title">INVOICE</div>

      <div className="refRow">
        <div>
          Invoice No: {inv.paymentCode}
          <br />
          Contract: {inv.contractCode} · Room: {inv.roomCode}
          {inv.carparkLotNumber ? ` (Lot ${inv.carparkLotNumber})` : ""}
        </div>
        <div>Due Date: {inv.dueDate ? fmtDate(inv.dueDate) : "-"}</div>
      </div>

      <div>
        Bill To: <b>{inv.tenantName}</b>
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
          <tr className="totalRow">
            <td>Total Amount Due</td>
            <td className="num">RM{outstanding.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="bank">
        <b>Payment Details</b>
        <br />
        Bank: {COMPANY.BANK}
        <br />
        Account No: {COMPANY.ACC_NO}
        <br />
        Account Name: {COMPANY.NAME}
      </div>

      <p className="note">
        Please make payment before the due date and upload your transaction slip in the tenant portal. This invoice
        is computer-generated and valid without a signature.
      </p>

      <div className="closing">
        For <b>{COMPANY.NAME}</b>
      </div>
    </div>
  );
}
