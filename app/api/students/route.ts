import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { validators, validateStudentRegistration } from "@/lib/validation";
import { getCurrentTenantId } from "@/lib/tenant";

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
      // ✅ NEW FIX #13: Load hostel prefix mapping from AdminSettings (configurable)
      const adminSettings = await db.settings.get();
      let hostelPrefixMap = adminSettings?.hostelPrefixMap || [
        { hostelName: "GHB Hostel", prefix: "GUEST" },
        { hostelName: "Boys Hostel", prefix: "BOYS" },
        { hostelName: "Gangotri Hostel", prefix: "GANGOTRI" },
        { hostelName: "Gaytri Hostel", prefix: "GAYTRI" }
      ];

      let prefix = "STUDENT";
      for (const mapping of hostelPrefixMap) {
        if (hostelName.toLowerCase().includes(mapping.hostelName.toLowerCase())) {
          prefix = mapping.prefix;
          break;
        }
      }

      // Find the highest number for this prefix
      const students = await db.students.list({ search: prefix });
      let nextNumber = 1;

      if (students && students.length > 0) {
        const regIds = students
          .map((s: any) => s.registrationId)
          .filter((id: string) => id && id.startsWith(`${prefix}-`));

        if (regIds.length > 0) {
          const numbers = regIds.map((id: string) => parseInt(id.split('-')[1])).filter((n: number) => !isNaN(n));
          if (numbers.length > 0) {
            nextNumber = Math.max(...numbers) + 1;
          }
        }
      }

      registrationId = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
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
      ...(profilePicture && { profilePicture }),
      ...(fatherName && { fatherName: validators.sanitizeInput(fatherName) }),
      ...(fatherNumber && { fatherNumber: validators.sanitizePhoneNumber(fatherNumber) }),
      ...(motherName && { motherName: validators.sanitizeInput(motherName) }),
      ...(motherNumber && { motherNumber: validators.sanitizePhoneNumber(motherNumber) }),
      ...(permanentAddress && { permanentAddress: validators.sanitizeInput(permanentAddress) }),
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

    if (firebaseUID) {
      const student = await db.students.findOne({ firebaseUID });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      return NextResponse.json({ student }, { status: 200 });
    }

    if (supabaseId) {
      const student = await db.students.findOne({ supabaseId });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      return NextResponse.json({ student }, { status: 200 });
    }

    if (email) {
      const student = await db.students.findOne({ email });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      return NextResponse.json({ student }, { status: 200 });
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

    // ⚡ SYNC STATUS: Ensure 'out' status matches open gate passes for everyone in the list
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

      console.log(`[SYNC_DEBUG] Today Date String determined as: ${today}`);
      const attendanceSummary = await db.attendance.summary(today);
      const presentIdsSet = new Set((attendanceSummary?.presentStudentIds || []).map((id: any) => id?.toString()));

      // Create a map of studentId -> outingType for efficient lookup
      activeOutings = new Map(openPasses.map((p: any) => {
        const sId = typeof p.studentId === 'object' ? (p.studentId?._id || p.studentId?.id) : p.studentId;
        return [sId?.toString(), p.type || "outing"];
      }));

      console.log(`[SYNC_DEBUG] Open Passes: ${openPasses?.length || 0}, Active Outings: ${activeOutings.size}, Present Students Today: ${presentIdsSet.size}`);

      students.forEach((s: any) => {
        const sId = (s.id || s._id)?.toString();
        const outingType = activeOutings.get(sId);

        // ⚡ DATA CONSISTENCY FIX:
        // A student CANNOT be 'OUT' (red) if they are already marked 'Present' (today)!
        const isActuallyPresent = presentIdsSet.has(sId);

        if (outingType && !isActuallyPresent) {
          s.studentStatus = "out";
          s.outingType = outingType;
          syncCount++;
        } else {
          // If they are present OR have no open pass, they are 'in'
          s.studentStatus = "in";
          s.outingType = undefined;
        }
      });
      console.log(`[SYNC_DEBUG] Total Students Synced to 'out': ${syncCount}`);
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

