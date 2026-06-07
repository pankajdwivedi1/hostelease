import mongoose, { Schema, Model, Document } from "mongoose";

export interface IAttendance extends Document {
    studentId: mongoose.Types.ObjectId;
    firebaseUID: string;
    name: string;
    hostelName: string;
    roomNumber: string;
    date: string; // Format: YYYY-MM-DD
    timestamp: Date;
    istTime: string; // Format: HH:mm:ss
    istDate: string; // Format: DD-MM-YYYY
    location: {
        lat: number;
        lng: number;
        accuracy?: number;
    };
    deviceId: string;
    status: "present";
    // Face matching fields (optional)
    faceMatchPercentage?: number; // 0-100
    faceMatchStatus?: "auto-approved" | "flagged" | "manual-override" | "biometric-verified";
    flaggedPhotoUrl?: string; // Only for flagged cases (match < 70%)
    needsReview?: boolean;
    isTest?: boolean;
    markedBy?: string; // Track who manually marked this
    createdAt: Date;
    updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
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
        name: {
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
        date: {
            type: String,
            required: true,
            index: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        istTime: {
            type: String,
        },
        istDate: {
            type: String,
        },
        location: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
            accuracy: { type: Number, required: false },
        },
        deviceId: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["present"],
            default: "present",
        },
        // Face matching fields
        faceMatchPercentage: {
            type: Number,
            min: 0,
            max: 100,
            required: false,
        },
        faceMatchStatus: {
            type: String,
            enum: ["auto-approved", "flagged", "manual-override", "biometric-verified"],
            required: false,
        },
        flaggedPhotoUrl: {
            type: String,
            required: false,
        },
        needsReview: {
            type: Boolean,
            default: false,
        },
        isTest: {
            type: Boolean,
            default: false,
            index: true,
        },
        markedBy: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

// 🔥 CRITICAL INDEXES FOR M0 OPTIMIZATION (1000+ students)
// Composite index to ensure a student can only mark attendance once per day
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Additional indexes for common queries
AttendanceSchema.index({ date: 1, hostelName: 1 }); // For daily hostel reports
AttendanceSchema.index({ firebaseUID: 1, date: 1 }); // For student daily check
AttendanceSchema.index({ date: 1, needsReview: 1 }); // For flagged attendance queries
AttendanceSchema.index({ timestamp: -1 }); // For sorting by recency

const Attendance: Model<IAttendance> =
    mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;
