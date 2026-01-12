import mongoose, { Schema, Model, Types } from "mongoose";

export interface IPermission {
  _id?: string;
  studentId: Types.ObjectId;
  fromDateTime: Date;
  toDateTime: Date;
  reason: string;
  status: "pending" | "allowed" | "rejected";
  wardenStatus: "pending" | "allowed" | "rejected";
  deanStatus: "pending" | "allowed" | "rejected";
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
    fromDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    toDateTime: {
      type: Date,
      required: true,
      index: true,
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
    wardenStatus: {
      type: String,
      enum: ["pending", "allowed", "rejected"],
      default: "pending",
      index: true,
    },
    deanStatus: {
      type: String,
      enum: ["pending", "allowed", "rejected"],
      default: "pending",
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

