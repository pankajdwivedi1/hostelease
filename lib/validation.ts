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
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  },

  /**
   * Validate name (only letters, spaces, hyphens)
   */
  isValidName: (name: string): boolean => {
    const nameRegex = /^[a-zA-Z\s\-']{2,50}$/;
    return nameRegex.test(name);
  },

  /**
   * Validate PIN code (Indian: 6 digits)
   */
  isValidPinCode: (pinCode: string): boolean => {
    const pinRegex = /^[0-9]{6}$/;
    return pinRegex.test(pinCode);
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
    // Firebase UIDs are alphanumeric, typically 28 chars
    const uidRegex = /^[a-zA-Z0-9]{1,128}$/;
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
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    
    const parsedDate = new Date(date);
    return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
  },

  /**
   * Validate hostel name (prevent injection)
   */
  isValidHostelName: (name: string): boolean => {
    const hostelRegex = /^[a-zA-Z\s\-]{1,50}$/;
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
  }
};

/**
 * Validate all student registration fields
 * ✅ FIX #10: Only 5 fields are MANDATORY, rest are optional
 */
export function validateStudentRegistration(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // ✅ MANDATORY FIELDS (5 only)
  if (!body.firebaseUID || !validators.isValidFirebaseUID(body.firebaseUID)) {
    errors.push('Invalid Firebase UID');
  }

  if (!body.email || !validators.isValidEmail(body.email)) {
    errors.push('Invalid email format');
  }

  if (!body.phoneNumber || !validators.isValidPhoneNumber(body.phoneNumber)) {
    errors.push('Phone number must be 10 digits');
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

  if (body.homePinCode && !validators.isValidPinCode(body.homePinCode)) {
    errors.push('PIN code must be 6 digits');
  }

  if (body.hostelName && !validators.isValidHostelName(body.hostelName)) {
    errors.push('Invalid hostel name');
  }

  if (body.dob && !validators.isValidDateFormat(body.dob)) {
    errors.push('Date of birth must be in YYYY-MM-DD format');
  }

  if (body.phoneNumber && body.fatherNumber && !validators.isValidPhoneNumber(body.fatherNumber)) {
    errors.push('Father phone must be 10 digits');
  }

  if (body.motherNumber && !validators.isValidPhoneNumber(body.motherNumber)) {
    errors.push('Mother phone must be 10 digits');
  }

  if (body.localGuardianPhoneNumber && !validators.isValidPhoneNumber(body.localGuardianPhoneNumber)) {
    errors.push('Guardian phone must be 10 digits');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default validators;
