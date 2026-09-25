/**
 * Unified Official Tax Invoice PDF Generator for Hosteleaze
 * Used identically across:
 * - SuperAdmin Boss Control Dashboard
 * - College Tenant Admin / Super Admin Dashboard
 * - Tenant Expiry Guard & Lockout Screen
 * - Subscription & Billing Tab
 */

export interface CollegeInvoiceDetails {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  contactName?: string;
  contactPhone?: string;
  gstin?: string;
}

import { formatDateDDMMYYYY } from "./dateFormat";

export function generateOfficialInvoicePDF(
  tx: any,
  fallbackCollegeInfo?: CollegeInvoiceDetails,
  customWindow?: Window | null
): void {
  const printWindow = customWindow !== undefined ? customWindow : window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocker prevented opening invoice. Please allow popups for this site.");
    return;
  }

  const paymentDateObj = new Date(tx.date || Date.now());
  const formattedDate = formatDateDDMMYYYY(paymentDateObj);
  const formattedTime = paymentDateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  const fullDateTimeStr = `${formattedDate} • ${formattedTime} IST`;
  const invoiceNo = (tx.id || "tx_invoice")
    .replace("tx_", "INV-")
    .replace("dir_", "INV-DIR-")
    .toUpperCase();

  // ⚡ 1. Strictly use immutable snapshot saved on Cloudflare R2
  const studentCount = Number(tx.studentCount) > 0 ? Number(tx.studentCount) : 500;
  const months = tx.months || (
    tx.billingPeriod?.includes("1 Month") ? 1 :
    tx.billingPeriod?.includes("3") ? 3 :
    tx.billingPeriod?.includes("6") ? 6 :
    tx.billingPeriod?.includes("2 Year") ? 24 :
    tx.billingPeriod?.includes("3 Year") ? 36 : 12
  );
  const ratePerStudentMonth = Number(tx.ratePerStudentMonth) > 0 ? Number(tx.ratePerStudentMonth) : 30;
  const grossBase = (tx.grossBase !== undefined && Number(tx.grossBase) > 0)
    ? Number(tx.grossBase)
    : (studentCount * ratePerStudentMonth * months);

  const methodRaw = (tx.paymentMethod || tx.billingType || tx.paymentSource || tx.remarks || "").toString();
  let paymentMethodText = "Direct Bank Transfer (UTR Verified)";
  if (methodRaw.toLowerCase().includes("upi")) {
    paymentMethodText = "UPI Transfer (UTR Verified)";
  } else if (methodRaw.toLowerCase().includes("razorpay") || tx.id?.includes("rzp")) {
    paymentMethodText = "Razorpay (Instant Online Renewal)";
  } else if (methodRaw.toLowerCase().includes("direct bank") || methodRaw.toLowerCase().includes("bank") || methodRaw.toLowerCase().includes("direct") || methodRaw.toLowerCase().includes("verified payment")) {
    paymentMethodText = "Direct Bank Transfer (UTR Verified)";
  } else {
    paymentMethodText = "Direct Bank Transfer (UTR Verified)";
  }
  const isDirectTransfer = paymentMethodText.toLowerCase().includes("direct") || paymentMethodText.toLowerCase().includes("bank");

  // Standard discount rule % from stored snapshot or default tier
  let standardDiscountPercent = tx.standardDiscountPercent !== undefined ? Number(tx.standardDiscountPercent) :
    tx.discountPercent !== undefined ? Number(tx.discountPercent) : 
    (months === 1 ? 0 : months === 3 ? 20 : months === 6 ? 30 : 40) + (isDirectTransfer ? 3 : 0);

  const standardDiscountAmount = tx.standardDiscountAmount !== undefined 
    ? Number(tx.standardDiscountAmount) 
    : Math.round(grossBase * (standardDiscountPercent / 100));

  // Extra discount added via BOSS CONTROL DASHBOARD (Direct ₹ Amount or % Wise)
  let extraDiscountAmount = 0;
  let extraDiscountPercent = 0;

  if (tx.extraDiscountType === "amount" || (tx.extraDiscountAmount && Number(tx.extraDiscountAmount) > 0)) {
    extraDiscountAmount = Number(tx.extraDiscountAmount || tx.extraDiscountValue || 0);
    extraDiscountPercent = grossBase > 0 ? Number(((extraDiscountAmount / grossBase) * 100).toFixed(1)) : 0;
  } else if (tx.extraDiscountPercent && Number(tx.extraDiscountPercent) > 0) {
    extraDiscountPercent = Number(tx.extraDiscountPercent);
    extraDiscountAmount = Math.round(grossBase * (extraDiscountPercent / 100));
  }

  const calculatedDiscounts = standardDiscountAmount + extraDiscountAmount;
  const netCalculated = Math.max(0, grossBase - calculatedDiscounts);
  const finalPaid = (tx.amount !== undefined && Number(tx.amount) >= 0) ? Number(tx.amount) : netCalculated;

  // Derive accurate discount display
  const totalDiscountAmount = tx.totalDiscountAmount !== undefined && Number(tx.totalDiscountAmount) > 0
    ? Number(tx.totalDiscountAmount)
    : Math.max(0, grossBase - finalPaid);

  const totalDiscountPercent = grossBase > 0
    ? Math.round((totalDiscountAmount / grossBase) * 100)
    : (standardDiscountPercent + extraDiscountPercent);

  const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/logo.jpeg` : "/logo.jpeg";

  // Client Details resolution with consistent defaults
  const clientName = tx.collegeDetails?.name || tx.tenantName || fallbackCollegeInfo?.name || "Oriental Group of Institutes (OGI)";
  const clientAddress = tx.collegeDetails?.address || fallbackCollegeInfo?.address || "Oriental Campus, Raisen Road, Bhopal, MP - 462021";
  const clientEmail = tx.collegeDetails?.email || fallbackCollegeInfo?.email || "pankajdwivedi81@gmail.com";
  const clientPhone = tx.collegeDetails?.phone || fallbackCollegeInfo?.phone || "+91 9981414729 / 0755-2529015";
  const clientCoordinator = tx.collegeDetails?.contactName || fallbackCollegeInfo?.contactName || "Dr Pankaj Dwivedi";
  const clientCoordinatorPhone = tx.collegeDetails?.contactPhone || fallbackCollegeInfo?.contactPhone || "7974704918";
  const clientGstin = tx.collegeDetails?.gstin || fallbackCollegeInfo?.gstin || "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hosteleaze Tax Invoice ${invoiceNo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 10mm;
          }
          * { box-sizing: border-box; }
          body, table, th, td, h1, h2, h3, h4, p, div, span, button {
            font-family: 'Cambria Math', Cambria, Georgia, serif !important;
          }
          body {
            font-family: 'Cambria Math', Cambria, Georgia, serif !important;
            margin: 0;
            padding: 16px;
            color: #0f172a;
            line-height: 1.35;
            background: #f8fafc;
          }
          .invoice-box {
            max-width: 760px;
            margin: auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px 28px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 16px;
            margin-bottom: 18px;
          }
          .brand-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .brand-logo {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            object-fit: cover;
          }
          .logo-text {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #0f172a;
          }
          .logo-text span {
            color: #4f46e5;
          }
          .brand-sub {
            font-size: 10px;
            font-weight: 600;
            color: #64748b;
          }
          .title {
            text-align: right;
          }
          .title h1 {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .title-no {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            margin: 2px 0 0 0;
          }
          .details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 18px;
            background: #f8fafc;
            padding: 14px 18px;
            border-radius: 10px;
            border: 1px solid #f1f5f9;
          }
          .details h3 {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #64748b;
            margin: 0 0 6px 0;
            font-weight: 800;
          }
          .meta-bar {
            display: flex;
            justify-content: space-between;
            background: #eef2ff;
            border: 1px solid #c7d2fe;
            padding: 12px 18px;
            border-radius: 10px;
            margin-bottom: 18px;
          }
          .meta-bar h3 {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #4338ca;
            margin: 0 0 4px 0;
            font-weight: 800;
          }
          .meta-bar p {
            margin: 0;
            font-size: 13px;
            font-weight: 800;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
          }
          .table th {
            background: #f1f5f9;
            padding: 10px 12px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #475569;
            font-weight: 800;
            border-bottom: 1px solid #e2e8f0;
          }
          .table td {
            padding: 12px;
            font-size: 12px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
          }
          .total-box {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 18px;
          }
          .total-table {
            width: 280px;
            border-collapse: collapse;
          }
          .total-table td {
            padding: 6px 12px;
            font-size: 11px;
            color: #475569;
            font-weight: 600;
          }
          .total-table td:last-child {
            text-align: right;
            font-weight: 800;
          }
          .total-table .grand-total td {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            border-top: 2px solid #e2e8f0;
            padding-top: 10px;
          }
          .savings-badge {
            background: #fdf2f8;
            border: 1px solid #fbcfe8;
            color: #be185d;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 800;
            text-align: center;
            margin-bottom: 8px;
          }
          .audit-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 18px;
          }
          .footer {
            text-align: center;
            border-top: 1px solid #f1f5f9;
            padding-top: 14px;
            color: #64748b;
          }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; background: #fff; }
            .invoice-box { border: none; box-shadow: none; padding: 0; margin: 0; width: 100%; max-width: 100%; }
          }
          .print-btn {
            background: #4f46e5;
            color: #fff;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 800;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <div style="max-width: 760px; margin: auto;" class="no-print">
          <button onclick="window.print()" class="print-btn">🖨️ Print / Save 1-Page A4 PDF Invoice</button>
        </div>
        <div class="invoice-box">
          <div class="header">
            <div class="brand-wrapper">
              <img src="${logoUrl}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover;" alt="Hosteleaze Logo" />
              <div>
                <div class="logo-text">HOSTEL<span>EAZE</span></div>
                <div class="brand-sub">Smart Campus Automation • SAC 998313</div>
              </div>
            </div>
            <div class="title">
              <h1>OFFICIAL TAX INVOICE</h1>
              <p class="title-no">NO: ${invoiceNo}</p>
            </div>
          </div>
          
          <div class="details">
            <div>
              <h3>Billed To (Client)</h3>
              <p style="font-size: 15px; color: #0f172a; margin: 0 0 4px 0; font-weight: 800; line-height: 1.2;">${clientName}</p>
              ${clientAddress ? `<p style="font-size: 10px; font-weight: 600; color: #475569; margin: 0 0 3px 0; line-height: 1.4;">📍 ${clientAddress}</p>` : ''}
              ${clientEmail ? `<p style="font-size: 10px; font-weight: 600; color: #64748b; margin: 0 0 3px 0; line-height: 1.4;">✉️ ${clientEmail}</p>` : ''}
              ${clientPhone ? `<p style="font-size: 10px; font-weight: 600; color: #64748b; margin: 0 0 3px 0; line-height: 1.4;">📞 ${clientPhone}</p>` : ''}
              ${(clientCoordinator || clientCoordinatorPhone) ? `<p style="font-size: 10px; font-weight: 700; color: #4338ca; margin: 0 0 3px 0; line-height: 1.4;">👤 Coordinator: ${clientCoordinator}${clientCoordinatorPhone ? ' • 📱 Mobile: ' + clientCoordinatorPhone : ''}</p>` : ''}
              ${clientGstin ? `<p style="font-size: 10px; font-weight: 800; color: #4338ca; margin: 0 0 3px 0; line-height: 1.4;">GSTIN: ${clientGstin}</p>` : ''}
            </div>
            <div style="text-align: right;">
              <h3>Billed From (Provider)</h3>
              <p style="font-size: 15px; color: #0f172a; margin-bottom: 2px;">Hosteleaze Inc.</p>
              <p style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 1px;">Account: DR. PANKAJ DWIVEDI</p>
              <p style="font-size: 11px; font-weight: 600; color: #64748b;">Support: support@hosteleaze.com</p>
            </div>
          </div>

          <div class="meta-bar">
            <div>
              <h3>Payment Date & Exact Time</h3>
              <p style="color: #0f172a;">${fullDateTimeStr}</p>
            </div>
            <div style="text-align: right;">
              <h3>Payment Method</h3>
              <p style="color: #4f46e5;">${paymentMethodText}</p>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Item & Plan Description</th>
                <th style="text-align: center;">Students</th>
                <th style="text-align: center;">Rate / Mo</th>
                <th style="text-align: center;">Duration</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style="font-weight: 800; color: #0f172a;">Hosteleaze Enterprise License</div>
                  <div style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 2px;">Full Warden, Student & Admin Gatepass Portals Access</div>
                </td>
                <td style="text-align: center; font-weight: 700;">${studentCount}</td>
                <td style="text-align: center; font-weight: 700;">₹${ratePerStudentMonth}</td>
                <td style="text-align: center; font-weight: 700;">${tx.billingPeriod || (months + " Months")}</td>
                <td style="text-align: right; font-weight: 800;">₹${grossBase.toLocaleString("en-IN")}.00</td>
              </tr>

              ${standardDiscountAmount > 0 ? `
              <tr style="background: #fdf2f8;">
                <td colspan="4" style="color: #be185d; font-weight: 700;">
                  🎁 Subscription Plan Discount & Incentives (${standardDiscountPercent}% OFF)
                  ${isDirectTransfer ? '<span style="font-size: 9px; opacity: 0.8; margin-left: 4px;">(Includes Direct Transfer Incentive)</span>' : ''}
                </td>
                <td style="text-align: right; font-weight: 800; color: #be185d;">-₹${standardDiscountAmount.toLocaleString("en-IN")}.00</td>
              </tr>
              ` : ''}

              ${extraDiscountAmount > 0 ? `
              <tr style="background: #fdf4ff;">
                <td colspan="4" style="color: #7e22ce; font-weight: 700;">
                  ✨ Special Concession (${extraDiscountPercent}% OFF)
                </td>
                <td style="text-align: right; font-weight: 800; color: #7e22ce;">-₹${extraDiscountAmount.toLocaleString("en-IN")}.00</td>
              </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="total-box" style="display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 18px; gap: 20px;">
            <div style="display: flex; align-items: center; gap: 16px; background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 12px 16px; border-radius: 14px; max-width: 410px; flex: 1;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`HOSTELEAZE TAX INVOICE\nInvoice: ${invoiceNo}\nCollege: ${clientName}\nAmount: Rs. ${finalPaid.toLocaleString("en-IN")}\nUTR: ${tx.utr || tx.id}\nStatus: PAID & VERIFIED`)}" style="width: 135px; height: 135px; border-radius: 10px; border: 1.5px solid #94a3b8; background: #fff; padding: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);" alt="Verification QR Code" />
              <div style="flex: 1;">
                <div style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2;">Scan to Verify Invoice</div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 4px;">Official Digital Audit Proof</div>
                <div style="font-size: 9px; font-weight: 800; color: #3730a3; margin-top: 10px; background: #e0e7ff; border: 1px solid #c7d2fe; padding: 4px 8px; border-radius: 6px; display: inline-block;">✓ VERIFIED E-INVOICE</div>
              </div>
            </div>

            <div style="width: 300px; shrink: 0;">
              ${totalDiscountAmount > 0 ? `
              <div class="savings-badge">
                🎉 Total College Savings: ₹${totalDiscountAmount.toLocaleString("en-IN")}.00
              </div>
              ` : ''}

              <table class="total-table">
                <tr>
                  <td>Gross Subtotal</td>
                  <td>₹${grossBase.toLocaleString("en-IN")}.00</td>
                </tr>
                ${extraDiscountAmount > 0 && standardDiscountAmount > 0 ? `
                <tr>
                  <td style="color: #be185d;">Standard Plan Discount (${standardDiscountPercent}%)</td>
                  <td style="color: #be185d;">-₹${standardDiscountAmount.toLocaleString("en-IN")}.00</td>
                </tr>
                <tr>
                  <td style="color: #7e22ce; font-weight: 700;">🌟 Special Concession (${extraDiscountPercent}%)</td>
                  <td style="color: #7e22ce; font-weight: 700;">-₹${extraDiscountAmount.toLocaleString("en-IN")}.00</td>
                </tr>
                ` : extraDiscountAmount > 0 ? `
                <tr>
                  <td style="color: #7e22ce; font-weight: 700;">🌟 Special Concession (${extraDiscountPercent}%)</td>
                  <td style="color: #7e22ce; font-weight: 700;">-₹${extraDiscountAmount.toLocaleString("en-IN")}.00</td>
                </tr>
                ` : ''}
                ${totalDiscountAmount > 0 ? `
                <tr>
                  <td style="color: #be185d; font-weight: 800;">Total Discounts (${totalDiscountPercent}%)</td>
                  <td style="color: #be185d; font-weight: 800;">-₹${totalDiscountAmount.toLocaleString("en-IN")}.00</td>
                </tr>
                ` : ''}
                <tr>
                  <td>GST / Service Tax (0%)</td>
                  <td>₹0.00</td>
                </tr>
                <tr class="grand-total">
                  <td>Total Paid</td>
                  <td style="color: #4f46e5;">₹${finalPaid.toLocaleString("en-IN")}.00</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="audit-box">
            <p style="margin: 0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; font-weight: 800; margin-bottom: 4px;">Payment Verification & Audit Proof</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="margin: 0; font-size: 12px; font-weight: 800; color: #0f172a;">Reference / UTR ID: ${tx.utr || tx.id || "N/A"}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; font-weight: 600; color: #64748b;">Method: ${paymentMethodText} • Timestamp: ${fullDateTimeStr}</p>
              </div>
              <div style="background: #dcfce7; border: 1px solid #86efac; color: #15803d; padding: 4px 12px; border-radius: 16px; font-size: 10px; font-weight: 900; letter-spacing: 0.5px;">
                ✓ PAID & VERIFIED
              </div>
            </div>
            ${tx.screenshotUrl ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 10px;">
              <span style="font-weight: 700; color: #475569;">📥 Attached Verified Proof: </span>
              <a href="${tx.screenshotUrl}" target="_blank" style="color: #4f46e5; font-weight: 800; text-decoration: underline;">View Payment Receipt Screenshot (Cloudflare CDN)</a>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p style="margin: 0; font-size: 13px; font-weight: 800; color: #334155; margin-bottom: 2px;">Thank you for trusting Hosteleaze!</p>
            <p style="margin: 0; font-size: 10px;">This is an official computer-generated tax invoice receipt. Digital authorization valid without physical signature.</p>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}
