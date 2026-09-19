"use client";

import { COMPANY, CONTRACT_IMAGES } from "@/lib/config";
import { fmtDate } from "@/lib/format";

export interface WarningLetterData {
  letterCode: string;
  message: string;
  sentBy: string;
  triggeredBy: string;
  createdAt: string;
  contractCode: string;
  tenantName: string;
  tenantIc: string | null;
  propertyAddress: string | null;
  roomCode: string;
}

const DOC_STYLE = `
.warningDoc{font-family:"Times New Roman",Georgia,serif;font-size:13px;line-height:1.7;color:#1a1a1a;}
.warningDoc .hd{text-align:center;border-bottom:2.5px solid #0b5394;padding-bottom:12px;margin-bottom:18px;}
.warningDoc .hd .nm{font-size:20px;font-weight:700;letter-spacing:1px;color:#0b5394;}
.warningDoc .hd .meta{font-size:10.5px;color:#555;line-height:1.5;margin-top:4px;}
.warningDoc .refRow{display:flex;justify-content:space-between;margin-bottom:18px;font-size:12.5px;}
.warningDoc .confidential{text-align:center;font-weight:700;letter-spacing:1px;text-decoration:underline;margin:16px 0;}
.warningDoc .subject{font-weight:700;text-decoration:underline;margin:16px 0;}
.warningDoc .body{white-space:pre-wrap;text-align:justify;margin:16px 0;}
.warningDoc .closing{margin-top:34px;}
`;

export default function WarningLetterDocument({ l }: { l: WarningLetterData }) {
  return (
    <div className="warningDoc">
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

      <div className="refRow">
        <div>
          Ref: {l.letterCode}
          <br />
          Contract: {l.contractCode} · Room: {l.roomCode}
        </div>
        <div>Date: {fmtDate(l.createdAt)}</div>
      </div>

      <div>
        To: <b>{l.tenantName}</b>
        {l.tenantIc && (
          <>
            <br />
            NRIC/Passport: {l.tenantIc}
          </>
        )}
        {l.propertyAddress && (
          <>
            <br />
            {l.propertyAddress}
          </>
        )}
      </div>

      <div className="confidential">PRIVATE &amp; CONFIDENTIAL</div>
      <div className="subject">RE: WARNING LETTER — {l.contractCode}</div>

      <p>Dear Sir/Madam,</p>
      <div className="body">{l.message}</div>
      <p>
        Please treat this matter with the seriousness it deserves. Failure to rectify the above may result in
        further action being taken against you under the terms of your Tenancy Agreement, which may include
        termination of tenancy and forfeiture of deposit.
      </p>

      <div className="closing">
        Yours faithfully,
        <br />
        For <b>{COMPANY.NAME}</b>
      </div>
    </div>
  );
}
