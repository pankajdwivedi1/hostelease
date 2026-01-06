import mongoose, { Schema, Model, Types } from "mongoose";

export interface IPermission {
  _id?: string;
  studentId: Types.ObjectId;
  fromTime: string;
  toTime: string;
  reason: string;
  status: "pending" | "allowed" | "rejected";
  date: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const PermissionSchema = new Schema<IPermission>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    fromTime: {
      type: String,
      required: true,
    },
    toTime: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "allowed", "rejected"],
      default: "pending",
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PermissionSchema.index({ createdAt: -1 });

const Permission: Model<IPermission> =
  mongoose.models.Permission ||
  mongoose.model<IPermission>("Permission", PermissionSchema);

export default Permission;

