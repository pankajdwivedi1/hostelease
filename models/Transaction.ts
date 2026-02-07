import mongoose, { Schema, Model, Document } from "mongoose";

export interface ITransaction extends Document {
    studentId: mongoose.Types.ObjectId;
    registrationId: string;
    utrNumber: string; // The 12-digit UTR from UPI/Netbanking
    amount: number;
    paymentSource: string; // GPay, PhonePe, Bank Transfer, etc.
    screenshot?: string; // Base64 or URL
    status: "pending" | "verified" | "rejected" | "flagged";
    adminRemarks?: string;
    verifiedAt?: Date;
    reconciledViaCSV?: boolean; // True if automatically matched via bank CSV
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
    {
        studentId: {
            type: Schema.Types.ObjectId,
            ref: "Student",
            required: true,
            index: true,
        },
        registrationId: {
            type: String,
            required: true,
            index: true,
        },
        utrNumber: {
            type: String,
            required: true,
            unique: true, // Prevent duplicate UTR submissions
            trim: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        paymentSource: {
            type: String,
            required: true,
        },
        screenshot: {
            type: String, // Store as Base64 for now as per project pattern
        },
        status: {
            type: String,
            enum: ["pending", "verified", "rejected", "flagged"],
            default: "pending",
            index: true,
        },
        adminRemarks: {
            type: String,
        },
        verifiedAt: {
            type: Date,
        },
        reconciledViaCSV: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const Transaction: Model<ITransaction> =
    mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
