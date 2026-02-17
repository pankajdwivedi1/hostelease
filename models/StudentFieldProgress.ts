import mongoose, { Schema, Model, Document } from "mongoose";

export interface IStudentFieldProgress extends Document {
  studentId: mongoose.Types.ObjectId;
  firebaseUID: string;
  hostelName: string;
  fieldId: string; // Field identifier (e.g., "fatherName", "motherName")
  fieldLabel: string; // Human-readable field name
  isCompleted: boolean;
  completedAt?: Date;
  notificationId?: mongoose.Types.ObjectId; // Reference to the field enforcement notification
  createdAt: Date;
  updatedAt: Date;
}

const StudentFieldProgressSchema = new Schema<IStudentFieldProgress>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    firebaseUID: {
      type: String,
      required: true,
      index: true,
    },
    hostelName: {
      type: String,
      required: true,
      index: true,
    },
    fieldId: {
      type: String,
      required: true,
      index: true,
    },
    fieldLabel: {
      type: String,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
StudentFieldProgressSchema.index(
  { studentId: 1, fieldId: 1, hostelName: 1 },
  { unique: true }
);

const StudentFieldProgress: Model<IStudentFieldProgress> =
  mongoose.models.StudentFieldProgress ||
  mongoose.model<IStudentFieldProgress>(
    "StudentFieldProgress",
    StudentFieldProgressSchema
  );

export default StudentFieldProgress;
