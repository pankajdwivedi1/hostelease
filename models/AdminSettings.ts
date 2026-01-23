import mongoose, { Schema, Model } from "mongoose";

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
  registrationFieldsConfig?: {
    [key: string]: {
      visible: boolean;
      required: boolean;
      label: string;
    };
  };
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
  },
  {
    timestamps: true,
  }
);

const AdminSettings: Model<IAdminSettings> =
  mongoose.models.AdminSettings ||
  mongoose.model<IAdminSettings>("AdminSettings", AdminSettingsSchema);

export default AdminSettings;




