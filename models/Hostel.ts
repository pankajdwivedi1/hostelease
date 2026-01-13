import mongoose, { Schema, Model } from "mongoose";

export interface IHostel {
    _id?: string;
    name: string;
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
    },
    { timestamps: true }
);

// Prevent model overwrite warning in development
if (process.env.NODE_ENV === "development") {
    delete mongoose.models.Hostel;
}

const Hostel: Model<IHostel> =
    mongoose.models.Hostel || mongoose.model<IHostel>("Hostel", HostelSchema);

export default Hostel;
