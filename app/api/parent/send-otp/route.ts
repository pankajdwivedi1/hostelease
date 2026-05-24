import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getCurrentTenantId } from "@/lib/tenant";
import { otpCache } from "@/lib/otpCache";
import { sendMSG91_WidgetOTP } from "@/lib/msg91";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (keep only digits)
    let cleaned = phoneNumber.replace(/\D/g, "");
    
    // If it has +91 or 91, let's keep it or match both.
    // In India, numbers are usually 10 digits. If it starts with 91 and has 12 digits, strip the 91.
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.substring(2);
    }
    
    if (cleaned.length !== 10) {
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number" }, { status: 400 });
    }

    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "No active college tenant context found" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ⚡ FAST QUERY: Search directly for matching father_number, mother_number, or local_guardian_phone_number
    const variations = [cleaned, `+91${cleaned}`, `91${cleaned}`];
    const filters: string[] = [];
    variations.forEach(v => {
      filters.push(`father_number.eq."${v}"`);
      filters.push(`mother_number.eq."${v}"`);
      filters.push(`local_guardian_phone_number.eq."${v}"`);
    });
    const filterString = filters.join(",");

    let { data: students, error } = await supabase
      .from("students")
      .select("name, father_name, mother_name, father_number, mother_number, local_guardian_phone_number")
      .eq("tenant_id", tenantId)
      .or(filterString);

    if (error) {
      console.error("❌ Error fetching students in send-otp:", error);
      return NextResponse.json({ success: false, error: "Database error occurred" }, { status: 500 });
    }

    // ⚡ FALLBACK: If fast query returned no results, fall back to slow scan to support custom formatting
    if (!students || students.length === 0) {
      console.log(`[Send-OTP] Fast query missed. Running fallback full scan for: ${cleaned}`);
      const { data: allStudents, error: allErr } = await supabase
        .from("students")
        .select("name, father_name, mother_name, father_number, mother_number, local_guardian_phone_number")
        .eq("tenant_id", tenantId);
      
      if (!allErr && allStudents) {
        students = allStudents;
      }
    }

    const cleanDbPhone = (num: string) => num ? num.replace(/\D/g, "").replace(/^91/, "") : "";
    
    const matchedStudent = students?.find(s => {
      const fatherClean = cleanDbPhone(s.father_number);
      const motherClean = cleanDbPhone(s.mother_number);
      const lgClean = cleanDbPhone(s.local_guardian_phone_number);
      return fatherClean === cleaned || motherClean === cleaned || lgClean === cleaned;
    });

    if (!matchedStudent) {
      return NextResponse.json({ 
        success: false, 
        error: "This phone number is not registered as a parent/guardian mobile number for any student" 
      }, { status: 404 });
    }

    // 🔥 Trigger MSG91 Widget API
    const smsResponse = await sendMSG91_WidgetOTP(cleaned);
    const reqId = smsResponse.reqId; // Either the real one from MSG91 or simulated
    
    // Store in global cache with 5 minute expiration
    const expires = Date.now() + 5 * 60 * 1000;
    otpCache.set(cleaned, { reqId, expires });

    console.log(`\n======================================================`);
    console.log(`[PARENT LOGIN OTP] Phone: ${cleaned}`);
    console.log(`[PARENT LOGIN OTP] Student: ${matchedStudent.name}`);
    console.log(`[PARENT LOGIN OTP] Widget ReqId: ${reqId}`);
    console.log(`======================================================\n`);

    if (!smsResponse.success && smsResponse.error !== "Configuration missing") {
        console.warn(`⚠️ SMS warning for ${cleaned}: ${smsResponse.error}`);
        // We still allow the login to proceed for development
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully to registered mobile number"
    });
  } catch (error: any) {
    console.error("❌ Send OTP crash:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to send OTP" }, { status: 500 });
  }
}
