import mongoose, { Schema, Model } from "mongoose";

export interface IAdminSettings {
  _id?: string;
  hostelLocation?: {
    lat: number;
    lng: number;
  };
  radius?: number; // in meters, default 100
  attendanceStartTime?: string; // Format: HH:mm, default 18:00
  attendanceEndTime?: string; // Format: HH:mm, default 21:00
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminSettingsSchema = new Schema<IAdminSettings>(
  {
    hostelLocation: {
      lat: {
        type: Number,
        required: false,
      },
      lng: {
        type: Number,
        required: false,
      },
    },
    radius: {
      type: Number,
      default: 200, // 200 meters
    },
    attendanceStartTime: {
      type: String,
      default: "21:00",
    },
    attendanceEndTime: {
      type: String,
      default: "22:30",
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




