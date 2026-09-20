/** Shared "formal document" look for printable internal reports (revenue/property/agent) —
 * same navy + Inter language as Invoice/Receipt/Payslip/Warning Letter, so a report printed to
 * PDF doesn't fall back to bare browser-default table styling (the print popup has no access
 * to the app's Tailwind stylesheet, only whatever CSS travels inside the printed HTML itself). */
export const REPORT_DOC_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.reportDoc{font-family:'Inter',Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#1e293b;}
.reportDoc .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #0f2a5c;padding-bottom:14px;margin-bottom:18px;gap:16px;}
.reportDoc .hd .brand{display:flex;align-items:center;gap:10px;}
.reportDoc .hd .brand img{height:44px;width:auto;}
.reportDoc .hd .nm{font-size:16px;font-weight:800;color:#0f2a5c;letter-spacing:.3px;}
.reportDoc .hd .sub{font-size:11px;color:#64748b;margin-top:3px;line-height:1.5;}
.reportDoc .hd .titleBlock{text-align:right;flex-shrink:0;}
.reportDoc .hd .title{font-size:19px;font-weight:800;letter-spacing:1px;color:#0f2a5c;}
.reportDoc .hd .titleMeta{font-size:11.5px;color:#475569;margin-top:4px;}
.reportDoc .statRow{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;}
.reportDoc .stat{flex:1;min-width:140px;background:linear-gradient(135deg,#0f2a5c,#1e4785);color:#fff;border-radius:10px;padding:14px 16px;}
.reportDoc .stat.alt{background:linear-gradient(135deg,#b45309,#d97706);}
.reportDoc .stat .n{font-size:24px;font-weight:800;}
.reportDoc .stat .l{font-size:11px;opacity:.85;margin-top:2px;}
.reportDoc h4{color:#0f2a5c;font-size:12px;font-weight:700;margin:18px 0 8px;letter-spacing:.5px;text-transform:uppercase;}
.reportDoc table{width:100%;border-collapse:collapse;margin-bottom:6px;}
.reportDoc table th{background:#0f2a5c;color:#fff;text-align:left;padding:8px 10px;font-size:11.5px;font-weight:700;}
.reportDoc table td{padding:7px 10px;border-bottom:1px solid #e3e7ee;font-size:12.5px;}
.reportDoc table td b{color:#0f2a5c;}
.reportDoc table .num{text-align:right;}
.reportDoc .summary{margin-top:10px;margin-left:auto;width:290px;}
.reportDoc .summary .row{display:flex;justify-content:space-between;padding:5px 10px;font-size:12.5px;color:#475569;}
.reportDoc .summary .row .neg{color:#dc2626;}
.reportDoc .summary .total{display:flex;justify-content:space-between;padding:9px 10px;font-weight:800;font-size:14.5px;background:#eef1f7;color:#0f2a5c;border-top:2px solid #0f2a5c;border-radius:0 0 6px 6px;}
.reportDoc .summary .total .neg{color:#dc2626;}
.reportDoc .empty{padding:22px;text-align:center;color:#94a3b8;}
`;
