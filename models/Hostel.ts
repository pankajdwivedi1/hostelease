import mongoose, { Schema, Model, Document } from "mongoose";

export interface IHostel extends Document {
    name: string;
    totalRooms?: number;
    wardenUsername?: string;
    wardenPassword?: string;
    attendanceMode: 'strict' | 'gps-only' | 'biometric'; // New Setting
    allowWardenAddStudent?: boolean;
    allowWardenEditProfile?: boolean;
    allowWardenRemoveStudent?: boolean;
    allowWardenNotification?: boolean;
    allowStudentNotification?: boolean;
    registrationFormat?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const HostelSchema: Schema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        totalRooms: {
            type: Number,
            default: 100,
        },
        wardenUsername: {
            type: String,
            required: false,
            trim: true,
        },
        wardenPassword: {
            type: String,
            required: false,
        },
        attendanceMode: {
            type: String,
            enum: ['strict', 'gps-only', 'biometric'],
            default: 'strict'
        },
        allowWardenAddStudent: {
            type: Boolean,
            default: false
        },
        allowWardenEditProfile: {
            type: Boolean,
            default: false
        },
        allowWardenRemoveStudent: {
            type: Boolean,
            default: false
        },
        allowWardenNotification: {
            type: Boolean,
            default: true
        },
        allowStudentNotification: {
            type: Boolean,
            default: true
        },
        registrationFormat: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

// Prevent model overwrite warning in development
const Hostel: Model<IHostel> =
    mongoose.models.Hostel || mongoose.model<IHostel>("Hostel", HostelSchema);

export default Hostel;
