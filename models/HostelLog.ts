import mongoose, { Schema, Model, Document } from "mongoose";

export interface IHostelLog extends Document {
    hostelName: string;
    actionType: 'ADD' | 'DELETE' | 'UPDATE';
    studentName: string;
    erpId: string;
    operator: string;
    createdAt: Date;
}

const HostelLogSchema: Schema = new Schema(
    {
        hostelName: {
            type: String,
            required: true,
            trim: true,
        },
        actionType: {
            type: String,
            enum: ['ADD', 'DELETE', 'UPDATE'],
            required: true,
        },
        studentName: {
            type: String,
            required: true,
            trim: true,
        },
        erpId: {
            type: String,
            required: true,
            trim: true,
        },
        operator: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevent model overwrite warning in development
const HostelLog: Model<IHostelLog> =
    mongoose.models.HostelLog || mongoose.model<IHostelLog>("HostelLog", HostelLogSchema);

export default HostelLog;
