import mongoose, { Schema, Model, Document } from "mongoose";

export interface IAttendance extends Document {
    studentId: mongoose.Types.ObjectId;
    firebaseUID: string;
    name: string;
    hostelName: string;
    roomNumber: string;
    date: string; // Format: YYYY-MM-DD
    timestamp: Date;
    location: {
        lat: number;
        lng: number;
    };
    deviceId: string;
    status: "present";
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
        location: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
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
    },
    {
        timestamps: true,
    }
);

// Composite index to ensure a student can only mark attendance once per day
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

const Attendance: Model<IAttendance> =
    mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;
