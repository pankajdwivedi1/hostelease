/**
 * ✅ INPUT VALIDATION & SANITIZATION UTILITY
 * Prevents injection attacks and invalid data
 */

export const validators = {
  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate phone number (Indian format: 10 digits)
   */
  isValidPhoneNumber: (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  },

  /**
   * Validate name (only letters, spaces, hyphens)
   */
  isValidName: (name: string): boolean => {
    // Relaxed name validation: letters, spaces, hyphens, dots, apostrophes, and digits (for some titles)
    const nameRegex = /^[a-zA-Z0-9\s\-.']{2,100}$/;
    return nameRegex.test(name);
  },

  /**
   * Validate PIN code (Indian: 6 digits)
   */
  isValidPinCode: (pinCode: any): boolean => {
    const pinRegex = /^[0-9]{6}$/;
    return pinRegex.test(String(pinCode).trim());
  },

  /**
   * Validate device ID format
   */
  isValidDeviceId: (deviceId: string): boolean => {
    // Device ID should be alphanumeric, min 8 chars
    const deviceRegex = /^[a-zA-Z0-9\-_]{8,100}$/;
    return deviceRegex.test(deviceId);
  },

  /**
   * Sanitize user input - remove dangerous characters
   */
  sanitizeInput: (input: string): string => {
    if (!input) return '';
    return input
      .trim()
      .slice(0, 500) // Max length
      .replace(/[<>\"'`]/g, '') // Remove potentially dangerous chars
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  },

  /**
   * Sanitize email
   */
  sanitizeEmail: (email: string): string => {
    return email.toLowerCase().trim().slice(0, 100);
  },

  /**
   * Sanitize phone number - keep only digits
   */
  sanitizePhoneNumber: (phone: string): string => {
    return phone.replace(/\D/g, '').slice(0, 15);
  },

  /**
   * Validate Firebase UID format
   */
  isValidFirebaseUID: (uid: string): boolean => {
    // Firebase UIDs are typically 28 chars, but can be longer or contain special chars in some cases
    const uidRegex = /^[a-zA-Z0-9\-_]{1,128}$/;
    return uidRegex.test(uid);
  },

  /**
   * Validate registration ID format
   */
  isValidRegistrationId: (regId: string): boolean => {
    // Format: PREFIX-NUMBER (e.g., BOYS-001)
    const regRegex = /^[A-Z]{3,10}-\d{1,10}$/;
    return regRegex.test(regId);
  },

  /**
   * Validate date format (YYYY-MM-DD)
   */
  isValidDateFormat: (date: string): boolean => {
    if (!date) return false;
    // Support YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY
    const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
    const dmyRegex = /^\d{2}-\d{2}-\d{4}$/;
    const dmySlashRegex = /^\d{2}\/\d{2}\/\d{4}$/;

    if (ymdRegex.test(date)) {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }

    if (dmyRegex.test(date) || dmySlashRegex.test(date)) {
      const parts = date.split(/[-/]/);
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const parsedDate = new Date(year, month - 1, day);
      return !isNaN(parsedDate.getTime()) && parsedDate.getDate() === day;
    }

    return false;
  },

  /**
   * Validate hostel name (prevent injection)
   */
  isValidHostelName: (name: string): boolean => {
    // Relaxed hostel name validation: alphanumeric, spaces, hyphens, dots, parentheses, underscores
    const hostelRegex = /^[a-zA-Z0-9\s\-._()]{1,100}$/;
    return hostelRegex.test(name);
  },

  /**
   * Validate time format (HH:mm)
   */
  isValidTimeFormat: (time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  },

  /**
   * Validate latitude/longitude
   */
  isValidCoordinates: (lat: number, lng: number): boolean => {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  },

  /**
   * Validate WiFi BSSID (MAC address format)
   */
  isValidBSSID: (bssid: string): boolean => {
    const bssidRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return bssidRegex.test(bssid);
  },

  /**
   * Format date for DB (converts DD-MM-YYYY to YYYY-MM-DD)
   */
  formatDateForDB: (date: string): string => {
    if (!date) return '';
    const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (ymdRegex.test(date)) return date;

    // Check for DD-MM-YYYY or DD/MM/YYYY
    const dmyRegex = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;
    const match = date.match(dmyRegex);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return date;
  }
};

/**
 * Validate all student registration fields
 * ✅ FIX #10: Only 5 fields are MANDATORY, rest are optional
 */
export function validateStudentRegistration(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // ✅ MANDATORY FIELDS (4 only, Email optional)
  if (!body.firebaseUID || !validators.isValidFirebaseUID(body.firebaseUID)) {
    errors.push('Invalid Firebase UID');
  }

  if ((!body.email || !validators.isValidEmail(body.email)) && !body.phoneNumber) {
    errors.push('Either email or phone number is required');
  }

  if (!body.phoneNumber || !validators.isValidPhoneNumber(body.phoneNumber)) {
    errors.push('Phone number must be 10-13 digits');
  }

  if (!body.hostelName) {
    errors.push('Hostel name is required');
  }

  if (!body.roomNumber) {
    errors.push('Room number is required');
  }

  // ✅ OPTIONAL FIELDS (only validate if provided)
  if (body.name && !validators.isValidName(body.name)) {
    errors.push('Name must be 2-50 characters, letters only');
  }

  // PIN code validation removed as per user request to stop forcing its format


  if (body.hostelName && !validators.isValidHostelName(body.hostelName)) {
    errors.push('Invalid hostel name');
  }

  if (body.dob && !validators.isValidDateFormat(body.dob)) {
    errors.push('Date of birth must be in YYYY-MM-DD format');
  }

  if (body.phoneNumber && body.fatherNumber && body.fatherNumber.trim() !== "" && !validators.isValidPhoneNumber(body.fatherNumber)) {
    errors.push('Father phone must be 10-13 digits');
  }

  if (body.motherNumber && body.motherNumber.trim() !== "" && !validators.isValidPhoneNumber(body.motherNumber)) {
    errors.push('Mother phone must be 10-13 digits');
  }

  if (body.localGuardianPhoneNumber && body.localGuardianPhoneNumber.trim() !== "" && !validators.isValidPhoneNumber(body.localGuardianPhoneNumber)) {
    errors.push('Guardian phone must be 10-13 digits');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default validators;
