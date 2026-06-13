import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { otpCache } from "@/lib/otpCache";
import { sendMSG91_WidgetOTP } from "@/lib/msg91";

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, firebaseUID } = await request.json();
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (keep only digits)
    let cleaned = phoneNumber.replace(/\D/g, "");
    
    // If it has +91 or 91, let's keep it or match both.
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
      cleaned = cleaned.substring(2);
    }
    
    if (cleaned.length !== 10) {
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number" }, { status: 400 });
    }

    // ⚡ DUPLICATE CHECK: Verify if this phone number is already registered in the students table
    const rawPhoneNumber = phoneNumber.trim();
    const existingStudent = await db.students.findOne({ phoneNumber: rawPhoneNumber });
    
    // Only block if the number belongs to a DIFFERENT student
    if (existingStudent && existingStudent.firebaseUID !== firebaseUID) {
      return NextResponse.json(
        { success: false, error: "This mobile number is already registered to another student. Please use another number." },
        { status: 409 }
      );
    }

    // 🔥 Trigger MSG91 Widget API (Invisible Mode)
    const smsResponse = await sendMSG91_WidgetOTP(cleaned);
    
    if (!smsResponse.success) {
        console.warn(`⚠️ SMS error for ${cleaned}: ${smsResponse.error}`);
        return NextResponse.json({ success: false, error: `MSG91 Server Error: ${smsResponse.error}` }, { status: 500 });
    }

    const reqId = smsResponse.reqId; 
    
    // Store in global cache with 5 minute expiration
    const expires = Date.now() + 5 * 60 * 1000;
    otpCache.set(cleaned, { reqId: reqId, expires } as any);

    console.log(`\n======================================================`);
    console.log(`[STUDENT ONBOARDING OTP] Phone: ${cleaned}`);
    console.log(`======================================================\n`);

    return NextResponse.json({ success: true, message: "OTP Sent Successfully" }, { status: 200 });
    
  } catch (error: any) {
    console.error("❌ API Route Error (send-otp):", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
