"use client";

import { TERMS, RULES, NOTICE_TITLES, utilExcludedItems } from "@/lib/contractContent";
import { COMPANY, CONTRACT_IMAGES } from "@/lib/config";
import { fmtMoney, fmtDate } from "@/lib/format";

export interface AgreementContract {
  contractCode: string;
  propertyAddress: string | null;
  tenantName: string;
  tenantIc: string | null;
  agentName: string;
  agentIc: string | null;
  room: { roomCode: string };
  moveInDate: string | null;
  commencementDate: string | null;
  expiredDate: string | null;
  tenureMonths: number | null;
  roomRental: number;
  carparkRental: number;
  securityDeposit: number;
  utilitiesDeposit: number;
  earnestDeposit: number;
  accessCardDeposit: number;
  adminFee: number;
  totalOutstanding: number;
  remarks: string | null;
  nationality: string | null;
  contactNumber: string | null;
  email: string | null;
  occupation: string | null;
  company: string | null;
  carPlate: string | null;
  emergencyName: string | null;
  emergencyContact: string | null;
  emergencyRelationship: string | null;
  utilDryer: boolean;
  utilAircond: boolean;
  utilElectric: boolean;
  icFront: string | null;
  icBack: string | null;
  agentSignature: string | null;
  agentSignDate: string | null;
  tenantSignature: string | null;
  tenantSignDate: string | null;
}

const DOC_STYLE = `
.contractDoc{font-family:"Times New Roman",Georgia,serif;font-size:12.5px;line-height:1.6;color:#1a1a1a;}
.contractDoc .hd{text-align:center;border-bottom:2.5px solid #0b5394;padding-bottom:12px;margin-bottom:6px;}
.contractDoc .hd .nm{font-size:20px;font-weight:700;letter-spacing:1px;color:#0b5394;}
.contractDoc .hd .meta{font-size:10.5px;color:#555;line-height:1.5;margin-top:4px;}
.contractDoc h2{text-align:center;font-size:15px;font-weight:700;letter-spacing:1.5px;margin:24px 0 10px;padding:6px 0;border-top:1.5px solid #0b5394;border-bottom:1.5px solid #0b5394;color:#0b5394;background:#f4f8fc;}
.contractDoc table{width:100%;border-collapse:collapse;margin:10px 0;}
.contractDoc td,.contractDoc th{border:1px solid #999;padding:7px 10px;font-size:12px;vertical-align:top;}
.contractDoc td.lbl{background:#eef4fa;font-weight:600;width:180px;}
.contractDoc p{margin:9px 0;text-align:justify;}
.contractDoc ol{list-style-type:decimal;list-style-position:outside;padding-left:26px;margin:10px 0;}
.contractDoc ol>li{display:list-item;margin-bottom:10px;text-align:justify;padding-left:4px;}
.contractDoc ul{list-style-type:disc;list-style-position:outside;margin:8px 0;padding-left:24px;}
.contractDoc ul>li{display:list-item;margin-bottom:6px;text-align:justify;padding-left:4px;}
.contractDoc .sigrow{display:flex;gap:60px;margin-top:34px;margin-bottom:10px;}
.contractDoc .sigrow>div{flex:1;}
.contractDoc .sigbox table td{border:none;padding:2px 4px;font-size:12px;}
.contractDoc .small{font-size:10.5px;color:#444;}
.contractDoc .appx-item{border:1px solid #bbb;border-radius:5px;padding:12px 14px;margin-top:14px;background:#fafbfc;}
.contractDoc .np{text-align:center;color:#b0b0b0;font-size:10px;letter-spacing:2px;border-top:2px dashed #d0d7e2;margin:34px 0 0;padding-top:6px;}
@media print{.contractDoc .np{display:none;}}
`;

function Sig({ name, ic, img, date, role }: { name: string; ic: string | null; img: string | null; date: string | null; role: string }) {
  return (
    <div className="sigbox">
      <div style={{ marginBottom: img ? 6 : 26 }}>
        Signature :{" "}
        {img ? <img src={img} alt="signature" style={{ maxHeight: 50 }} /> : "______________________"}
      </div>
      <table>
        <tbody>
          <tr>
            <td style={{ width: 95 }}>Name</td>
            <td>: {name || ""}</td>
          </tr>
          <tr>
            <td>IC/Passport</td>
            <td>: {ic || ""}</td>
          </tr>
          <tr>
            <td>Date</td>
            <td>: {img ? fmtDate(date) : ""}</td>
          </tr>
        </tbody>
      </table>
      <div className="small" style={{ marginTop: 4 }}>
        ({role})
      </div>
    </div>
  );
}

