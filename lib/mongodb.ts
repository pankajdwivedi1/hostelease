import mongoose from "mongoose";

if (!process.env.MONGODB_URL) {
  throw new Error("Please add MONGODB_URL to your .env.local file");
}

const MONGO_URL = process.env.MONGODB_URL;

if (MONGO_URL.includes("<db_password>")) {
  throw new Error("Please replace <db_password> in MONGODB_URL with your actual MongoDB password, or set MONGO_PASSWORD in .env.local");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // If already connected and connection is healthy, return it
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection is in a bad state, reset everything
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000, // 10 seconds to select a server
      socketTimeoutMS: 45000, // 45 seconds for socket operations
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 2, // Minimum number of connections in the pool
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      connectTimeoutMS: 10000, // 10 seconds to establish initial connection
    };

    cached.promise = mongoose.connect(MONGO_URL, opts)
      .then((mongoose) => {
        console.log('✅ MongoDB connected successfully');
        return mongoose;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        cached.promise = null; // Reset on error
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    cached.conn = null;

    if (e.message?.includes("authentication failed") || e.message?.includes("bad auth")) {
      throw new Error("MongoDB authentication failed. Please check your MONGO_URL credentials in .env.local");
    }
    if (e.message?.includes("ENOTFOUND") || e.message?.includes("ETIMEDOUT")) {
      throw new Error("MongoDB connection timeout. Please check your network connection and MongoDB Atlas IP whitelist.");
    }
    throw e;
  }

  return cached.conn;
}

export default connectDB;

