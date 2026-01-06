import mongoose, { Schema, Model } from "mongoose";

export interface IAdminSettings {
  _id?: string;
  hostelLocation?: {
    lat: number;
    lng: number;
  };
  radius?: number; // in meters, default 100
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
      default: 100, // 100 meters
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


