import mongoose, { Schema, Model } from "mongoose";

export interface IStudent {
  _id?: string;
  firebaseUID: string;
  name: string;
  email: string;
  phoneNumber: string;
  hostelName: string;
  roomNumber: string;
  profilePicture?: string;
  studentStatus?: "in" | "out";
  lastCheckInLocation?: {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

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
  },
  {
    timestamps: true,
  }
);

const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);

export default Student;

