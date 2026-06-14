import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { validators, validateStudentRegistration } from "@/lib/validation";
import { getCurrentTenantId, getTenantById } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = await getCurrentTenantId();
    const { firebaseUID, supabase_id, name, email, phoneNumber, hostelName, roomNumber, profilePicture, fatherName, fatherNumber, motherName, motherNumber, permanentAddress, homeState, erpInformation, joiningDate, branch, collegeName, year, semester, section, localGuardianAddress, localGuardianPhoneNumber, dob, category, deviceId, faceDescriptor, floorNumber } = body;

    // ✅ NEW: Input validation & sanitization
    const validation = validateStudentRegistration(body);
    if (!validation.valid) {
      console.error("❌ VALIDATION FAILED for student:", { firebaseUID, errors: validation.errors, body });
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // ✅ RELAXED: Only mandatory: firebaseUID, phoneNumber, hostelName, roomNumber (Email optional if phone login)
    if (!firebaseUID || !phoneNumber || !hostelName || !roomNumber) {
      return NextResponse.json(
        { error: "Missing required fields: firebaseUID, phoneNumber, hostelName, roomNumber" },
        { status: 400 }
      );
    }

    const existingStudent = await db.students.findOne({ firebaseUID });

    // ✅ NEW: Check for duplicate phone numbers
    if (!existingStudent) {
      const phoneExists = await db.students.findOne({ phoneNumber: phoneNumber.trim() });
      if (phoneExists) {
        return NextResponse.json(
          { error: "This phone number is already registered with another account" },
          { status: 409 }
        );
      }
    }

    // ✅ NEW: Check for duplicate email
    if (!existingStudent) {
      const emailExists = await db.students.findOne({ email: email.toLowerCase().trim() });
      if (emailExists) {
        return NextResponse.json(
          { error: "This email is already registered with another account" },
          { status: 409 }
        );
      }
    }

    let registrationId = existingStudent?.registrationId;

    if (!registrationId) {
      // Format: ST + CollegeCode + Year (last 2 digits) + Sequence Number
      // Example: STOIST25497
      const colName = collegeName ? collegeName.toUpperCase().replace(/[^A-Z]/g, '') : "UNK";
      const yearStr = joiningDate ? new Date(joiningDate).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
      const prefix = `ST${colName}${yearStr}`;

      // Find the highest number for this prefix
      const students = await db.students.list({ search: prefix });
      let nextNumber = 1;

      if (students && students.length > 0) {
        const regIds = students
          .map((s: any) => s.registrationId)
          .filter((id: string) => id && id.startsWith(prefix));

        if (regIds.length > 0) {
          const numbers = regIds.map((id: string) => parseInt(id.replace(prefix, ''))).filter((n: number) => !isNaN(n));
          if (numbers.length > 0) {
            nextNumber = Math.max(...numbers) + 1;
          }
        }
      }

      registrationId = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    }

    // ✅ NEW: Upload base64 profile photo to Supabase storage to save database egress/bandwidth
    let finalProfilePicture = profilePicture;
    if (profilePicture && profilePicture.startsWith("data:image/")) {
      try {
        const { uploadProfilePictureToSupabase } = await import("@/lib/supabaseServer");
        finalProfilePicture = await uploadProfilePictureToSupabase(profilePicture, tenantId, firebaseUID);
        console.log(`[Storage] Successfully uploaded base64 profile picture to Supabase bucket. URL: ${finalProfilePicture}`);
      } catch (err: any) {
        console.error("❌ Failed to upload profile picture to storage, saving as base64 fallback:", err.message);
      }
    }

    // ✅ NEW: Sanitize inputs before storing
    const updateData: any = {
      firebaseUID: firebaseUID.trim(),
      email: validators.sanitizeEmail(email),
      phoneNumber: validators.sanitizePhoneNumber(phoneNumber),
      hostelName: validators.sanitizeInput(hostelName),
      roomNumber: String(roomNumber).trim(),
      registrationId,
      studentStatus: "in",
      tenantId,
      // ✅ OPTIONAL FIELDS: Only include if provided
      ...(name && { name: validators.sanitizeInput(name) }),
      ...(finalProfilePicture && { profilePicture: finalProfilePicture }),
      ...(fatherName && { fatherName: validators.sanitizeInput(fatherName) }),
      ...(fatherNumber && { fatherNumber: validators.sanitizePhoneNumber(fatherNumber) }),
      ...(motherName && { motherName: validators.sanitizeInput(motherName) }),
      ...(motherNumber && { motherNumber: validators.sanitizePhoneNumber(motherNumber) }),
      ...((permanentAddress || body.homePinCode) && { permanentAddress: validators.sanitizeInput(permanentAddress || body.homePinCode) }),
      ...(homeState && { homeState: validators.sanitizeInput(homeState) }),
      ...(erpInformation && { erpInformation: validators.sanitizeInput(erpInformation) }),
      ...(joiningDate && { joiningDate: validators.formatDateForDB(joiningDate) }),
      ...(branch && { branch: validators.sanitizeInput(branch) }),
      ...(collegeName && { collegeName: validators.sanitizeInput(collegeName) }),
      ...(year && { year: String(year) }),
      ...(semester && { semester: String(semester) }),
      ...(section && { section: validators.sanitizeInput(section) }),
      ...(floorNumber && { floorNumber: String(floorNumber) }),
      ...(localGuardianAddress && { localGuardianAddress: validators.sanitizeInput(localGuardianAddress) }),
      ...(localGuardianPhoneNumber && { localGuardianPhoneNumber: validators.sanitizePhoneNumber(localGuardianPhoneNumber) }),
      ...(dob && { dob: validators.formatDateForDB(dob) }),
      ...(category && { category: validators.sanitizeInput(category) }),
      ...(faceDescriptor && { faceDescriptor }),
      ...(supabase_id && { supabaseId: supabase_id }),
      authProvider: supabase_id ? 'supabase' : 'firebase',
      dynamicFields: body.dynamicFields || {}, // Preserve all form data
    };

    if (deviceId) {
      if (!existingStudent || !existingStudent.deviceId || existingStudent.deviceId.trim() === "") {
        updateData.deviceId = validators.isValidDeviceId(deviceId) ? deviceId : undefined;
      }
    }

    const student = await db.students.save(firebaseUID, updateData);

    return NextResponse.json({ success: true, student }, { status: 200 });
  } catch (error: any) {
    console.error("Error creating/updating student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save student" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const firebaseUID = searchParams.get("firebaseUID");
    const supabaseId = searchParams.get("supabaseId");
    const email = searchParams.get("email");
    const parentPhone = searchParams.get("parentPhone");

    if (parentPhone) {
      let cleaned = parentPhone.replace(/\D/g, "");
      if (cleaned.length === 12 && cleaned.startsWith("91")) {
        cleaned = cleaned.substring(2);
      }
      
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        return NextResponse.json({ error: "Tenant context not found" }, { status: 400 });
      }

      const { getSupabaseAdmin } = await import("@/lib/supabaseServer");
      const supabase = getSupabaseAdmin();
      
      // Exclude heavy columns like face_descriptor (which contains large float arrays)
      // and device_history/web_authn_credentials to minimize DB latency & bandwidth.
      const selectFields = "_id, firebase_uid, name, email, phone_number, hostel_name, room_number, dob, category, profile_picture, student_status, father_name, father_number, mother_name, mother_number, permanent_address, home_state, erp_id, joining_date, branch, college_name, year, semester, section, floor_number, local_guardian_address, local_guardian_phone_number, device_id, registration_id, is_profile_locked, attendance_mode, device_reset_count, created_at, updated_at, dynamic_fields, tenant_id, supabase_id, auth_provider";

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
        .select(selectFields)
        .eq("tenant_id", tenantId)
        .or(filterString);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // ⚡ FALLBACK: If fast query returned no results, fall back to slow scan but ONLY fetch key identifiers.
      // This prevents downloading massive face descriptors for all students in the tenant context.
      if (!students || students.length === 0) {
        console.log(`[Students API] Fast query missed. Running fallback lightweight scan for parent phone: ${cleaned}`);
        const { data: idMapping, error: allErr } = await supabase
          .from("students")
          .select("_id, father_number, mother_number, local_guardian_phone_number")
          .eq("tenant_id", tenantId);
        
        if (!allErr && idMapping) {
          const cleanDbPhone = (num: string) => num ? num.replace(/\D/g, "").replace(/^91/, "") : "";
          const matchedMap = idMapping.find(s => {
            const fatherClean = cleanDbPhone(s.father_number);
            const motherClean = cleanDbPhone(s.mother_number);
            const lgClean = cleanDbPhone(s.local_guardian_phone_number);
            return fatherClean === cleaned || motherClean === cleaned || lgClean === cleaned;
          });

          if (matchedMap) {
            // Found a match! Do a fast single-row primary key lookup to get the student's details
            const { data: matchedStudentData, error: lookupErr } = await supabase
              .from("students")
              .select(selectFields)
              .eq("_id", matchedMap._id)
              .maybeSingle();

            if (!lookupErr && matchedStudentData) {
              students = [matchedStudentData];
            }
          }
        }
      }

      const cleanDbPhone = (num: string) => num ? num.replace(/\D/g, "").replace(/^91/, "") : "";
      const matched = students?.find(s => {
        const fatherClean = cleanDbPhone(s.father_number);
        const motherClean = cleanDbPhone(s.mother_number);
        const lgClean = cleanDbPhone(s.local_guardian_phone_number);
        return fatherClean === cleaned || motherClean === cleaned || lgClean === cleaned;
      });

      if (!matched) {
        return NextResponse.json({ error: "Student not found for this parent number" }, { status: 404 });
      }

      const student = db.mapStudentToCamelCase(matched);
      const tenant = student?.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ student, tenantSlug: tenant?.slug }, { status: 200 });
    }

    if (firebaseUID) {
      const student = await db.students.findOne({ firebaseUID });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      const tenant = student.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ student, tenantSlug: tenant?.slug }, { status: 200 });
    }

    if (supabaseId) {
      const student = await db.students.findOne({ supabaseId });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      const tenant = student.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ student, tenantSlug: tenant?.slug }, { status: 200 });
    }

    if (email) {
      const student = await db.students.findOne({ email });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      const tenant = student.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ student, tenantSlug: tenant?.slug }, { status: 200 });
    }

    const search = searchParams.get("search");
    const hostelName = searchParams.get("hostelName");
    const collegeName = searchParams.get("collegeName");
    const semester = searchParams.get("semester");
    const branch = searchParams.get("branch");
    const section = searchParams.get("section");

    const light = searchParams.get("light") === "true";

    const students = await db.students.list(
      { search, hostelName, collegeName, semester, branch, section },
      { light }
    );

    // ⚡ SYNC STATUS: Ensure 'out' status matches open gate passes for everyone in the list
    let openPasses: any[] = [];
    let activeOutings = new Map<string, string>();
    let syncCount = 0;

    // ⚡ ALWAYS SYNC: We now sync even in light mode because status is critical for Warden Dashboard accuracy
    try {
      // 1. Fetch Open Passes
      const gatePassResult = await db.gatePasses.list({ status: "out" }, { limit: 1000 });
      openPasses = gatePassResult.records || [];

      // 2. Fetch Present IDs for Today (to detect stale gate passes)
      const now = new Date();
      // ⚡ Robust Date Parsing (Sync with attendance-summary API)
      const istDateStr = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
      const dateParts = istDateStr.split(/[^0-9]/).filter(p => p.length > 0);
      let today = "";
      if (dateParts.length >= 3) {
        if (dateParts[0].length === 4) today = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`; // YYYY-MM-DD
        else today = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // DD-MM-YYYY -> YYYY-MM-DD
      } else {
        today = now.toISOString().split('T')[0];
      }

      const attendanceSummary = await db.attendance.summary(today);
      const presentIdsSet = new Set((attendanceSummary?.presentStudentIds || []).map((id: any) => id?.toString()));

      // Create a map of studentId -> outingType for efficient lookup
      activeOutings = new Map(openPasses.map((p: any) => {
        const sId = typeof p.studentId === 'object' ? (p.studentId?._id || p.studentId?.id) : p.studentId;
        return [sId?.toString(), p.type || "outing"];
      }));

      students.forEach((s: any) => {
        const sId = (s.id || s._id)?.toString();
        const outingType = activeOutings.get(sId);

        // ⚡ DATA CONSISTENCY FIX:
        // Priority 1: If Gatepass says OUT, stay OUT (Matches Terminal Count: 70)
        if (outingType) {
          s.studentStatus = "out";
          s.outingType = outingType;
          syncCount++;
        } else {
          // If no open pass, they are 'in'
          s.studentStatus = "in";
          s.outingType = undefined;
        }
      });
    } catch (syncError) {
      console.warn("⚠️ Status sync failed in list API:", syncError);
    }

    return NextResponse.json({
      success: true,
      students,
      total: students.length,
      debug: {
        syncTotal: openPasses?.length || 0,
        uniqueStudentsOut: activeOutings?.size || 0,
        matchedStudentsInList: typeof syncCount !== 'undefined' ? syncCount : 0
      },
      count: students.length,
    }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Error fetching students:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to fetch students" },
      { status: 500 }
    );
  }
}

