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
.warningDoc{font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#1a1a1a;}
.warningDoc .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #0f2a5c;padding-bottom:14px;margin-bottom:18px;gap:16px;}
.warningDoc .hd .brand{display:flex;align-items:center;gap:10px;}
.warningDoc .hd .brand img{height:48px;width:auto;}
.warningDoc .hd .nm{font-size:16px;font-weight:700;color:#0f2a5c;}
.warningDoc .hd .meta{font-size:10px;color:#555;line-height:1.5;margin-top:3px;}
.warningDoc .hd .titleBlock{text-align:right;flex-shrink:0;}
.warningDoc .hd .title{font-size:22px;font-weight:800;letter-spacing:1.5px;color:#0f2a5c;}
.warningDoc .hd .titleMeta{font-size:11.5px;color:#333;line-height:1.6;margin-top:4px;}
.warningDoc .hd .titleMeta b{color:#0f2a5c;}
.warningDoc .toBlock{margin:18px 0;font-size:12.5px;}
.warningDoc .toBlock .subject{font-weight:700;margin-top:6px;}
.warningDoc .body{white-space:pre-wrap;text-align:justify;margin:16px 0;}
.warningDoc .closing{margin-top:34px;}
`;

export default function WarningLetterDocument({ l }: { l: WarningLetterData }) {
  return (
    <div className="warningDoc">
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
          <div className="title">WARNING LETTER</div>
          <div className="titleMeta">
            Ref: <b>{l.letterCode}</b>
            <br />
            Date: <b>{fmtDate(l.createdAt)}</b>
            <br />
            Room Code: <b>{l.roomCode}</b>
          </div>
        </div>
      </div>

      <div className="toBlock">
        To: <b>{l.tenantName}</b>
        {l.tenantIc && (
          <>
            <br />
            NRIC/Passport: {l.tenantIc}
          </>
        )}
        <div className="subject">
          Re: Warning Letter — Room Code: {l.roomCode}
          {l.propertyAddress && (
            <>
              <br />
              Property Address: {l.propertyAddress}
            </>
          )}
        </div>
      </div>

      <p>Dear {l.tenantName},</p>
      <div className="body">{l.message}</div>
      <p>
        Please treat this matter with the seriousness it deserves. Failure to rectify the above may result in
        further action being taken against you under the terms of your Tenancy Agreement, which may include
        termination of tenancy and forfeiture of deposit.
      </p>

      <div className="closing">
        Yours sincerely,
        <br />
        <br />
        <b>{COMPANY.NAME}</b>
      </div>
    </div>
  );
}
