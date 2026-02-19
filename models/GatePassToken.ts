import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * GatePassToken - Server-side store for rotating QR tokens
 * Each token is valid for 10 seconds, after which a new one is generated.
 * The gate desktop polls this every 10 seconds to get the latest valid token.
 */
export interface IGatePassToken extends Document {
    token: string; // Unique random token
    gateName: string; // Which gate this token belongs to
    createdAt: Date;
    expiresAt: Date;
    isUsed: boolean; // Marked true once a student scans it (prevents replay)
}

const GatePassTokenSchema = new Schema<IGatePassToken>(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        gateName: {
            type: String,
            default: "Main Gate",
            index: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    {
        timestamps: false,
    }
);

// Auto-expire tokens after they're past their expiry (TTL index)
GatePassTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent model overwrite warning in development
if (process.env.NODE_ENV === "development") {
    delete mongoose.models.GatePassToken;
}

const GatePassToken: Model<IGatePassToken> =
    mongoose.models.GatePassToken || mongoose.model<IGatePassToken>("GatePassToken", GatePassTokenSchema);

export default GatePassToken;
