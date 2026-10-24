import { prisma } from "@/lib/prisma";

export interface StudentUniquenessInput {
  currentStudentId?: string | null;
  phoneNumber?: string | null;
  erpInformation?: string | null;
  erpId?: string | null;
  email?: string | null;
  registrationId?: string | null;
  tenantId?: string | null;
}

export interface StudentUniquenessResult {
  hasConflict: boolean;
  field?: "phoneNumber" | "erpInformation" | "email" | "registrationId";
  conflictMessage?: string;
  conflictingStudent?: {
    id: string;
    name: string;
    registrationId: string | null;
    hostelName: string | null;
    roomNumber: string | null;
  };
}

/**
 * 🛡️ STUDENT UNIQUENESS GUARDIAN
 *
 * Enforces strict database uniqueness across students for:
 *   - Student Mobile Number (phoneNumber)
 *   - College ERP ID (erpInformation / erpId)
 *   - Student Registration ID (registrationId)
 *   - Student Email ID (email)
 *
 * NOTE: Parent numbers (fatherNumber, motherNumber, localGuardianPhoneNumber)
 * are DELIBERATELY EXEMPTED so siblings can share the same parents.
 */
export async function checkStudentUniqueness(
  input: StudentUniquenessInput
): Promise<StudentUniquenessResult> {
  const { currentStudentId, phoneNumber, erpInformation, erpId, email, registrationId, tenantId } = input;

  // 1. Identify the current student record to safely exclude them from self-collision
  let excludeId: string | null = null;
  let excludeFirebaseUid: string | null = null;

  if (currentStudentId && typeof currentStudentId === "string" && currentStudentId.trim()) {
    const cleanCurrent = currentStudentId.trim();
    try {
      const self = await prisma.student.findFirst({
        where: {
          OR: [
            { id: cleanCurrent },
            { firebaseUid: cleanCurrent },
            { registrationId: { equals: cleanCurrent, mode: "insensitive" } }
          ]
        },
        select: { id: true, firebaseUid: true }
      });
      if (self) {
        excludeId = self.id;
        excludeFirebaseUid = self.firebaseUid;
      } else {
        excludeId = cleanCurrent;
      }
    } catch (err) {
      excludeId = cleanCurrent;
    }
  }

  const notCurrentConditions: any[] = [];
  if (excludeId) {
    notCurrentConditions.push({ id: { not: excludeId } });
  }
  if (excludeFirebaseUid) {
    notCurrentConditions.push({ firebaseUid: { not: excludeFirebaseUid } });
  }

  const baseWhere: any = {};
  if (notCurrentConditions.length > 0) {
    baseWhere.AND = notCurrentConditions;
  }
  if (tenantId) {
    baseWhere.tenantId = tenantId;
  }

  // 2. CHECK STUDENT MOBILE NUMBER
  if (phoneNumber && typeof phoneNumber === "string") {
    const rawPhone = phoneNumber.trim();
    const digits = rawPhone.replace(/\D/g, "");
    const last10 = digits.length >= 10 ? digits.slice(-10) : "";

    if (last10.length === 10) {
      try {
        const phoneVariants = [
          last10,
          `+91${last10}`,
          `+91 ${last10}`,
          `0${last10}`,
          rawPhone
        ];

        const conflict = await prisma.student.findFirst({
          where: {
            ...baseWhere,
            OR: [
              { phoneNumber: { in: phoneVariants } },
              { phoneNumber: { endsWith: last10 } }
            ]
          },
          select: { id: true, name: true, registrationId: true, hostelName: true, roomNumber: true }
        });

        if (conflict) {
          const studentDesc = conflict.name 
            ? `"${conflict.name}" (${conflict.registrationId || conflict.roomNumber || "another student"})`
            : conflict.registrationId || "another student";
          return {
            hasConflict: true,
            field: "phoneNumber",
            conflictMessage: `This mobile number (${rawPhone}) is already registered under student ${studentDesc}. Student mobile numbers must be unique.`,
            conflictingStudent: conflict
          };
        }
      } catch (err) {
        console.warn("[UniquenessCheck] Error querying phone number:", err);
      }
    }
  }

  // 3. CHECK COLLEGE ERP ID
  const rawErp = (erpInformation || erpId || "").trim();
  if (
    rawErp &&
    typeof rawErp === "string" &&
    rawErp.toUpperCase() !== "N/A" &&
    rawErp !== "0" &&
    rawErp !== "000000" &&
    rawErp.length >= 4
  ) {
    const cleanErp = rawErp.toUpperCase();
    try {
      const conflict = await prisma.student.findFirst({
        where: {
          ...baseWhere,
          OR: [
            { erpInformation: { equals: cleanErp, mode: "insensitive" } },
            { erpId: { equals: cleanErp, mode: "insensitive" } }
          ]
        },
        select: { id: true, name: true, registrationId: true, hostelName: true, roomNumber: true }
      });

      if (conflict) {
        const studentDesc = conflict.name 
          ? `"${conflict.name}" (${conflict.registrationId || conflict.roomNumber || "another student"})`
          : conflict.registrationId || "another student";
        return {
          hasConflict: true,
          field: "erpInformation",
          conflictMessage: `This ERP ID (${cleanErp}) is already registered under student ${studentDesc}. Each student must have a unique College ERP ID.`,
          conflictingStudent: conflict
        };
      }
    } catch (err) {
      console.warn("[UniquenessCheck] Error querying ERP ID:", err);
    }
  }

  // 4. CHECK STUDENT REGISTRATION ID
  if (registrationId && typeof registrationId === "string") {
    const rawReg = registrationId.trim();
    if (rawReg && rawReg.toUpperCase() !== "N/A" && !rawReg.toUpperCase().startsWith("GUEST")) {
      const cleanReg = rawReg.toUpperCase();
      try {
        const conflict = await prisma.student.findFirst({
          where: {
            ...baseWhere,
            registrationId: { equals: cleanReg, mode: "insensitive" }
          },
          select: { id: true, name: true, registrationId: true, hostelName: true, roomNumber: true }
        });

        if (conflict) {
          const studentDesc = conflict.name 
            ? `"${conflict.name}" (${conflict.hostelName || ""}, Room ${conflict.roomNumber || ""})`
            : "another student";
          return {
            hasConflict: true,
            field: "registrationId",
            conflictMessage: `This Registration ID (${cleanReg}) is already assigned to student ${studentDesc}.`,
            conflictingStudent: conflict
          };
        }
      } catch (err) {
        console.warn("[UniquenessCheck] Error querying Registration ID:", err);
      }
    }
  }

  // 5. CHECK STUDENT EMAIL ID
  if (email && typeof email === "string") {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail && cleanEmail.includes("@")) {
      try {
        const conflict = await prisma.student.findFirst({
          where: {
            ...baseWhere,
            email: { equals: cleanEmail, mode: "insensitive" }
          },
          select: { id: true, name: true, registrationId: true, hostelName: true, roomNumber: true }
        });

        if (conflict) {
          const studentDesc = conflict.name 
            ? `"${conflict.name}" (${conflict.registrationId || "another student"})`
            : conflict.registrationId || "another student";
          return {
            hasConflict: true,
            field: "email",
            conflictMessage: `This email address (${cleanEmail}) is already registered under student ${studentDesc}.`,
            conflictingStudent: conflict
          };
        }
      } catch (err) {
        console.warn("[UniquenessCheck] Error querying Email ID:", err);
      }
    }
  }

  return { hasConflict: false };
}
