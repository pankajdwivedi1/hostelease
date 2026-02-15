import mongoose, { Schema, Model } from "mongoose";

export interface IWardenAccount {
  username: string;
  password?: string;
  hostels: string[]; // List of hostel names
}

export interface IAdminSettings {
  _id?: string;
  hostelLocations?: {
    lat: number;
    lng: number;
    radius: number; // radius in meters
    name?: string;
  }[];
  attendanceStartTime?: string; // Format: HH:mm, default 21:00
  attendanceEndTime?: string; // Format: HH:mm, default 22:30
  adminPassword?: string;
  wardenPassword?: string; // Global warden password (legacy)
  wardenAccounts?: IWardenAccount[];
  registrationFieldsConfig?: {
    [key: string]: {
      visible: boolean;
      required: boolean;
      label: string;
    };
  };
  formBuilderConfig?: {
    id: string;
    label: string;
    type: string;
    required: boolean;
    visible: boolean;
    options?: string[];
    section?: string;
  }[];
  universityBankDetails?: {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId: string;
    qrImage?: string; // QR Code as base64 or URL
  };
  hostelFeeAmount?: number;
  paymentInstructions?: string;
  isPaymentEnabled?: boolean; // ⚡ NEW: Global Payment Switch
  wifiWhitelist?: {
    hostelName: string;
    bssids: string[]; // Array of WiFi router MAC addresses (BSSIDs)
    description?: string;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminSettingsSchema = new Schema<IAdminSettings>(
  {
    hostelLocations: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        radius: { type: Number, required: true, default: 200 },
        name: { type: String, required: false },
      },
    ],
    attendanceStartTime: {
      type: String,
      default: "21:00",
    },
    attendanceEndTime: {
      type: String,
      default: "22:30",
    },
    adminPassword: {
      type: String,
      default: "pankajdwivedi81", // Default if not changed
    },
    wardenPassword: {
      type: String,
      default: "warden456", // Default if not changed
    },
    wardenAccounts: {
      type: [{
        username: String,
        password: { type: String, default: "warden456" },
        hostels: [String]
      }],
      default: []
    },
    registrationFieldsConfig: {
      type: Map,
      of: new Schema({
        visible: { type: Boolean, default: true },
        required: { type: Boolean, default: false },
        label: { type: String },
      }),
      default: {
        dob: { visible: true, required: false, label: "Date of Birth" },
        category: { visible: true, required: false, label: "Category" },
        fatherName: { visible: true, required: true, label: "Father's Name" },
        fatherNumber: { visible: true, required: true, label: "Father's Number" },
        motherName: { visible: true, required: false, label: "Mother's Name" },
        motherNumber: { visible: true, required: false, label: "Mother's Number" },
        homePinCode: { visible: true, required: true, label: "Home Pin Code" },
        homeState: { visible: true, required: true, label: "Home State" },
        erpInformation: { visible: true, required: false, label: "ERP/Roll Number" },
        branch: { visible: true, required: true, label: "Branch" },
        collegeName: { visible: true, required: true, label: "College Name" },
        year: { visible: true, required: true, label: "Year" },
        semester: { visible: true, required: true, label: "Semester" },
        localGuardianAddress: { visible: true, required: false, label: "Local Guardian Address" },
        localGuardianPhoneNumber: { visible: true, required: false, label: "Local Guardian Phone" },
        section: { visible: true, required: false, label: "Section" },
      },
    },
    formBuilderConfig: {
      type: [{
        id: String,
        label: String,
        type: { type: String, default: 'text' },
        required: { type: Boolean, default: false },
        visible: { type: Boolean, default: true },
        options: [String],
        section: String
      }],
      default: [
        { id: "name", label: "Full Name", type: "text", required: true, visible: true, section: "Personal" },
        { id: "phoneNumber", label: "Phone Number", type: "text", required: true, visible: true, section: "Personal" },
        { id: "email", label: "Email Address", type: "text", required: true, visible: true, section: "Personal" },
        { id: "dob", label: "Date of Birth", type: "date", required: true, visible: true, section: "Personal" },
        { id: "category", label: "Category", type: "select", options: ["GENERAL", "SC", "ST", "OBC"], required: true, visible: true, section: "Personal" },
        { id: "erpInformation", label: "ERP ID", type: "text", required: true, visible: true, section: "Academic" },
        { id: "collegeName", label: "College Name", type: "select", options: ["OIST", "OCT", "OCP", "OPM", "OIPR"], required: true, visible: true, section: "Academic" },
        { id: "branch", label: "Branch", type: "select", options: ["CS", "AIML", "DS", "ME", "CE", "EC", "IT", "EX", "MCA", "B PHARMA", "D PHARMA", "MBA", "MTECH", "M PHARMA", "CSBS", "CYBER SECURITY"], required: true, visible: true, section: "Academic" },
        { id: "year", label: "Year", type: "select", options: ["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR"], required: true, visible: true, section: "Academic" },
        { id: "semester", label: "Semester", type: "select", options: ["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"], required: true, visible: true, section: "Academic" },
        { id: "section", label: "Section", type: "select", options: ["A", "B", "C", "D", "E", "F"], required: true, visible: true, section: "Academic" },
        { id: "fatherName", label: "Father's Name", type: "text", required: true, visible: true, section: "Guardian" },
        { id: "fatherNumber", label: "Father's Phone", type: "text", required: true, visible: true, section: "Guardian" },
        { id: "motherName", label: "Mother's Name", type: "text", required: true, visible: true, section: "Guardian" },
        { id: "motherNumber", label: "Mother's Phone", type: "text", required: true, visible: true, section: "Guardian" },
        { id: "homePinCode", label: "Address & Pincode", type: "text", required: true, visible: true, section: "Address" },
        { id: "homeState", label: "Home State", type: "select", options: ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL"], required: true, visible: true, section: "Address" },
        { id: "localGuardianAddress", label: "Local Guardian Address", type: "text", required: true, visible: true, section: "Local Guardian" },
        { id: "localGuardianPhoneNumber", label: "Local Guardian Phone", type: "text", required: true, visible: true, section: "Local Guardian" },
      ]
    },
    universityBankDetails: {
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
      upiId: { type: String, default: "" },
      qrImage: { type: String, default: "" },
    },
    hostelFeeAmount: {
      type: Number,
      default: 0,
    },
    paymentInstructions: {
      type: String,
      default: "Please pay the fee and upload your UTR number for verification.",
    },
    isPaymentEnabled: {
      type: Boolean,
      default: false, // Default to disabled
    },
    wifiWhitelist: {
      type: [{
        hostelName: String,
        bssids: [String],
        description: String
      }],
      default: [
        {
          hostelName: "Gangotri hostel",
          bssids: [
            "64:29:43:bb:78:60", // OGH_F0_1 - 2.4GHz
            "64:29:43:bb:78:68", // OGH_F0_1 - 5GHz
            "64:29:43:bb:79:40", // OGH_F0_2 - 2.4GHz
            "64:29:43:bb:79:48", // OGH_F0_2 - 5GHz
            "64:29:43:bb:79:20", // OGH_F1_2 - 2.4GHz
            "64:29:43:bb:79:a8", // OGH_F1_2 - 5GHz
            "64:29:43:bb:78:b0", // OGH_F1_3 - 2.4GHz
            "64:29:43:bb:78:b8", // OGH_F1_3 - 5GHz
            "64:29:43:bb:6f:40", // OGH_F2_3 - 2.4GHz
            "64:29:43:bb:6f:48", // OGH_F2_3 - 5GHz
            "64:29:43:bb:79:58", // OGH_F2_4 - 5GHz
            "64:29:43:bb:84:f0", // OGH_F3_3 - 2.4GHz
            "64:29:43:bb:84:f8", // OGH_F3_3 - 5GHz
            "64:29:43:bb:85:50", // OGH_F3_4 - 2.4GHz
            "64:29:43:bb:85:58"  // OGH_F3_4 - 5GHz
          ],
          description: "Gangotri Hostel WiFi Routers (All Floors)"
        }
      ]
    },

  },
  {
    timestamps: true,
  }
);

const AdminSettings: Model<IAdminSettings> =
  mongoose.models.AdminSettings ||
  mongoose.model<IAdminSettings>("AdminSettings", AdminSettingsSchema);

export default AdminSettings;
