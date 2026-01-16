import mongoose, { Schema, Model, Document } from "mongoose";

export interface INotification extends Document {
    senderId: string; // The person sending the message (Dean/Developer)
    targetType: "all" | "hostel" | "individual";
    targetHostel?: string;
    targetStudentId?: mongoose.Types.ObjectId;
    message: string;
    image?: string; // Base64 or URL
    priority: "normal" | "urgent" | "critical";
    expiresAt?: Date; // For automatic deletion
    acknowledgedBy: {
        studentId: mongoose.Types.ObjectId;
        at: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        senderId: {
            type: String,
            required: true,
        },
        targetType: {
            type: String,
            enum: ["all", "hostel", "individual"],
            required: true,
        },
        targetHostel: {
            type: String,
        },
        targetStudentId: {
            type: Schema.Types.ObjectId,
            ref: "Student",
        },
        message: {
            type: String,
            required: true,
        },
        image: {
            type: String,
        },
        priority: {
            type: String,
            enum: ["normal", "urgent", "critical"],
            default: "normal",
        },
        expiresAt: {
            type: Date,
            index: { expires: 0 }, // TTL index: documents will be deleted at the specified Date
        },
        acknowledgedBy: [
            {
                studentId: { type: Schema.Types.ObjectId, ref: "Student" },
                at: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
    }
);

const Notification: Model<INotification> =
    mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
