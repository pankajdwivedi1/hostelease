/**
 * Official 1-Page A4 Hostel Admission & Disciplinary Undertaking PDF Generator
 * Exclusively for Hosteleaze Smart Campus Automation System
 * 
 * Features:
 * - Guaranteed single-page A4 portrait fit filling down to bottom margin
 * - Proportional line spacing & clause separation for maximum legibility
 * - Tenant college logo with automatic fallback to Hosteleaze "UVW" logo (/uvw_logo.jpg)
 * - Complete Undertaking text (Clauses 1 to 16, Preamble, Declarations)
 * - Complete Hostel Authority details (Dean Hostel & Respective Assigned Warden)
 * - Both sides text justification (flush right margin)
 * - Clean deduplication of hostel title for warden
 * - Crisp vector typography, native print & Save-as-PDF dialog
 */

import { formatDateDDMMYYYY } from "./dateFormat";

export interface UndertakingPDFData {
  studentProfile: any;
  wardenContactInfo?: { name: string; phone: string; designation?: string };
  deanContactInfo?: { name: string; phone: string; email?: string; designation?: string };
  hosteleazeId?: string;
  tenantLogo?: string;
  customWindow?: Window | null;
}

export function generateUndertakingPDF({
  studentProfile,
  wardenContactInfo,
  deanContactInfo,
  hosteleazeId,
  tenantLogo,
  customWindow
}: UndertakingPDFData): void {
  const printWindow = customWindow !== undefined ? customWindow : window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocker prevented opening the undertaking document. Please allow popups for Hosteleaze.");
    return;
  }

  const p = (studentProfile as any) || {};

  // Resolve Gender & Parent Relationship
  const rawGender = String(p.gender || p.sex || p.dynamicFields?.gender || p.dynamicFields?.sex || "").trim().toLowerCase();
  const isMale = rawGender.startsWith('m') || rawGender === 'male' || rawGender.includes('boy') || rawGender.includes('man');
  const isFemale = !isMale && (rawGender.startsWith('f') || rawGender === 'female' || rawGender.includes('girl') || rawGender.includes('woman'));
  
  let parentRelation = "S/o";
  if (isFemale) {
    parentRelation = "D/o";
  } else if (isMale) {
    parentRelation = "S/o";
  } else {
    const h = String(p.hostelName || p.hostel || "").toLowerCase();
    if (h.includes('gangotri') || h.includes('gaytri') || h.includes('gayatri') || h.includes('girls')) {
      parentRelation = "D/o";
    } else {
      parentRelation = "S/o";
    }
  }

  const resolvedName = p.name || p.fullName || "Student";
  const resolvedParent = p.fatherName || p.motherName || "Parent / Guardian";
  const resolvedCollege = p.collegeName || "Oriental Institute of Science & Technology (OIST)";
  const resolvedBranch = p.branch || "";
  const resolvedHostel = p.hostelName || p.hostel || "Hostel";
  const resolvedRoom = p.room || p.roomNumber || p.roomNo || "N/A";
  
  let resolvedEmail = p.email || "";
  if (!resolvedEmail && p.dynamicFields) {
    for (const [, v] of Object.entries(p.dynamicFields)) {
      if (typeof v === 'string' && v.includes('@') && v.includes('.')) {
        resolvedEmail = v;
        break;
      }
    }
  }
  const resolvedPhone = p.phoneNumber || p.phone || p.studentPhone || "N/A";
  const resolvedDate = p.joiningDate ? formatDateDDMMYYYY(p.joiningDate) : formatDateDDMMYYYY(new Date());
  const resolvedPlace = p.permanentAddress || p.homeState || "Bhopal";

  // ID Resolution
  const rawReg = (p.registrationId || "").trim();
  const isGuest = !rawReg || rawReg.toUpperCase().includes("GUEST") || rawReg.toUpperCase() === "SEC";
  const cleanReg = !isGuest 
    ? rawReg.replace(/^hostel[e|a]z?e[\s-_]*id[\s-_]*/i, "").trim() 
    : (isFemale ? "GIRLS-0001" : "BOYS-0001");
  const displayId = hosteleazeId || `Hosteleaze ID-${cleanReg}`;

  // Authority Contacts
  const deanName = deanContactInfo?.name || "Dr. Vijendra Singh";
  const deanDesig = deanContactInfo?.designation || "Dean Hostel";
  const deanPhone = deanContactInfo?.phone || "9981414729";
  const deanEmail = deanContactInfo?.email || "vijendrasinghthakur@oriental.ac.in";

  const wardenName = wardenContactInfo?.name || "Rahul Yadav";
  const rawWardenDesig = wardenContactInfo?.designation || "Hostel Warden";
  const wardenPhone = wardenContactInfo?.phone || "9039761287";

  // Clean deduplication for warden designation (avoids "GHB HOSTEL (GHB HOSTEL)")
  let wardenDisplayDesig = rawWardenDesig;
  if (resolvedHostel && !wardenDisplayDesig.toUpperCase().includes(resolvedHostel.toUpperCase())) {
    wardenDisplayDesig += ` (${resolvedHostel})`;
  }

  // Tenant Logo resolution with UVW default fallback
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const uvwFallbackLogo = `${origin}/uvw_logo.jpg`;
  const tenantLogoCandidate = (
    tenantLogo ||
    p.tenantLogo ||
    p.collegeLogo ||
    p.tenant?.logo ||
    p.tenant?.logoUrl ||
    (typeof window !== "undefined" ? (localStorage.getItem("lastTenantLogo") || localStorage.getItem("tenantLogo")) : null) ||
    ""
  ).trim();

  const resolvedLogo = tenantLogoCandidate
    ? (tenantLogoCandidate.startsWith("http") || tenantLogoCandidate.startsWith("/")
        ? tenantLogoCandidate
        : `${origin}/${tenantLogoCandidate}`)
    : uvwFallbackLogo;

  const docFilename = `Hosteleaze_Undertaking_${resolvedName.replace(/[^a-zA-Z0-9]/g, "_")}_${cleanReg}.pdf`;

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docFilename}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 7mm 10mm 7mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      font-size: 8.2pt;
      line-height: 1.38;
      -webkit-font-smoothing: antialiased;
    }
    @media print {
      html, body {
        background: #fff !important;
        padding: 0 !important;
        margin: 0 !important;
        height: 100% !important;
      }
      .no-print {
        display: none !important;
      }
      .sheet {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    .sheet {
      max-width: 790px;
      margin: 16px auto;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      padding: 22px 26px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .action-bar {
      max-width: 790px;
      margin: 12px auto 0;
      background: #0f172a;
      color: #fff;
      border-radius: 8px;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
    }
    .btn-print {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 9px 20px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11.5px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .btn-close {
      background: #334155;
      color: #fff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
    }
    .btn-close:hover {
      background: #475569;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 9px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-logo {
      width: 50px;
      height: 50px;
      object-fit: contain;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .inst-title {
      font-size: 14pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      line-height: 1.15;
    }
    .undertaking-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1e40af;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .inst-sub {
      font-size: 8pt;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
    }
    .badge-verified {
      background: #ecfdf5;
      border: 1px solid #10b981;
      color: #065f46;
      font-size: 8pt;
      font-weight: 900;
      padding: 3px 9px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
    }
    .badge-id {
      font-size: 9.5pt;
      font-weight: 900;
      color: #92400e;
      margin-top: 4px;
      letter-spacing: 0.5px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8.4pt;
      border: 1px solid #cbd5e1;
    }
    .info-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
      line-height: 1.35;
    }
    .info-label {
      font-weight: 700;
      color: #475569;
      background: #f8fafc;
      width: 15%;
    }
    .info-val {
      font-weight: 800;
      color: #0f172a;
      width: 35%;
    }
    .preamble {
      font-size: 8.8pt;
      font-weight: 600;
      line-height: 1.45;
      text-align: justify;
      text-justify: inter-word;
      color: #1e293b;
      margin: 0 0 10px 0;
      background: #f8fafc;
      border-left: 3px solid #2563eb;
      padding: 6px 10px;
      border-radius: 0 4px 4px 0;
    }
    .rules-list {
      margin: 0 0 10px 0;
      padding-left: 18px;
      font-size: 8.2pt;
      line-height: 1.42;
      color: #334155;
    }
    .rules-list li {
      margin-bottom: 5.5px;
      text-align: justify;
      text-justify: inter-word;
    }
    .decl-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 10px;
    }
    .decl-text {
      margin: 0 0 7px 0;
      font-size: 8.2pt;
      line-height: 1.4;
      font-style: italic;
      color: #1e293b;
      text-align: justify;
      text-justify: inter-word;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
    }
    .sig-col {
      flex: 1;
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      padding: 6px 10px;
      background: #fff;
    }
    .sig-label {
      font-size: 7.2pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .sig-name {
      font-size: 10.5pt;
      font-weight: 900;
      color: #1e3a8a;
      font-family: 'Courier New', monospace;
      margin: 3px 0;
    }
    .sig-sub {
      font-size: 7.2pt;
      color: #475569;
    }
    .contacts-box {
      border: 1.5px solid #2563eb;
      border-radius: 6px;
      padding: 8px 12px;
      background: #eff6ff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      margin-bottom: 8px;
    }
    .contact-col {
      flex: 1;
    }
    .contact-head {
      font-size: 7.5pt;
      font-weight: 800;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .contact-title {
      font-size: 8.8pt;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;
    }
    .contact-detail {
      font-size: 8pt;
      color: #1e40af;
    }
    .footer-bar {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <div>
      <strong style="font-size: 13px;">Hosteleaze • Official Hostel Admission Undertaking</strong>
      <div style="font-size: 10.5px; color: #94a3b8;">Formatted for 1-Page A4 PDF • Crisp Vector Text (Print or Save As PDF)</div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button class="btn-close" onclick="window.close()">✕ Close</button>
    </div>
  </div>

  <div class="sheet">
    <!-- Header -->
    <div class="header-box">
      <div class="header-left">
        <img class="header-logo" src="${resolvedLogo}" alt="College / Hosteleaze Logo" onerror="if (this.src !== '${uvwFallbackLogo}') { this.src = '${uvwFallbackLogo}'; }" />
        <div>
          <div class="inst-title">ORIENTAL GROUP OF INSTITUTES, BHOPAL</div>
          <div class="undertaking-title">HOSTEL ADMISSION & DISCIPLINARY UNDERTAKING</div>
          <div class="inst-sub">Hosteleaze Smart Campus Automation System • Academic Session 2024–2026</div>
        </div>
      </div>
      <div style="text-align: right; flex-shrink: 0;">
        <div class="badge-verified">✓ Digitally Accepted</div>
        <div class="badge-id">${displayId}</div>
      </div>
    </div>

    <!-- Student & Hostel Reference Grid -->
    <table class="info-table">
      <tbody>
        <tr>
          <td class="info-label">Student Name:</td>
          <td class="info-val">${resolvedName}</td>
          <td class="info-label">${parentRelation} Parent:</td>
          <td class="info-val">${resolvedParent}</td>
        </tr>
        <tr>
          <td class="info-label">Hostel & Room:</td>
          <td class="info-val">${resolvedHostel} (Room #${resolvedRoom})</td>
          <td class="info-label">College / Branch:</td>
          <td class="info-val">${resolvedCollege} ${resolvedBranch ? '• ' + resolvedBranch : ''}</td>
        </tr>
        <tr>
          <td class="info-label">Contact:</td>
          <td class="info-val">Mob: <strong>${resolvedPhone}</strong> • ${resolvedEmail}</td>
          <td class="info-label">Date & Place:</td>
          <td class="info-val"><strong>${resolvedDate}</strong> • Place: ${resolvedPlace}</td>
        </tr>
      </tbody>
    </table>

    <!-- Preamble -->
    <div class="preamble">
      I, <strong>${resolvedName}</strong>, ${parentRelation} <strong>${resolvedParent}</strong>, student of <strong>${resolvedCollege}</strong> (Email: ${resolvedEmail}, Mobile: ${resolvedPhone}), hereby undertake that I shall abide by the following terms and conditions governing my stay in the hostel:
    </div>

    <!-- The 16 Clauses (Numbered, Spacious & Justified) -->
    <ol class="rules-list">
      <li>I shall maintain discipline, decorum, and good conduct at all times within the hostel premises and shall not indulge in any act of indiscipline or misconduct.</li>
      <li>I shall not leave the hostel premises without obtaining prior permission from the competent authority, wherever applicable.</li>
      <li>I shall not keep or use any prohibited electrical or electronic appliances in the hostel. Any violation of this provision shall render me liable to disciplinary action as recommended by the Discipline Committee.</li>
      <li>I shall neither possess, consume, nor distribute any intoxicating substances, alcoholic beverages, tobacco, cigarettes, vaping devices, or any other smoking materials within the hostel premises. Violation of this condition may result in disciplinary action, including expulsion from the hostel.</li>
      <li>I shall neither engage in nor encourage ragging or any other form of harassment, bullying, or in disciplinary activity. I further undertake to immediately report any such incident to the hostel administration or the appropriate institutional authority.</li>
      <li>I shall strictly comply with all the rules, regulations, instructions, and guidelines issued by the hostel administration and the mess management from time to time.</li>
      <li>I shall not permit any unauthorized person or non-hosteller to stay in or occupy my hostel room without prior written permission from the hostel administration.</li>
      <li>I acknowledge that I am solely responsible for the safety and security of my personal belongings, cash, valuables, and other possessions. The institution and hostel administration shall not be held liable for any loss, theft, or damage to the same.</li>
      <li>I undertake to promptly inform the institution of any change in my residential address, contact details, or the contact details of my parent(s)/guardian(s).</li>
      <li>A student securing less than 75% attendance in any two semesters shall not be eligible for hostel admission or renewal of hostel accommodation for the subsequent academic session.</li>
      <li>The hostel allotment shall remain valid only up to 30 June of the respective academic session unless otherwise notified by the institution.</li>
      <li>In the event of vacating the hostel before the completion of the academic session, I shall be liable to pay the full hostel fee for the entire academic year and mess charges up to the month in which I vacate the hostel. The hostel fee shall be non-refundable under any circumstances.</li>
      <li>The hostel administration reserves the absolute right to change, shift, or reassign my hostel room at any time in the interest of administration, discipline, maintenance, or any other institutional requirement.</li>
      <li>I understand and agree that the hostel fee is subject to revision from the subsequent academic session as determined by the competent authority of the institution.</li>
      <li>I further undertake to comply with any additional rules, regulations, or instructions issued by the institution or hostel administration from time to time. Failure to comply with any of the above conditions may result in disciplinary action, including suspension or cancellation of hostel accommodation, without prejudice to any other action deemed appropriate by the institution.</li>
      <li>I will not remain in hostel room during the class hours, without any valid reason. In case there is a reason, the warden will be informed by me. In case I fail to do so, action may be taken against me.</li>
    </ol>

    <!-- Declaration & Signatures -->
    <div class="decl-box">
      <div class="decl-text">
        I hereby declare that I have carefully read, understood, and accepted all the above terms and conditions. I agree to abide by them throughout my stay in the hostel.
      </div>
      <div class="sig-row">
        <div class="sig-col">
          <div class="sig-label">Student Digital Signature</div>
          <div class="sig-name">✓ ${resolvedName}</div>
          <div class="sig-sub">Date: <strong>${resolvedDate}</strong> • Place: ${resolvedPlace}</div>
        </div>
        <div class="sig-col">
          <div class="sig-label">Parent / Guardian Certification</div>
          <div class="sig-name">✓ ${resolvedParent}</div>
          <div class="sig-sub">Certified: Ward will abide by hostel terms • Date: <strong>${resolvedDate}</strong></div>
        </div>
      </div>
    </div>

    <!-- Official Contacts (Dean & Respective Assigned Hostel Warden) -->
    <div class="contacts-box">
      <div class="contact-col">
        <div class="contact-head">Hostel Administration & Grievances</div>
        <div class="contact-title">${deanName} (${deanDesig})</div>
        <div class="contact-detail">Mob: <strong>${deanPhone}</strong> • Email: ${deanEmail}</div>
      </div>
      <div class="contact-col" style="border-left: 1px solid #bfdbfe; padding-left: 14px;">
        <div class="contact-head">Respective Hostel Warden</div>
        <div class="contact-title">${wardenName} - ${wardenDisplayDesig}</div>
        <div class="contact-detail">Mob: <strong>${wardenPhone}</strong></div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-bar">
      <div>Certified Computer-Generated Record • <strong>Hosteleaze Smart Campus Platform</strong></div>
      <div>Document ID: <strong>${displayId}</strong> • Legally Binding Onboarding Archive</div>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog after layout stabilizes
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }, 350);
    });
  </script>
</body>
</html>`);

  printWindow.document.close();
}
