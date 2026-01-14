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
  },
  {
    timestamps: true,
  }
);

const AdminSettings: Model<IAdminSettings> =
  mongoose.models.AdminSettings ||
  mongoose.model<IAdminSettings>("AdminSettings", AdminSettingsSchema);

export default AdminSettings;




