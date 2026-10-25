/**
 * ERP ID Validation & College Prefix Resolver for Oriental Group of Institutes (OGI)
 *
 * Supported Colleges:
 *   - OIST  (Oriental Institute of Science & Technology) -> Prefix: STOIST
 *   - OCT   (Oriental College of Technology)             -> Prefix: STOCT
 *   - OCP   (Oriental College of Pharmacy)               -> Prefix: STOCP
 *   - OPM   (Oriental College of Management)             -> Prefix: STOPM
 *   - OIPR  (Oriental Institute of Professional Studies) -> Prefix: STOIPR
 */

export interface CollegeInfo {
  college: "OIST" | "OCT" | "OCP" | "OPM" | "OIPR";
  prefix: "STOIST" | "STOCT" | "STOCP" | "STOPM" | "STOIPR";
  placeholder: string;
}

export const OGI_COLLEGE_CONFIG: Record<string, CollegeInfo> = {
  OIST: { college: "OIST", prefix: "STOIST", placeholder: "Enter your official College ERP ID" },
  OCT: { college: "OCT", prefix: "STOCT", placeholder: "Enter your official College ERP ID" },
  OCP: { college: "OCP", prefix: "STOCP", placeholder: "Enter your official College ERP ID" },
  OPM: { college: "OPM", prefix: "STOPM", placeholder: "Enter your official College ERP ID" },
  OIPR: { college: "OIPR", prefix: "STOIPR", placeholder: "Enter your official College ERP ID" },
};

/**
 * Determine the student's college and expected ERP prefix based on their profile data
 */
export function resolveCollegeAndErpPrefix(studentOrProfile: any): CollegeInfo {
  if (!studentOrProfile) {
    return OGI_COLLEGE_CONFIG.OIST;
  }

  const raw = [
    studentOrProfile.collegeName || "",
    studentOrProfile.college || "",
    studentOrProfile.tenantId || "",
    studentOrProfile.registrationId || "",
    studentOrProfile.email || "",
    JSON.stringify(studentOrProfile.dynamicFields || {}),
  ]
    .join(" ")
    .toUpperCase();

  if (raw.includes("0108") || raw.includes("OCT")) {
    return OGI_COLLEGE_CONFIG.OCT;
  }
  if (raw.includes("0107") || raw.includes("OCP") || raw.includes("PHARMA")) {
    return OGI_COLLEGE_CONFIG.OCP;
  }
  if (raw.includes("0109") || raw.includes("OPM")) {
    return OGI_COLLEGE_CONFIG.OPM;
  }
  if (raw.includes("OIPR")) {
    return OGI_COLLEGE_CONFIG.OIPR;
  }

  // Default to OIST (0105)
  return OGI_COLLEGE_CONFIG.OIST;
}

/**
 * Check if a given field is an ERP ID / College Registration field
 */
export function isErpField(fieldId: string = "", fieldLabel: string = ""): boolean {
  const fid = (fieldId || "").toLowerCase();
  const flbl = (fieldLabel || "").toLowerCase();

  return (
    fid === "erpinformation" ||
    fid === "erpid" ||
    fid === "erp_id" ||
    fid === "registrationid" ||
    fid === "registration_id" ||
    flbl.includes("erp") ||
    flbl === "erp id" ||
    flbl === "college erp id"
  );
}

export interface ErpValidationResult {
  isValid: boolean;
  error: string | null;
  cleanedValue: string;
}

/**
 * Comprehensive Anti-Dummy / Anti-Fake ERP ID Validator
 *
 * Rules:
 *   1. ADMIN / GUEST EXEMPTION: Admins and Guest accounts are never blocked.
 *   2. Reject blank / empty
 *   3. Reject 10-digit mobile numbers (e.g., 7804856308, 9171586074)
 *   4. Require valid OGI prefix (STOIST, STOCT, STOCP, STOPM, STOIPR)
 *   5. Require prefix to match student's college if college is known
 *   6. Check length: prefix + 2 to 8 digits (supports 2, 3, 4, 5, 6, 7 digits)
 *   7. Reject all zeros (e.g., STOIST00, STOIST000000)
 *   8. Reject dummy all-same digits (e.g., STOIST111111, STOIST999999)
 *   9. Reject sequential digits for 4+ digits (e.g., STOIST123456, STOIST654321)
 */
