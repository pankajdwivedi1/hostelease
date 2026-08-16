export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { validators, validateStudentRegistration } from "@/lib/validation";
import { getCurrentTenantId, getTenantById } from "@/lib/tenant";
import { writeHostelActivityLog } from "@/lib/auditLog";

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

    // Load admin settings for uniqueness configuration and prefix mapping
    const adminSettings = await db.settings.get();

    // Find existing student by firebaseUID, or supabase_id, or email, or phoneNumber fallback
    let existingStudent = await db.students.findOne({ firebaseUID });
    if (!existingStudent && supabase_id) {
      existingStudent = await db.students.findOne({ supabaseId: supabase_id });
    }
    if (!existingStudent && email) {
      existingStudent = await db.students.findOne({ email: email.toLowerCase().trim() });
    }
    if (!existingStudent && phoneNumber) {
      existingStudent = await db.students.findOne({ phoneNumber: phoneNumber.trim() });
    }

    // ✅ Check for duplicate phone numbers belonging to another student (if enforced)
    if (adminSettings?.enforceUniquePhone) {
      const phoneExists = await db.students.findOne({ phoneNumber: phoneNumber.trim() });
      if (phoneExists && (!existingStudent || phoneExists.firebaseUID !== existingStudent.firebaseUID)) {
        return NextResponse.json(
          { error: "This phone number is already registered with another account" },
          { status: 409 }
        );
      }
    }

    // ✅ Check for duplicate email belonging to another student (if enforced)
    if (adminSettings?.enforceUniqueEmail && email) {
      const emailExists = await db.students.findOne({ email: email.toLowerCase().trim() });
      if (emailExists && (!existingStudent || emailExists.firebaseUID !== existingStudent.firebaseUID)) {
        return NextResponse.json(
          { error: "This email is already registered with another account" },
          { status: 409 }
        );
      }
    }

    // ✅ Check for duplicate ERP ID belonging to another student (if enforced)
    if (adminSettings?.enforceUniqueErpId && erpInformation) {
      const erpExists = await db.students.findOne({ erpInformation: erpInformation.trim() });
      if (erpExists && (!existingStudent || erpExists.firebaseUID !== existingStudent.firebaseUID)) {
        return NextResponse.json(
          { error: "This ERP ID is already registered under another student account" },
          { status: 409 }
        );
      }
    }

    // ✅ Check for duplicate face scan belonging to another student (if enforced)
    if (adminSettings?.enforceUniqueFace && faceDescriptor && Array.isArray(faceDescriptor) && faceDescriptor.length > 0) {
      const allStudents = await db.students.list({});
      for (const s of allStudents) {
        if (existingStudent && (s.firebaseUID === existingStudent.firebaseUID || s._id === existingStudent._id)) continue;
        if (s.faceDescriptor && Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === faceDescriptor.length) {
          let sum = 0;
          for (let i = 0; i < faceDescriptor.length; i++) {
            const diff = faceDescriptor[i] - s.faceDescriptor[i];
            sum += diff * diff;
          }
          const distance = Math.sqrt(sum);
          if (distance < 0.35) { // ⚡ Strict 1-to-MANY threshold (<0.35) to prevent false duplicate blocks across dataset
            console.warn(`⚠️ Duplicate face detected during registration! Distance=${distance.toFixed(3)} to existing student "${s.name}" (${s.registrationId || s.phoneNumber})`);
            return NextResponse.json(
              { error: "A student profile with this face scan is already registered" },
              { status: 409 }
            );
          }
        }
      }
    }

    let registrationId = existingStudent?.registrationId;

    if (!registrationId) {
      let targetFormat = "";
      let prefix = "";

      if (hostelName) {
        try {
          const allHostels = await db.hostels.getAll();
          const cleanHostelName = hostelName.trim().toLowerCase();
          const foundHostel = allHostels.find((h: any) => cleanHostelName.includes(h.name.trim().toLowerCase()) || h.name.trim().toLowerCase().includes(cleanHostelName));
          if (foundHostel && foundHostel.registrationFormat) {
            targetFormat = foundHostel.registrationFormat;
          }
        } catch (err) {
          console.warn("Failed to fetch hostel for registration format:", err);
        }
      }

      // Default formats per hostel if not configured
      if (!targetFormat && hostelName) {
        const hUpper = hostelName.toUpperCase();
        if (hUpper.includes("BOYS")) targetFormat = "BOYS-{SEQ4}";
        else if (hUpper.includes("GANGOTRI")) targetFormat = "GANGOTRI-{SEQ4}";
        else if (hUpper.includes("GAYTRI")) targetFormat = "GAYTRI-{SEQ4}";
        else if (hUpper.includes("GHB") || hUpper.includes("GUEST")) targetFormat = "GHB-{SEQ4}";
      }

      // Extract prefix from format (e.g. BOYS from BOYS-{SEQ4})
      prefix = targetFormat ? targetFormat.split(/[-_{]/)[0].toUpperCase() : "";
      if (!prefix) {
        const colName = collegeName ? collegeName.toUpperCase().replace(/[^A-Z]/g, '') : "UNK";
        const yearStr = joiningDate ? new Date(joiningDate).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
        prefix = `ST${colName}${yearStr}`;
      }

      // Find the highest number for this prefix
      const students = await db.students.list({ search: prefix });
      let nextNumber = 1;

      if (students && students.length > 0) {
        const regIds = students
          .map((s: any) => s.registrationId)
          .filter((id: string) => id && id.startsWith(prefix));

        if (regIds.length > 0) {
          const numbers = regIds
            .map((id: string) => {
              const cleanId = id.replace(prefix, '').replace(/[^0-9]/g, '');
              return parseInt(cleanId);
            })
            .filter((n: number) => !isNaN(n));

          if (numbers.length > 0) {
            nextNumber = Math.max(...numbers) + 1;
          }
        }
      }

      const seq4 = String(nextNumber).padStart(4, '0');
      const seq3 = String(nextNumber).padStart(3, '0');
      const currentYearStr = new Date().getFullYear().toString();
      const currentYYStr = currentYearStr.slice(-2);

      if (targetFormat) {
        let resId = targetFormat;
        resId = resId.replace(/{SEQ4}/gi, seq4);
        resId = resId.replace(/{SEQ3}/gi, seq3);
        resId = resId.replace(/{SEQ}/gi, seq4);
        resId = resId.replace(/{YEAR}/gi, currentYearStr);
        resId = resId.replace(/{YY}/gi, currentYYStr);
        if (!targetFormat.includes("{")) {
          resId = `${targetFormat}-${seq4}`;
        }
        registrationId = resId;
      } else {
        registrationId = `${prefix}-${seq4}`;
      }
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
      ...((permanentAddress || body.address || body.homePinCode) && { 
        permanentAddress: validators.sanitizeInput(permanentAddress || body.address || body.homePinCode),
        homePinCode: validators.sanitizeInput(permanentAddress || body.address || body.homePinCode)
      }),
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

    // ✅ NEW: Auto-complete active field enforcements for newly registered/onboarded students
    try {
      const studentHostel = (hostelName || "").trim();
      if (studentHostel && student) {
        const rules = await db.fieldEnforcement.find({
          hostelName: { $regex: `^${studentHostel}$`, $options: "i" },
        });
        const enforcement = rules.find((r: any) => r.isActive);
        if (enforcement) {
          const enabledFields = enforcement.enforcedFields.filter((f: any) => f.isEnabled);
          for (const field of enabledFields) {
            await db.studentFieldProgress.upsert({
              studentId: student._id || student.id,
              firebaseUID: student.firebaseUID,
              hostelName: studentHostel,
              fieldId: field.fieldId,
              fieldLabel: field.fieldLabel,
              isCompleted: true,
              completedAt: new Date(),
            });
          }
          console.log(`[Field Enforcement] Auto-initialized ${enabledFields.length} rules as completed for new student: ${student.name}`);
        }
      }
    } catch (enforceError) {
      console.warn("⚠️ [Field Enforcement] Failed to auto-initialize progress for new onboarding student:", enforceError);
    }

    // 📝 LOG ACTIVITY
    try {
      const operator = request.headers.get("x-admin-email") || "Admin";
      const actionType = existingStudent ? 'UPDATE' : 'ADD';
      await writeHostelActivityLog({
        hostelName: student.hostelName || hostelName,
        actionType,
        studentName: student.name || name || "Unknown Student",
        erpId: student.erpInformation || erpInformation || "N/A",
        operator,
      });
    } catch (logErr) {
      console.error("Failed to write hostel activity log:", logErr);
    }

    return NextResponse.json({ success: true, student }, { status: 200 });
  } catch (error: any) {
    console.error("Error creating/updating student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save student" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, _id, id } = body;
    const targetId = studentId || _id || id;
    if (!targetId) {
      return NextResponse.json({ error: "Missing student ID" }, { status: 400 });
    }

    const updateFields: any = {};
    if (body.name) updateFields.name = body.name.trim();
    if (body.email) updateFields.email = body.email.toLowerCase().trim();
    if (body.phoneNumber) updateFields.phoneNumber = body.phoneNumber.trim();
    if (body.hostelName) updateFields.hostelName = body.hostelName.trim();
    if (body.roomNumber) updateFields.roomNumber = body.roomNumber.trim();
    if (body.fatherName !== undefined) updateFields.fatherName = body.fatherName;
    if (body.fatherNumber !== undefined) updateFields.fatherNumber = body.fatherNumber;
    if (body.motherName !== undefined) updateFields.motherName = body.motherName;
    if (body.motherNumber !== undefined) updateFields.motherNumber = body.motherNumber;
    if (body.collegeName !== undefined) updateFields.collegeName = body.collegeName;
    if (body.branch !== undefined) updateFields.branch = body.branch;
    if (body.year !== undefined) updateFields.year = body.year;
    if (body.semester !== undefined) updateFields.semester = body.semester;
    if (body.section !== undefined) updateFields.section = body.section;
    if (body.homeState !== undefined) updateFields.homeState = body.homeState;
    const targetPermAddress = body.permanentAddress || body.address || body.homePinCode;
    if (targetPermAddress !== undefined && targetPermAddress !== null && targetPermAddress !== "") {
      updateFields.permanentAddress = targetPermAddress;
      updateFields.homePinCode = targetPermAddress;
    }
    if (body.localGuardianAddress !== undefined) updateFields.localGuardianAddress = body.localGuardianAddress;
    if (body.localGuardianPhoneNumber !== undefined) updateFields.localGuardianPhoneNumber = body.localGuardianPhoneNumber;
    if (body.registrationId !== undefined) updateFields.registrationId = body.registrationId;
    if (body.erpInformation !== undefined) updateFields.erpInformation = body.erpInformation;
    if (body.gender !== undefined) updateFields.gender = body.gender;
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.dob !== undefined) updateFields.dob = body.dob;
    if (body.floorNumber !== undefined) updateFields.floorNumber = body.floorNumber;

    const student = await db.students.update(targetId, { $set: updateFields });
    return NextResponse.json({ success: true, student }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating student:", error);
    return NextResponse.json({ error: error.message || "Failed to update student" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const checkValue = searchParams.get("checkValue");
    const checkField = searchParams.get("checkField"); // 'phoneNumber' | 'email' | 'erpInformation'

    if (checkValue && checkField) {
      const query: any = {};
      query[checkField] = checkField === "email" ? checkValue.toLowerCase().trim() : checkValue.trim();
      const existing = await db.students.findOne(query, { minimal: true });
      return NextResponse.json({ exists: !!existing, studentName: existing?.name || null }, { status: 200 });
    }

    const firebaseUID = searchParams.get("firebaseUID");
    const supabaseId = searchParams.get("supabaseId");
    const email = searchParams.get("email");
    const parentPhone = searchParams.get("parentPhone");
    const selectedStudentId = searchParams.get("selectedStudentId");
    const minimal = searchParams.get("minimal") === "true";
    const versionCheck = searchParams.get("versionCheck") === "true";
    const cachedUpdatedAt = searchParams.get("updatedAt");

    const isNotModified = (student: any) => {
      if (!versionCheck || !cachedUpdatedAt || !student?.updatedAt) return false;
      const cachedTime = new Date(cachedUpdatedAt).getTime();
      const serverTime = new Date(student.updatedAt).getTime();
      return Math.abs(serverTime - cachedTime) < 1000;
    };

    if (parentPhone) {
      let cleaned = parentPhone.replace(/\D/g, "");
      if (cleaned.length === 12 && cleaned.startsWith("91")) {
        cleaned = cleaned.substring(2);
      }
      
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        return NextResponse.json({ error: "Tenant context not found" }, { status: 400 });
      }

      const students = await db.students.list({ search: cleaned });

      const cleanDbPhone = (num: string) => num ? num.replace(/\D/g, "").replace(/^91/, "") : "";
      const matchedList = students?.filter((s: any) => {
        const fatherClean = cleanDbPhone(s.fatherNumber);
        const motherClean = cleanDbPhone(s.motherNumber);
        const lgClean = cleanDbPhone(s.localGuardianPhoneNumber);
        return fatherClean === cleaned || motherClean === cleaned || lgClean === cleaned;
      }) || [];

      if (matchedList.length === 0) {
        return NextResponse.json({ error: "Student not found for this parent number" }, { status: 404 });
      }

      let student = matchedList[0];
      if (selectedStudentId) {
        const found = matchedList.find((s: any) => s._id === selectedStudentId);
        if (found) {
          student = found;
        }
      }

      const tenant = student?.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ 
        student, 
        students: matchedList,
        tenantSlug: tenant?.slug,
        tenantSubscription: tenant ? {
          status: tenant.subscriptionStatus,
          endDate: tenant.subscriptionEndDate,
          createdAt: tenant.createdAt
        } : null
      }, { status: 200 });
    }

    if (firebaseUID || email) {
      let student = await (db.students as any).findOneFast({ firebaseUID: firebaseUID || undefined, email: email || undefined }, { minimal });

      if (student && firebaseUID && !student.firebaseUID) {
        db.students.save(student.id || student._id || firebaseUID, {
          ...student,
          firebaseUID: firebaseUID
        }).catch(err => console.error("Non-blocking firebaseUID link error:", err));
        student.firebaseUID = firebaseUID;
      }

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      if (isNotModified(student)) {
        return NextResponse.json({ notModified: true, success: true, studentStatus: student.studentStatus || "in" }, { status: 200 });
      }
      const tenant = student.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ 
        student, 
        tenantSlug: tenant?.slug,
        tenantSubscription: tenant ? {
          status: tenant.subscriptionStatus,
          endDate: tenant.subscriptionEndDate,
          createdAt: tenant.createdAt
        } : null
      }, { status: 200 });
    }

    if (supabaseId) {
      let student = await db.students.findOne({ supabaseId }, { minimal });
      
      // Auto-link fallback: if not found by supabaseId but email is provided
      if (!student && email) {
        console.log(`[Auto-Link] supabaseId search missed. Trying fallback by email: ${email}`);
        student = await db.students.findOne({ email }, { minimal });
        if (student) {
          console.log(`[Auto-Link] Found student by email. Linking to Supabase ID: ${supabaseId}`);
          try {
            await db.students.save(student.firebaseUID, {
              ...student,
              supabaseId,
              authProvider: 'supabase'
            });
            student.supabaseId = supabaseId;
            student.authProvider = 'supabase';
          } catch (linkErr: any) {
            console.error("Failed to auto-link Supabase ID in supabaseId query:", linkErr.message);
          }
        }
      }

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      if (isNotModified(student)) {
        return NextResponse.json({ notModified: true, success: true, studentStatus: student.studentStatus || "in" }, { status: 200 });
      }
      const tenant = student.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ 
        student, 
        tenantSlug: tenant?.slug,
        tenantSubscription: tenant ? {
          status: tenant.subscriptionStatus,
          endDate: tenant.subscriptionEndDate,
          createdAt: tenant.createdAt
        } : null
      }, { status: 200 });
    }

    if (email) {
      const student = await db.students.findOne({ email }, { minimal });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      // Auto-link: if found by email, but supabaseId is missing from DB and provided in query params
      if (supabaseId && !student.supabaseId) {
        console.log(`[Auto-Link] Linking student ${student.email} to Supabase ID: ${supabaseId}`);
        try {
          await db.students.save(student.firebaseUID, {
            ...student,
            supabaseId,
            authProvider: 'supabase'
          });
          student.supabaseId = supabaseId;
          student.authProvider = 'supabase';
        } catch (linkErr: any) {
          console.error("Failed to auto-link Supabase ID in email query:", linkErr.message);
        }
      }

      const tenant = student.tenantId ? await getTenantById(student.tenantId) : null;
      return NextResponse.json({ 
        student, 
        tenantSlug: tenant?.slug,
        tenantSubscription: tenant ? {
          status: tenant.subscriptionStatus,
          endDate: tenant.subscriptionEndDate,
          createdAt: tenant.createdAt
        } : null
      }, { status: 200 });
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

