import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import AdminSettings from "@/models/AdminSettings";
import { validators, validateStudentRegistration } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { firebaseUID, name, email, phoneNumber, hostelName, roomNumber, profilePicture, fatherName, fatherNumber, motherName, motherNumber, homePinCode, homeState, erpInformation, joiningDate, branch, collegeName, year, semester, section, localGuardianAddress, localGuardianPhoneNumber, dob, category, deviceId, faceDescriptor, floorNumber } = body;

    // ✅ NEW: Input validation & sanitization
    const validation = validateStudentRegistration(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    // ✅ NEW FIX #10: Reduce required fields to 5 core fields only
    // Only mandatory: firebaseUID, email, phoneNumber, hostelName, roomNumber
    if (!firebaseUID || !email || !phoneNumber || !hostelName || !roomNumber) {
      return NextResponse.json(
        { error: "Missing required fields: firebaseUID, email, phoneNumber, hostelName, roomNumber" },
        { status: 400 }
      );
    }

    const { db } = await import("@/lib/dbAdapter");
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
      // For now, keep AdminSettings in MongoDB as the central config source, 
      // but we could make it database-aware later if needed.
      const adminSettings = await AdminSettings.findOne().lean();
      let hostelPrefixMap = adminSettings?.hostelPrefixMap || [
        { hostelName: "Guest House Boys Hostel", prefix: "GUEST" },
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

      // Find the highest number for this prefix - Using getAll or list might be slow, 
      // but since it's only on registration, it's okay for now.
      // Better to add a dedicated findLastByRegistrationId to dbAdapter.
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
      ...(homePinCode && { homePinCode: validators.sanitizePhoneNumber(homePinCode) }),
      ...(homeState && { homeState: validators.sanitizeInput(homeState) }),
      ...(erpInformation && { erpInformation: validators.sanitizeInput(erpInformation) }),
      ...(joiningDate && { joiningDate: new Date(joiningDate) }),
      ...(branch && { branch: validators.sanitizeInput(branch) }),
      ...(collegeName && { collegeName: validators.sanitizeInput(collegeName) }),
      ...(year && { year: String(year) }),
      ...(semester && { semester: String(semester) }),
      ...(section && { section: validators.sanitizeInput(section) }),
      ...(floorNumber && { floorNumber: String(floorNumber) }),
      ...(localGuardianAddress && { localGuardianAddress: validators.sanitizeInput(localGuardianAddress) }),
      ...(localGuardianPhoneNumber && { localGuardianPhoneNumber: validators.sanitizePhoneNumber(localGuardianPhoneNumber) }),
      ...(dob && { dob }),
      ...(category && { category: validators.sanitizeInput(category) }),
      ...(faceDescriptor && { faceDescriptor }),
    };

    if (deviceId) {
      // Admin-Only Reset Rule: Only set deviceId if student doesn't have one yet
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

// ⚡ OPTIMIZED: Modern connection pooling for Next.js to prevent "buffering timed out" errors

export async function GET(request: NextRequest) {
  let query: any = {};
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const firebaseUID = searchParams.get("firebaseUID");
    const email = searchParams.get("email");
    const minimal = searchParams.get("minimal") === "true"; // ⚡ OPTIMIZATION: Support minimal data fetch

    if (firebaseUID) {
      const { db } = await import("@/lib/dbAdapter");
      // Use getById or findOne equivalent in dbAdapter
      const student = await db.students.findOne({ firebaseUID });

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      // studentStatus is handled by dbAdapter if needed, but we can ensure it here
      return NextResponse.json({ student }, { status: 200 });
    }

    if (email) {
      const { db } = await import("@/lib/dbAdapter");
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

    const light = searchParams.get("light") === "true"; // ⚡ OPTIMIZATION: Exclude heavy fields

    const { db } = await import("@/lib/dbAdapter");
    const students = await db.students.list(
      { search, hostelName, collegeName, semester, branch, section },
      { light }
    );

    return NextResponse.json({ students }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Error fetching students:");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Query that failed:", query);
    return NextResponse.json(
      { error: error.message || "Failed to fetch students" },
      { status: 500 }
    );
  }
}
