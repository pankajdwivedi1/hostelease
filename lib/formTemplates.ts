export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;       // regex string
  patternMessage?: string; // custom error message for pattern
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  visible: boolean;
  section: string;
  options?: string[];
  validation?: FieldValidation;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: FormField[];
}

// 🎓 College/University Onboarding Template
export const collegeTemplate: FormField[] = [
  { id: "profilePicture", label: "Profile Photo", type: "image", required: true, visible: true, section: "Personal" },
  { id: "name", label: "Full Name", type: "text", required: true, visible: true, section: "Personal", validation: { minLength: 3, maxLength: 80, patternMessage: "Enter at least 3 characters" } },
  { id: "phoneNumber", label: "Phone Number", type: "tel", required: true, visible: true, section: "Personal", validation: { pattern: "^[6-9]\\d{9}$", patternMessage: "Enter a valid 10-digit Indian mobile number" } },
  { id: "gender", label: "GENDER", type: "select", options: ["MALE", "FEMALE", "TRANSGENDER"], required: true, visible: true, section: "Personal" },
  { id: "dob", label: "Date of Birth", type: "date", required: true, visible: true, section: "Personal" },
  { id: "category", label: "Social Category", type: "select", options: ["GENERAL", "OBC", "SC", "ST"], required: true, visible: true, section: "Personal" },
  { id: "erpInformation", label: "ERP ID", type: "text", required: true, visible: true, section: "Academic" },
  { id: "collegeName", label: "College Name", type: "select", options: ["OIST", "OCT", "OCP", "OPM", "OIPR"], required: true, visible: true, section: "Academic" },
  { id: "branch", label: "Branch", type: "select", options: ["CS", "AIML", "DS", "ME", "CE", "EC", "IT", "EX", "MCA", "B PHARMA", "D PHARMA", "MBA", "MTECH", "M PHARMA", "CSBS", "CYBER SECURITY"], required: true, visible: true, section: "Academic" },
  { id: "year", label: "Current Year", type: "select", options: ["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR"], required: true, visible: true, section: "Academic" },
  { id: "semester", label: "Semester", type: "select", options: ["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"], required: true, visible: true, section: "Academic" },
  { id: "section", label: "Section", type: "select", options: ["A", "B", "C", "D", "E", "F"], required: true, visible: true, section: "Academic" },
  { id: "fatherName", label: "Father's Name", type: "text", required: true, visible: true, section: "Guardian", validation: { minLength: 3 } },
  { id: "fatherNumber", label: "Father's Phone No", type: "tel", required: true, visible: true, section: "Guardian", validation: { pattern: "^[6-9]\\d{9}$", patternMessage: "Enter a valid 10-digit mobile number" } },
  { id: "motherName", label: "Mother's Name", type: "text", required: true, visible: true, section: "Guardian", validation: { minLength: 3 } },
  { id: "motherNumber", label: "Mother's Phone No", type: "tel", required: true, visible: true, section: "Guardian", validation: { pattern: "^[6-9]\\d{9}$", patternMessage: "Enter a valid 10-digit mobile number" } },
  { id: "localGuardianAddress", label: "Local Guardian Address", type: "textarea", required: false, visible: true, section: "Guardian" },
  { id: "localGuardianPhoneNumber", label: "Local Guardian Phone", type: "tel", required: false, visible: true, section: "Guardian", validation: { pattern: "^[6-9]\\d{9}$", patternMessage: "Enter a valid 10-digit mobile number" } },
  { id: "homeState", label: "Home State", type: "select", options: ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JAMMU & KASHMIR", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"], required: true, visible: true, section: "Address" },
  { id: "permanentAddress", label: "Permanent Address", type: "textarea", required: true, visible: true, section: "Address" },
  { id: "hostelName", label: "Hostel Name", type: "select", options: ["BOYS HOSTEL", "GIRLS HOSTEL"], required: true, visible: true, section: "Registration" },
  { id: "floorNumber", label: "Floor Number", type: "select", options: ["GND FLOOR", "1ST FLOOR", "2ND FLOOR", "3RD FLOOR", "4TH FLOOR"], required: true, visible: true, section: "Registration" },
  { id: "roomNumber", label: "Room Number", type: "text", required: true, visible: true, section: "Registration" },
  { id: "joiningDate", label: "Joining Date", type: "date", required: true, visible: true, section: "Registration" }
];

