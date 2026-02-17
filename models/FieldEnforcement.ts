import mongoose, { Schema, Model, Document } from "mongoose";

export interface IEnforcedField {
  fieldId: string; // e.g., "fatherName", "phoneNumber"
  fieldLabel: string; // e.g., "Father's Name"
  isEnabled: boolean; // Whether this field is being enforced
  displayMode: "on-login" | "on-first-incomplete" | "on-next-login"; // When to display
  durationDays?: number; // How many days to display (if null, until completed)
  skipCompletedTitle?: string; // Title shown after field is completed
  skipCompleted?: boolean; // Should be hidden after completion
  order?: number; // Display order
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IFieldEnforcement extends Document {
  hostelName: string;
  enforcedFields: IEnforcedField[];
  isActive: boolean; // Master switch for field enforcement
  notificationPriority: "normal" | "urgent" | "critical";
  successMessage?: string; // Message shown after all fields are completed
  autoCloseNotification?: boolean; // Automatically close notification after completion
  createdAt: Date;
  updatedAt: Date;
}

const EnforcedFieldSchema = new Schema(
  {
    fieldId: {
      type: String,
      required: true,
    },
    fieldLabel: {
      type: String,
      required: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    displayMode: {
      type: String,
      enum: ["on-login", "on-first-incomplete", "on-next-login"],
      default: "on-login",
    },
    durationDays: {
      type: Number,
    },
    skipCompletedTitle: {
      type: String,
      default: "✓ Completed",
    },
    skipCompleted: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
    },
  },
  { _id: false }
);

const FieldEnforcementSchema = new Schema<IFieldEnforcement>(
  {
    hostelName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enforcedFields: [EnforcedFieldSchema],
    isActive: {
      type: Boolean,
      default: false,
    },
    notificationPriority: {
      type: String,
      enum: ["normal", "urgent", "critical"],
      default: "normal",
    },
    successMessage: {
      type: String,
      default: "All required fields have been completed! Thank you.",
    },
    autoCloseNotification: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const FieldEnforcement: Model<IFieldEnforcement> =
  mongoose.models.FieldEnforcement ||
  mongoose.model<IFieldEnforcement>(
    "FieldEnforcement",
    FieldEnforcementSchema
  );

export default FieldEnforcement;
