import mongoose, { Schema, Model } from "mongoose";

export interface IAuthenticator {
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports?: string[];
}

export interface IStudentBase {
  _id?: string;
  firebaseUID: string;
  name: string;
  email: string;
  phoneNumber: string;
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
  authenticators?: IAuthenticator[];
  currentChallenge?: string;
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
    lastCheckInLocation: {
      lat: {
        type: Number,
        required: false,
      },
      lng: {
        type: Number,
        required: false,
      },
      accuracy: {
        type: Number,
        required: false,
      },
      timestamp: {
        type: Date,
        required: false,
      },
    },
    authenticators: [{
      credentialID: { type: String, required: true },
      credentialPublicKey: { type: String, required: true },
      counter: { type: Number, required: true },
      credentialDeviceType: { type: String, required: true },
      credentialBackedUp: { type: Boolean, required: true },
      transports: [String],
    }],
    currentChallenge: { type: String, required: false },
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
