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
  isCarpark: boolean;
}

const DOC_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.warningDoc{font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#1e293b;}
.warningDoc .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #0f2a5c;padding-bottom:14px;margin-bottom:16px;gap:16px;}
.warningDoc .hd .brand{display:flex;align-items:center;gap:10px;}
.warningDoc .hd .brand img{height:48px;width:auto;}
.warningDoc .hd .nm{font-size:16px;font-weight:700;color:#0f2a5c;}
.warningDoc .hd .meta{font-size:10px;color:#555;line-height:1.5;margin-top:3px;}
.warningDoc .hd .titleBlock{text-align:right;flex-shrink:0;}
.warningDoc .hd .title{font-size:22px;font-weight:800;letter-spacing:1.5px;color:#0f2a5c;}
.warningDoc .hd .titleMeta{font-size:11.5px;color:#333;line-height:1.6;margin-top:4px;}
.warningDoc .hd .titleMeta b{color:#0f2a5c;}
.warningDoc .ribbon{display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#fef3c7,#fde68a);border-left:4px solid #d97706;color:#92400e;font-weight:700;font-size:12px;letter-spacing:.5px;padding:8px 14px;border-radius:0 6px 6px 0;margin-bottom:18px;}
.warningDoc .toBlock{margin:18px 0;font-size:12.5px;}
.warningDoc .subjectBox{margin-top:10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:0 6px 6px 0;padding:9px 13px;font-weight:600;color:#7f1d1d;}
.warningDoc .body{margin:18px 0;}
.warningDoc .heading{color:#0f2a5c;font-weight:700;font-size:13.5px;margin:16px 0 6px;padding-bottom:3px;border-bottom:2px solid #d97706;display:inline-block;}
.warningDoc .para{text-align:justify;margin:0 0 12px;}
.warningDoc .warnList{margin:0 0 14px;padding-left:0;list-style:none;}
.warningDoc .warnList li{position:relative;padding-left:20px;margin-bottom:6px;}
.warningDoc .warnList li::before{content:"▸";position:absolute;left:0;color:#dc2626;font-weight:700;}
.warningDoc .noticeBox{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:12px 14px;margin:16px 0;color:#374151;}
.warningDoc .closing{margin-top:30px;padding-top:14px;border-top:1.5px solid #e2e8f0;}
.warningDoc .closing b{color:#0f2a5c;}
`;

const isBulletLine = (ln: string) => /^[•\-]\s*/.test(ln);
const isHeadingLine = (ln: string) => ln.length <= 55 && !/[.,:;]$/.test(ln);

function bulletList(lines: string[], key: number | string) {
  return (
    <ul className="warnList" key={key}>
      {lines.map((ln, j) => (
        <li key={j}>{ln.replace(/^[•\-]\s*/, "")}</li>
      ))}
    </ul>
  );
}

/** Parses the free-text message into paragraphs/short headings/bullet lists so a long warning
 * letter doesn't read as one flat wall of text — Admin still just types plain text (no markup),
 * this only adds visual structure on top of blank-line-separated blocks. */
function renderBody(message: string) {
  const blocks = message.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  return blocks.map((block, i) => {
    const lines = block.split("\n").map((ln) => ln.trim()).filter(Boolean);

    if (lines.every(isBulletLine)) {
      return bulletList(lines, i);
    }

    // An intro sentence immediately followed by a bullet list, with no blank line separating
    // them (e.g. "...proceed with the following actions:\n• Block...\n• Change...") — a very
    // common shape for these letters, so it gets its own case rather than falling through to
    // one flat paragraph with the bullets stuck inline.
    const bulletStart = lines.findIndex(isBulletLine);
    if (bulletStart > 0 && lines.slice(bulletStart).every(isBulletLine)) {
      const intro = lines.slice(0, bulletStart);
      return (
        <div key={i}>
          {intro.length === 1 && isHeadingLine(intro[0]) ? (
            <div className="heading">{intro[0]}</div>
          ) : (
            <p className="para">{intro.join(" ")}</p>
          )}
          {bulletList(lines.slice(bulletStart), `${i}-list`)}
        </div>
      );
    }

    if (lines.length > 1 && isHeadingLine(lines[0])) {
      return (
        <div key={i}>
          <div className="heading">{lines[0]}</div>
          <p className="para">{lines.slice(1).join(" ")}</p>
        </div>
      );
    }
    if (lines.length === 1 && isHeadingLine(lines[0])) {
      return (
        <div className="heading" key={i}>
          {lines[0]}
        </div>
      );
    }

    return (
      <p className="para" key={i}>
        {lines.join(" ")}
      </p>
    );
  });
}

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
            {l.isCarpark ? "Car Park Code" : "Room Code"}: <b>{l.roomCode}</b>
          </div>
        </div>
      </div>

      <div className="ribbon">⚠️ FORMAL WARNING NOTICE — PLEASE READ CAREFULLY</div>

      <div className="toBlock">
        To: <b>{l.tenantName}</b>
        {l.tenantIc && (
          <>
            <br />
            NRIC/Passport: {l.tenantIc}
          </>
        )}
        <div className="subjectBox">
          Re: Warning Letter — {l.isCarpark ? "Car Park Code" : "Room Code"}: {l.roomCode}
          {l.propertyAddress && (
            <>
              <br />
              Property Address: {l.propertyAddress}
            </>
          )}
        </div>
      </div>

      <p>Dear {l.tenantName},</p>
      <div className="body">{renderBody(l.message)}</div>

      <div className="noticeBox">
        Please treat this matter with the seriousness it deserves. Failure to rectify the above may result in
        further action being taken against you under the terms of your Tenancy Agreement, which may include
        termination of tenancy and forfeiture of deposit.
      </div>

      <div className="closing">
        Yours sincerely,
        <br />
        <br />
        <b>{COMPANY.NAME}</b>
      </div>
    </div>
  );
}