// 🏫 School Onboarding Template
export const schoolTemplate: FormField[] = [
  { id: "profilePicture", label: "Profile Photo", type: "image", required: true, visible: true, section: "Personal" },
  { id: "name", label: "Full Name", type: "text", required: true, visible: true, section: "Personal" },
  { id: "gender", label: "GENDER", type: "select", options: ["MALE", "FEMALE"], required: true, visible: true, section: "Personal" },
  { id: "dob", label: "Date of Birth", type: "date", required: true, visible: true, section: "Personal" },
  { id: "category", label: "Social Category", type: "select", options: ["GENERAL", "OBC", "SC", "ST"], required: true, visible: true, section: "Personal" },
  { id: "erpInformation", label: "Admission Number", type: "text", required: true, visible: true, section: "Academic" },
  { id: "year", label: "Class / Grade", type: "select", options: ["CLASS 1", "CLASS 2", "CLASS 3", "CLASS 4", "CLASS 5", "CLASS 6", "CLASS 7", "CLASS 8", "CLASS 9", "CLASS 10", "CLASS 11", "CLASS 12"], required: true, visible: true, section: "Academic" },
  { id: "section", label: "Section", type: "select", options: ["A", "B", "C", "D"], required: true, visible: true, section: "Academic" },
  { id: "registrationId", label: "Roll Number", type: "text", required: true, visible: true, section: "Academic" },
  { id: "custom_transport_route", label: "Transport Route", type: "select", options: ["ROUTE 1", "ROUTE 2", "ROUTE 3", "SELF/PARENT DROP"], required: false, visible: true, section: "Academic" },
  { id: "fatherName", label: "Father's Name", type: "text", required: true, visible: true, section: "Guardian" },
  { id: "fatherNumber", label: "Father's Phone No", type: "tel", required: true, visible: true, section: "Guardian" },
  { id: "motherName", label: "Mother's Name", type: "text", required: true, visible: true, section: "Guardian" },
  { id: "motherNumber", label: "Mother's Phone No", type: "tel", required: true, visible: true, section: "Guardian" },
  { id: "homeState", label: "Home State", type: "select", options: ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JAMMU & KASHMIR", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"], required: true, visible: true, section: "Address" },
  { id: "permanentAddress", label: "Permanent Address", type: "textarea", required: true, visible: true, section: "Address" },
  { id: "hostelName", label: "Hostel Building Name", type: "select", options: ["Junior Dorms", "Senior Boys Dorms", "Girls Dorms"], required: true, visible: true, section: "Registration" },
  { id: "floorNumber", label: "Floor Number", type: "select", options: ["GND FLOOR", "1ST FLOOR", "2ND FLOOR"], required: true, visible: true, section: "Registration" },
  { id: "roomNumber", label: "Room / Dorm Number", type: "text", required: true, visible: true, section: "Registration" },
  { id: "joiningDate", label: "Admission Joining Date", type: "date", required: true, visible: true, section: "Registration" }
];

// 🏢 Private Hostel / PG Template
export const hostelTemplate: FormField[] = [
  { id: "profilePicture", label: "Profile Photo", type: "image", required: true, visible: true, section: "Personal" },
  { id: "name", label: "Full Name", type: "text", required: true, visible: true, section: "Personal" },
  { id: "phoneNumber", label: "Phone Number", type: "tel", required: true, visible: true, section: "Personal" },
  { id: "email", label: "Email Address", type: "text", required: true, visible: true, section: "Personal", validation: { pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", patternMessage: "Enter a valid email address" } },
  { id: "gender", label: "GENDER", type: "select", options: ["MALE", "FEMALE", "OTHER"], required: true, visible: true, section: "Personal" },
  { id: "dob", label: "Date of Birth", type: "date", required: false, visible: true, section: "Personal" },
  { id: "custom_gov_id_type", label: "Government ID Type", type: "select", options: ["AADHAR CARD", "PAN CARD", "PASSPORT", "DRIVING LICENSE"], required: true, visible: true, section: "Personal" },
  { id: "custom_gov_id_num", label: "Government ID Number", type: "text", required: true, visible: true, section: "Personal", validation: { minLength: 10, maxLength: 16, patternMessage: "Enter a valid government ID number (10-16 characters)" } },
  { id: "erpInformation", label: "Profession / Organization", type: "text", required: false, visible: true, section: "Academic" },
  { id: "fatherName", label: "Emergency Contact Name", type: "text", required: true, visible: true, section: "Guardian" },
  { id: "fatherNumber", label: "Emergency Contact Phone", type: "tel", required: true, visible: true, section: "Guardian" },
  { id: "homeState", label: "Home State", type: "select", options: ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JAMMU & KASHMIR", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"], required: true, visible: true, section: "Address" },
  { id: "permanentAddress", label: "Permanent Address", type: "textarea", required: true, visible: true, section: "Address" },
  { id: "hostelName", label: "PG / Hostel Branch", type: "select", options: ["Downtown Hostel", "Westside PG", "North Annex PG"], required: true, visible: true, section: "Registration" },
  { id: "roomNumber", label: "Room Number", type: "text", required: true, visible: true, section: "Registration" },
  { id: "custom_room_sharing", label: "Room Sharing Option", type: "select", options: ["SINGLE SHARING", "DOUBLE SHARING", "TRIPLE SHARING"], required: true, visible: true, section: "Registration" },
  { id: "joiningDate", label: "Hostel Joining Date", type: "date", required: true, visible: true, section: "Registration" }
];

export const formTemplates: FormTemplate[] = [
  {
    id: "college",
    name: "College & University Template",
    description: "Standard layout for higher education institutions. Collects branch, semester, year, section, and ERP registration info.",
    icon: "🎓",
    fields: collegeTemplate
  },
  {
    id: "school",
    name: "K-12 School Template",
    description: "Tailored for primary and secondary boarding schools. Includes fields for Class/Grade, Roll Number, and School Admission info.",
    icon: "🏫",
    fields: schoolTemplate
  },
  {
    id: "hostel",
    name: "Private Hostel & PG Template",
    description: "Best for private accommodations and paying guest (PG) houses. Collects Gov ID (Aadhar/PAN), room sharing preferences, and emergency info.",
    icon: "🏢",
    fields: hostelTemplate
  }
];