export function validateErpId(
  value: string = "",
  expectedCollege?: string,
  options?: { isAdmin?: boolean }
): ErpValidationResult {
  const cleaned = (value || "").toString().trim().toUpperCase().replace(/\s+/g, "");

  // 0. ADMIN EXEMPTION: Never restrict admin accounts
  if (options?.isAdmin) {
    return { isValid: true, error: null, cleanedValue: cleaned };
  }

  if (!cleaned) {
    return { isValid: false, error: "ERP ID is required.", cleanedValue: "" };
  }

  // 1. Mobile number check (10 digits starting with 6, 7, 8, or 9, or standard 10 digits)
  if (/^[6-9]\d{9}$/.test(cleaned) || /^\d{10}$/.test(cleaned)) {
    return {
      isValid: false,
      error: "Mobile numbers are not allowed. Please enter your College ERP ID.",
      cleanedValue: cleaned,
    };
  }

  // 2. Room number or short serial number without letters
  if (/^\d{1,4}$/.test(cleaned)) {
    return {
      isValid: false,
      error: "Room numbers or short digits are not allowed. Must start with your college prefix.",
      cleanedValue: cleaned,
    };
  }

  // 3. OGI College Prefix check
  const ogiPrefixes: Array<"STOIST" | "STOCT" | "STOCP" | "STOPM" | "STOIPR"> = [
    "STOIST",
    "STOCT",
    "STOCP",
    "STOPM",
    "STOIPR",
  ];
  const matchedPrefix = ogiPrefixes.find((p) => cleaned.startsWith(p));

  if (!matchedPrefix) {
    return {
      isValid: false,
      error: "Must start with your college prefix: STOIST, STOCT, STOCP, STOPM, or STOIPR.",
      cleanedValue: cleaned,
    };
  }

  // 4. College match verification
  if (expectedCollege) {
    const exp = expectedCollege.toUpperCase();
    let expectedPrefix = "";
    if (exp.includes("OCT") || exp.includes("0108")) expectedPrefix = "STOCT";
    else if (exp.includes("OCP") || exp.includes("0107") || exp.includes("PHARMA")) expectedPrefix = "STOCP";
    else if (exp.includes("OPM") || exp.includes("0109")) expectedPrefix = "STOPM";
    else if (exp.includes("OIPR")) expectedPrefix = "STOIPR";
    else if (exp.includes("OIST") || exp.includes("0105")) expectedPrefix = "STOIST";

    if (expectedPrefix && matchedPrefix !== expectedPrefix) {
      return {
        isValid: false,
        error: `Your registered college is ${expectedPrefix.replace("ST", "")}. Your ERP ID must start with "${expectedPrefix}".`,
        cleanedValue: cleaned,
      };
    }
  }

  // 5. Digits / Body verification (Allows 2, 3, 4, 5, 6, 7, 8 digits)
  const body = cleaned.slice(matchedPrefix.length);

  if (!body || body.length < 2) {
    return {
      isValid: false,
      error: `ERP ID number is too short. Please check your College ID Card / Fee Receipt.`,
      cleanedValue: cleaned,
    };
  }

  if (body.length > 9) {
    return {
      isValid: false,
      error: `ERP ID has too many digits. Check your ID card / fee receipt.`,
      cleanedValue: cleaned,
    };
  }

  if (!/^\d+$/.test(body)) {
    return {
      isValid: false,
      error: `Characters after ${matchedPrefix} must be numbers only. Check your ID card / Fee receipt.`,
      cleanedValue: cleaned,
    };
  }

  // 6. Anti-Dummy Check: Reject all zeros (e.g., STOIST00, STOIST000, STOIST00000000)
  const uniqueChars = new Set(body.split(""));
  if (uniqueChars.size === 1 && body[0] === "0") {
    return {
      isValid: false,
      error: `All-zero numbers like ${matchedPrefix}${body} are strictly not acceptable.`,
      cleanedValue: cleaned,
    };
  }

  // Reject repeated digits for 4 or more digits (e.g. 1111, 999999)
  if (body.length >= 4 && uniqueChars.size <= 1) {
    return {
      isValid: false,
      error: `Dummy numbers like ${matchedPrefix}${body} are strictly not acceptable.`,
      cleanedValue: cleaned,
    };
  }

  // 7. Anti-Sequential Check: Ascending / Descending sequences for 4 or more digits (e.g. 1234, 123456, 654321)
  if (body.length >= 4) {
    let isAscending = true;
    let isDescending = true;
    for (let i = 1; i < body.length; i++) {
      const prev = parseInt(body[i - 1], 10);
      const curr = parseInt(body[i], 10);
      if (curr !== prev + 1) isAscending = false;
      if (curr !== prev - 1) isDescending = false;
    }
    if (isAscending || isDescending) {
      return {
        isValid: false,
        error: `Sequential fake numbers like ${matchedPrefix}${body} are not acceptable.`,
        cleanedValue: cleaned,
      };
    }
  }

  // 8. Anti-Repetitive Pattern: e.g., 121212 or 123123
  if (
    (body.length === 6 && (body.slice(0, 3) === body.slice(3) || body.slice(0, 2).repeat(3) === body)) ||
    (body.length === 8 && body.slice(0, 4) === body.slice(4))
  ) {
    return {
      isValid: false,
      error: `Repeated pattern like ${matchedPrefix}${body} is not acceptable.`,
      cleanedValue: cleaned,
    };
  }

  return {
    isValid: true,
    error: null,
    cleanedValue: cleaned,
  };
}
