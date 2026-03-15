import mongoose, { Schema, Model, Document } from "mongoose";

export interface ITenant extends Document {
    name: string;
    slug: string; // e.g., 'oist', 'oxford'
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    domain?: string; // Optional custom domain
    adminEmail: string;
    isActive: boolean;
    subscriptionStatus: "active" | "expired" | "trial" | "disabled";
    subscriptionEndDate?: Date;
    address?: string;
    contactNumber?: string;
    createdAt: Date;
    updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
    {
        name: {
            type: String,
            required: true,
            index: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
            trim: true,
        },
        logo: {
            type: String,
            required: false,
        },
        primaryColor: {
            type: String,
            default: "#3b82f6", // Default blue
        },
        secondaryColor: {
            type: String,
            default: "#1e40af",
        },
        domain: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
        },
        adminEmail: {
            type: String,
            required: true,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        subscriptionStatus: {
            type: String,
            enum: ["active", "expired", "trial", "disabled"],
            default: "trial",
        },
        subscriptionEndDate: {
            type: Date,
            required: false,
        },
        address: String,
        contactNumber: String,
    },
    {
        timestamps: true,
    }
);

// Prevent model overwrite warning in development
if (process.env.NODE_ENV === "development") {
    delete mongoose.models.Tenant;
}

const Tenant: Model<ITenant> =
    mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;
