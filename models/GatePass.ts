import mongoose, { Schema, Model, Document } from "mongoose";

export interface IGatePass extends Document {
    studentId: mongoose.Types.ObjectId;
    firebaseUID: string;
    studentName: string;
    hostelName: string;
    roomNumber: string;
    registrationId?: string;
    // Check-out details
    checkOutTime: Date;
    checkOutISTTime: string; // Format: HH:mm:ss
    checkOutISTDate: string; // Format: DD-MM-YYYY
    // Check-in details (null if student is still out)
    checkInTime?: Date;
    checkInISTTime?: string;
    checkInISTDate?: string;
    // Outing info
    status: "out" | "in"; // "out" = currently outside, "in" = returned
    durationMinutes?: number; // Auto-calculated on check-in
    // Gate info
    gateName?: string; // Which gate they used
    // Metadata
    qrTokenUsedOut: string; // The QR token scanned at checkout
    qrTokenUsedIn?: string; // The QR token scanned at checkin
    createdAt: Date;
    updatedAt: Date;
}

const GatePassSchema = new Schema<IGatePass>(
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
        studentName: {
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
        registrationId: {
            type: String,
            required: false,
        },
        // Check-out
        checkOutTime: {
            type: Date,
            required: true,
            default: Date.now,
        },
        checkOutISTTime: {
            type: String,
            required: true,
        },
        checkOutISTDate: {
            type: String,
            required: true,
        },
        // Check-in
        checkInTime: {
            type: Date,
            required: false,
        },
        checkInISTTime: {
            type: String,
            required: false,
        },
        checkInISTDate: {
            type: String,
            required: false,
        },
        // Status
        status: {
            type: String,
            enum: ["out", "in"],
            default: "out",
            index: true,
        },
        durationMinutes: {
            type: Number,
            required: false,
        },
        gateName: {
            type: String,
            default: "Main Gate",
        },
        qrTokenUsedOut: {
            type: String,
            required: true,
        },
        qrTokenUsedIn: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for common queries
GatePassSchema.index({ status: 1, hostelName: 1 }); // Live: who's outside per hostel
GatePassSchema.index({ studentId: 1, status: 1 }); // Check if student is already out
GatePassSchema.index({ checkOutTime: -1 }); // Recent outings
GatePassSchema.index({ firebaseUID: 1, checkOutTime: -1 }); // Student's outing history
GatePassSchema.index({ checkOutISTDate: 1 }); // Daily reports

// Prevent model overwrite warning in development
if (process.env.NODE_ENV === "development") {
    delete mongoose.models.GatePass;
}

const GatePass: Model<IGatePass> =
    mongoose.models.GatePass || mongoose.model<IGatePass>("GatePass", GatePassSchema);

export default GatePass;
