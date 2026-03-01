import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { validators, validateStudentRegistration } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firebaseUID, name, email, phoneNumber, hostelName, roomNumber, profilePicture, fatherName, fatherNumber, motherName, motherNumber, permanentAddress, homeState, erpInformation, joiningDate, branch, collegeName, year, semester, section, localGuardianAddress, localGuardianPhoneNumber, dob, category, deviceId, faceDescriptor, floorNumber } = body;

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
    const email = searchParams.get("email");

    if (firebaseUID) {
      const student = await db.students.findOne({ firebaseUID });
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
      const result = await db.gatePasses.list({ status: "out" }, { limit: 1000 });
      openPasses = result.records || [];
      if (openPasses.length > 0) {
        // Create a map of studentId -> outingType for efficient lookup
        activeOutings = new Map(openPasses.map((p: any) => {
          const sId = typeof p.studentId === 'object' ? (p.studentId?._id || p.studentId?.id) : p.studentId;
          return [sId?.toString(), p.type || "outing"];
        }));

        console.log(`[SYNC_DEBUG] Open Passes: ${openPasses?.length || 0}, Active Outings Map Size: ${activeOutings.size}`);
        if (openPasses && openPasses.length > 0 && openPasses[0]) {
          const firstPass = openPasses[0];
          const sIdSample = typeof firstPass.studentId === 'object' ? ((firstPass.studentId as any)?._id || (firstPass.studentId as any)?.id) : firstPass.studentId;
          console.log(`[SYNC_DEBUG] Sample Mapping: p.studentId=${JSON.stringify(firstPass.studentId)} -> sId=${sIdSample}`);
        }

        students.forEach((s: any) => {
          const sId = (s.id || s._id)?.toString();
          const outingType = activeOutings.get(sId);

          if (outingType) {
            s.studentStatus = "out";
            s.outingType = outingType;
            syncCount++;
          } else {
            s.studentStatus = "in";
            s.outingType = undefined;
          }
        });
        console.log(`[SYNC_DEBUG] Total Students Synced to 'out': ${syncCount}`);
      }
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

