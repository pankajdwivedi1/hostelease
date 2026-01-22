import mongoose, { Schema, Model } from "mongoose";



export interface IStudentBase {
  _id?: string;
  firebaseUID: string;
  name: string;
  email: string;
  phoneNumber: string;
  dob?: Date;
  category?: string;
  hostelName: string;
  roomNumber: string;
  profilePicture?: string;
  studentStatus?: "in" | "out";
  fatherName?: string;
  fatherNumber?: string;
  motherName?: string;
  motherNumber?: string;
  homePinCode?: string;
  homeState?: string;
  erpInformation?: string;
  joiningDate?: Date;
  branch?: string;
  collegeName?: string;
  year?: string;
  semester?: string;
  localGuardianAddress?: string;
  localGuardianPhoneNumber?: string;
  section?: string;
  lastCheckInLocation?: {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: Date;
  };
  deviceId?: string;

  registrationId?: string;
  isProfileLocked?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IStudent = IStudentBase;

const StudentSchema = new Schema<IStudent>(
  {
    firebaseUID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: true, // ⚡ INDEXED: Added index for sorting
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    dob: {
      type: Date,
      required: false,
    },
    category: {
      type: String,
      required: false,
    },
    hostelName: {
      type: String,
      required: true,
      index: true,
    },
    roomNumber: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      required: false,
    },
    fatherName: {
      type: String,
      required: false,
    },
    fatherNumber: {
      type: String,
      required: false,
    },
    motherName: {
      type: String,
      required: false,
    },
    motherNumber: {
      type: String,
      required: false,
    },
    homePinCode: {
      type: String,
      required: false,
    },
    homeState: {
      type: String,
      required: false,
    },
    erpInformation: {
      type: String,
      required: false,
    },
    joiningDate: {
      type: Date,
      required: false,
    },
    branch: {
      type: String,
      required: false,
    },
    collegeName: {
      type: String,
      required: false,
    },
    year: {
      type: String,
      required: false,
    },
    semester: {
      type: String,
      required: false,
    },
    localGuardianAddress: {
      type: String,
      required: false,
    },
    localGuardianPhoneNumber: {
      type: String,
      required: false,
    },
    section: {
      type: String,
      required: false,
    },
    studentStatus: {
      type: String,
      enum: ["in", "out"],
      default: "in",
      index: true,
    },
    deviceId: {
      type: String,
      required: false,
      index: true,
    },
    lastCheckInLocation: {
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
      accuracy: { type: Number, required: false },
      timestamp: { type: Date, required: false },
    },
    registrationId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
    },
    isProfileLocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite warning in development
if (process.env.NODE_ENV === "development") {
  delete mongoose.models.Student;
}

const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);

export default Student;