export default function AgreementDocument({ c }: { c: AgreementContract }) {
  const utilItems = utilExcludedItems(c);
  const NP = <div className="np">— NEW PAGE 新的一页 —</div>;

  return (
    <div className="contractDoc">
      <style>{DOC_STYLE}</style>

      <div className="hd">
        {CONTRACT_IMAGES.logo && <img src={CONTRACT_IMAGES.logo} alt="logo" style={{ maxHeight: 70, marginBottom: 6 }} />}
        <div className="nm">{COMPANY.NAME}</div>
        <div className="meta">
          Reg. No.: {COMPANY.REG_NO}
          <br />
          {COMPANY.ADDRESS}
          <br />
          TEL: {COMPANY.TEL} &nbsp;·&nbsp; {COMPANY.EMAIL}
        </div>
      </div>

      {/* ===== LETTER OF CONFIRMATION ===== */}
      <h2>LETTER OF CONFIRMATION FOR RENT</h2>
      <p>
        By executing this Letter of Confirmation, both Tenant(s) and Landlord(s) unequivocally agree that the
        entire terms and conditions of this Letter shall be read collaboratively to be applicable to both parties.
      </p>
      <table>
        <tbody>
          <tr>
            <td style={{ width: 200 }}>
              <b>Property Address</b>
            </td>
            <td>{c.propertyAddress}</td>
          </tr>
          <tr>
            <td>
              <b>Tenant Name</b>
            </td>
            <td>{c.tenantName}</td>
          </tr>
          <tr>
            <td>
              <b>NRIC/Passport No.</b>
            </td>
            <td>{c.tenantIc}</td>
          </tr>
        </tbody>
      </table>
      <p>
        I / We have inspected the above property and hereby offer to rent the said property with the following
        terms &amp; conditions:
      </p>
      <table>
        <tbody>
          <Row label="Advance Rental for one month" value={fmtMoney(c.roomRental)} />
          <Row label="Security Deposit" value={fmtMoney(c.securityDeposit)} />
          <Row label="Utility Deposit (Electricity, Water & Sewerage)" value={fmtMoney(c.utilitiesDeposit)} />
          <Row label="Admin Fee (Non-refundable)" value={fmtMoney(c.adminFee)} />
          <Row label="Access Card & Car Park Deposit" value={fmtMoney(c.accessCardDeposit)} />
          <tr>
            <td>
              <b>Total Outstanding to be paid before handover of keys</b>
            </td>
            <td style={{ textAlign: "right" }}>
              <b>{fmtMoney(c.totalOutstanding)}</b>
            </td>
          </tr>
          <Row label="Period of Tenancy" value={`${c.tenureMonths || ""} month(s)`} />
          <Row label="Commencement Date" value={fmtDate(c.commencementDate)} />
        </tbody>
      </table>
      <p style={{ fontSize: 11 }}>
        Legal fees: Tenant to bear all costs incurred in the preparation and stamping of the Tenancy Agreement.
        Vacant Possession shall be upon payment of Total Outstanding. The Tenant is to execute the TA within 14
        working days from the date of Landlord’s acceptance, failing which ONLY the Earnest Deposit shall be
        forfeited. The Tenant acknowledges that the Earnest Deposit is non-refundable and shall be forfeited to the
        Landlord if the Tenant fails to fulfil their obligations under this agreement.
      </p>
      <p style={{ fontSize: 11 }}>
        All signatories agree to comply with the Malaysia Anti-Corruption Commission Act 2009 (Section 17A) and the
        Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act.
      </p>
      <table>
        <tbody>
          <Row label="Beneficiary Name" value={COMPANY.NAME} />
          <Row label="Bank Name" value={COMPANY.BANK} />
          <Row label="Account Number" value={COMPANY.ACC_NO} />
        </tbody>
      </table>
      <div className="sigrow">
        <Sig name={c.tenantName} ic={c.tenantIc} img={c.tenantSignature} date={c.tenantSignDate} role="Tenant" />
        <Sig name={c.agentName} ic={c.agentIc} img={c.agentSignature} date={c.agentSignDate} role="Negotiator" />
      </div>

      {NP}

      {/* ===== TENANCY AGREEMENT ===== */}
      <h2 style={{ pageBreakBefore: "always" }}>TENANCY AGREEMENT</h2>
      <table>
        <tbody>
          <tr>
            <td>
              <b>Move-in Date</b>
            </td>
            <td>{fmtDate(c.moveInDate)}</td>
            <td>
              <b>Room Code</b>
            </td>
            <td>{c.room.roomCode}</td>
          </tr>
          <tr>
            <td>
              <b>Property Address</b>
            </td>
            <td colSpan={3}>{c.propertyAddress}</td>
          </tr>
          <tr>
            <td>
              <b>Commencement Date</b>
            </td>
            <td>{fmtDate(c.commencementDate)}</td>
            <td>
              <b>Expired Date</b>
            </td>
            <td>{fmtDate(c.expiredDate)}</td>
          </tr>
          <tr>
            <td>
              <b>Tenure</b>
            </td>
            <td>{c.tenureMonths || ""} month(s)</td>
            <td>
              <b>Carpark Rental</b>
            </td>
            <td>{fmtMoney(c.carparkRental)}</td>
          </tr>
          <tr>
            <td>
              <b>Room Rental</b>
            </td>
            <td>{fmtMoney(c.roomRental)}</td>
            <td>
              <b>Access Card Deposit</b>
            </td>
            <td>{fmtMoney(c.accessCardDeposit)}</td>
          </tr>
          <tr>
            <td>
              <b>Security Deposit</b>
            </td>
            <td>{fmtMoney(c.securityDeposit)}</td>
            <td>
              <b>Utilities Deposit</b>
            </td>
            <td>{fmtMoney(c.utilitiesDeposit)}</td>
          </tr>
          <tr>
            <td>
              <b>Earnest Deposit (= 1st month Rental)</b>
            </td>
            <td>{fmtMoney(c.earnestDeposit)}</td>
            <td>
              <b>Admin Fee</b>
            </td>
            <td>{fmtMoney(c.adminFee)}</td>
          </tr>
        </tbody>
      </table>
      {c.remarks && (
        <p>
          <b>Remarks:</b> {c.remarks}
        </p>
      )}
      <p>
        <b>TERMS:</b>
      </p>
      <ol>
        {TERMS.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
        <li>
          The monthly rental shall include utilities such as water and electricity (subject to a fair usage
          policy), WiFi, and bi-weekly cleaning of common areas within the premises. However, the following items
          are excluded from the rental and shall be charged separately:
          {utilItems.length > 0 && (
            <ul>
              {utilItems.map((u, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <b>{u.label}</b> {u.text}
                </li>
              ))}
            </ul>
          )}
          The Tenant agrees to pay for the above excluded items monthly or as otherwise determined by the Landlord,
          in accordance with the actual usage and cost-sharing formula stated above.
        </li>
      </ol>
      <div className="sigrow">
        <Sig name={c.tenantName} ic={c.tenantIc} img={c.tenantSignature} date={c.tenantSignDate} role="Tenant" />
        <Sig name={c.agentName} ic={c.agentIc} img={c.agentSignature} date={c.agentSignDate} role="Negotiator" />
      </div>
      <p style={{ fontSize: 11 }}>
        In the event that the Tenant is less than 18 years old, the Tenant’s guardian shall execute this Agreement
        and shall be personally liable for all breaches of the Tenant.
      </p>

      {NP}

      {/* ===== HOUSE RULES ===== */}
      <h2 style={{ pageBreakBefore: "always" }}>HOUSE RULES</h2>
      <p>
        House Rules for the Tenants to adopt to ensure all residents may enjoy a clean, safe and quiet environment.
      </p>
      <ol>
        {RULES.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>
      <p style={{ fontSize: 11 }}>
        In case of any violation of the House Rules, {COMPANY.NAME} reserves the right to send the Tenant a written
        warning letter, as well as the right to terminate the agreement immediately, with or without the deposits
        (including the Security Deposit and Utility Deposit) refunded. {COMPANY.NAME} will launch a police report
        for any suspicious illegal activity found.
      </p>
      <p style={{ marginTop: 18 }}>
        <i>I hereby agree as Tenant of the room and premise,</i>
      </p>
      <div className="sigrow">
        <Sig name={c.tenantName} ic={c.tenantIc} img={c.tenantSignature} date={c.tenantSignDate} role="Tenant" />
        <div />
      </div>

      {NP}

      {/* ===== TENANT PERSONAL PARTICULARS ===== */}
      <h2 style={{ pageBreakBefore: "always" }}>TENANT PERSONAL PARTICULARS</h2>
      <p style={{ textAlign: "center", fontSize: 11, color: "#555", marginTop: -2 }}>租客个人资料</p>
      <p style={{ fontWeight: 700, marginTop: 8 }}>PERSONAL DETAILS 个人资料</p>
      <table>
        <tbody>
          <tr>
            <td className="lbl">
              <b>Tenant Name</b>
            </td>
            <td>{c.tenantName}</td>
            <td className="lbl">
              <b>NRIC/Passport</b>
            </td>
            <td>{c.tenantIc}</td>
          </tr>
          <tr>
            <td className="lbl">
              <b>Nationality</b>
            </td>
            <td>{c.nationality}</td>
            <td className="lbl">
              <b>Contact Number</b>
            </td>
            <td>{c.contactNumber}</td>
          </tr>
          <tr>
            <td className="lbl">
              <b>Email</b>
            </td>
            <td>{c.email}</td>
            <td className="lbl">
              <b>Occupation</b>
            </td>
            <td>{c.occupation}</td>
          </tr>
          <tr>
            <td className="lbl">
              <b>Company/University</b>
            </td>
            <td>{c.company}</td>
            <td className="lbl">
              <b>Car Number Plate</b>
            </td>
            <td>{c.carPlate}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontWeight: 700, marginTop: 12 }}>EMERGENCY CONTACT 紧急联络人</p>
      <table>
        <tbody>
          <tr>
            <td className="lbl">
              <b>Name</b>
            </td>
            <td>{c.emergencyName}</td>
            <td className="lbl">
              <b>Contact Number</b>
            </td>
            <td>{c.emergencyContact}</td>
          </tr>
          <tr>
            <td className="lbl">
              <b>Relationship</b>
            </td>
            <td colSpan={3}>{c.emergencyRelationship}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontWeight: 700, marginTop: 12 }}>IC / PASSPORT COPY 身份证副本</p>
      <div style={{ display: "flex", gap: 12 }}>
        <ICBox label="正面 Front" url={c.icFront} />
        <ICBox label="背面 Back" url={c.icBack} />
      </div>
      <div className="sigrow">
        <Sig name={c.tenantName} ic={c.tenantIc} img={c.tenantSignature} date={c.tenantSignDate} role="Tenant" />
        <Sig name={c.agentName} ic={c.agentIc} img={c.agentSignature} date={c.agentSignDate} role="Negotiator" />
      </div>

      {NP}

      {/* ===== APPENDIX ===== */}
      <h2 style={{ pageBreakBefore: "always" }}>APPENDIX — HOUSE RULES &amp; PROPERTY NOTICES</h2>
      <p>
        The following notices form an integral part of the House Rules of this Tenancy. By signing each section
        below, the Tenant confirms that he/she has read, understood and agrees to comply with every notice
        contained herein.
      </p>
      <p>
        <b>Contents:</b>
      </p>
      <ol>
        {NOTICE_TITLES.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ol>
      {NOTICE_TITLES.map((n, i) => (
        <div className="appx-item" key={i} style={{ pageBreakInside: "avoid" }}>
          <div style={{ fontWeight: 700 }}>
            {i + 1}. {n}
          </div>
          {CONTRACT_IMAGES.notices[i] && (
            <div style={{ textAlign: "center", margin: "8px 0" }}>
              <img src={CONTRACT_IMAGES.notices[i]} alt={n} style={{ maxWidth: "100%", border: "1px solid #ccc" }} />
            </div>
          )}
          <p className="small" style={{ fontStyle: "italic" }}>
            I have read, understood and agree to comply with the above.
          </p>
          <div style={{ marginTop: 14 }}>
            Tenant Signature:{" "}
            {c.tenantSignature ? (
              <img src={c.tenantSignature} alt="signature" style={{ maxHeight: 40, verticalAlign: "middle" }} />
            ) : (
              "____________________________"
            )}
            &nbsp;&nbsp; Date: {c.tenantSignature ? fmtDate(c.tenantSignDate) : "____________"}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={{ textAlign: "right", width: 120 }}>{value}</td>
    </tr>
  );
}

function ICBox({ label, url }: { label: string; url: string | null }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div className="small">{label}</div>
      {url ? (
        <img src={url} alt={label} style={{ maxWidth: "100%", maxHeight: 200, border: "1px solid #ccc" }} />
      ) : (
        <div
          style={{
            border: "1px dashed #aaa",
            borderRadius: 4,
            height: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            fontSize: 11,
          }}
        >
          未上传
        </div>
      )}
    </div>
  );
}
