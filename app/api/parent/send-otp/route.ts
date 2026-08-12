export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getCurrentTenantId } from "@/lib/tenant";
import { otpCache } from "@/lib/otpCache";
import { sendMSG91_WidgetOTP, sendMSG91_OTP } from "@/lib/msg91";

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

    // ⚡ FAST WILDCARD QUERY: Search directly for matching core digits in student_profiles
    const digitPattern = `%${coreDigits.split("").join("%")}%`;
    
    let { data: students, error } = await supabase
      .from("students")
      .select("name, student_profiles!inner(father_name, mother_name, father_number, mother_number, local_guardian_phone_number)")
      .eq("tenant_id", tenantId)
      .or(`father_number.like.${digitPattern},mother_number.like.${digitPattern},local_guardian_phone_number.like.${digitPattern}`, { foreignTable: 'student_profiles' });

    if (error) {
      console.error("❌ Error fetching students in send-otp:", error);
      return NextResponse.json({ success: false, error: "Database error occurred" }, { status: 500 });
    }

    let matchedStudent = null;
    let studentName = "";

    if (students) {
      for (const s of students) {
        const prof = Array.isArray(s.student_profiles) ? s.student_profiles[0] : s.student_profiles;
        if (!prof) continue;

        const fatherNorm = normalizePhoneWithCountry(prof.father_number);
        const motherNorm = normalizePhoneWithCountry(prof.mother_number);
        const lgNorm = normalizePhoneWithCountry(prof.local_guardian_phone_number);

        if (fatherNorm === targetNormalized || motherNorm === targetNormalized || lgNorm === targetNormalized) {
          matchedStudent = prof;
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
