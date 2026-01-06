import mongoose from "mongoose";

if (!process.env.MONGO_URL) {
  throw new Error("Please add MONGO_URL to your .env.local file");
}

const MONGO_URL = process.env.MONGO_URL.replace("<db_password>", process.env.MONGO_PASSWORD || "");

if (MONGO_URL.includes("<db_password>")) {
  throw new Error("Please replace <db_password> in MONGO_URL with your actual MongoDB password, or set MONGO_PASSWORD in .env.local");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGO_URL, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    if (e.message?.includes("authentication failed") || e.message?.includes("bad auth")) {
      throw new Error("MongoDB authentication failed. Please check your MONGO_URL credentials in .env.local");
    }
    throw e;
  }

  return cached.conn;
}

export default connectDB;

