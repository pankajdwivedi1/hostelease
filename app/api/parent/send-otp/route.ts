export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { otpCache } from "@/lib/otpCache";
import { sendMSG91_WidgetOTP, sendMSG91_OTP } from "@/lib/msg91";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (keep only digits)
    let cleaned = phoneNumber.replace(/\D/g, "");
    
    if (cleaned.length < 7 || cleaned.length > 15) {
      return NextResponse.json({ success: false, error: "Please enter a valid mobile number (7 to 15 digits)" }, { status: 400 });
    }

    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "No active college tenant context found" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Normalize target phone number with country code (defaults 10-digit numbers to 91 for India)
    const normalizePhoneWithCountry = (num: string) => {
      if (!num) return "";
      let c = num.replace(/\D/g, "");
      if (c.length === 10) return "91" + c;
      return c;
    };

    const targetNormalized = normalizePhoneWithCountry(cleaned);
    const coreDigits = cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;

    // ⚡ FAST QUERY: Search directly using unified dbAdapter (Railway PostgreSQL / Prisma)
    const students = await db.students.list({ search: coreDigits });

    let matchedStudent = null;
    let studentName = "";

    if (students && students.length > 0) {
      for (const s of students) {
        const fatherNorm = normalizePhoneWithCountry(s.fatherNumber);
        const motherNorm = normalizePhoneWithCountry(s.motherNumber);
        const lgNorm = normalizePhoneWithCountry(s.localGuardianPhoneNumber);

        if (fatherNorm === targetNormalized || motherNorm === targetNormalized || lgNorm === targetNormalized) {
          matchedStudent = s;
          studentName = s.name;
          break;
        }
      }
    }

    if (!matchedStudent) {
      return NextResponse.json({ 
        success: false, 
        error: "This phone number is not registered as a parent/guardian mobile number for any student" 
      }, { status: 404 });
    }

    // Check if direct OTP template is configured
    const templateId = process.env.MSG91_TEMPLATE_ID_OTP;
    const isDirectConfigured = templateId && templateId.trim() !== "" && !templateId.includes("here") && !templateId.includes("template_id") && !templateId.includes("YOUR_");

    let reqId = "";
    let generatedOtp = "";

    if (isDirectConfigured) {
      // Generate a 6-digit OTP
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const smsResponse = await sendMSG91_OTP(cleaned, generatedOtp);
      if (!smsResponse.success) {
        console.warn(`⚠️ Direct SMS error for ${cleaned}: ${smsResponse.error}`);
        return NextResponse.json({ success: false, error: `MSG91 Server Error: ${smsResponse.error}` }, { status: 500 });
      }
    } else {
      // 🔥 Trigger MSG91 Widget API (Invisible Mode)
      const smsResponse = await sendMSG91_WidgetOTP(cleaned);
      if (!smsResponse.success) {
         console.warn(`⚠️ SMS error for ${cleaned}: ${smsResponse.error}`);
         return NextResponse.json({ success: false, error: `MSG91 Server Error: ${smsResponse.error}` }, { status: 500 });
      }
      reqId = smsResponse.reqId;
    }
    
    // Store in global cache with 5 minute expiration
    const expires = Date.now() + 5 * 60 * 1000;
    otpCache.set(cleaned, { reqId, otp: generatedOtp, expires } as any);

    console.log(`\n======================================================`);
    console.log(`[PARENT LOGIN OTP] Phone: ${cleaned}`);
    console.log(`[PARENT LOGIN OTP] Student: ${studentName}`);
    console.log(`[PARENT LOGIN OTP] Widget ReqId: ${reqId}`);
    console.log(`======================================================\n`);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully to registered mobile number",
      reqId
    });
  } catch (error: any) {
    console.error("❌ Send OTP crash:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to send OTP" }, { status: 500 });
  }
}
