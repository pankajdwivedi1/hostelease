import mongoose from "mongoose";

const MONGO_URL = process.env.MONGODB_URL;

if (!MONGO_URL) {
  throw new Error("Please add MONGODB_URL to your .env.local file");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB(retryCount = 0) {
  const maxRetries = 3;

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 3 || mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // ⚡ CRITICAL: Forces IPv4 to fix querySrv ETIMEOUT / DNS issues
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(MONGO_URL as string, opts)
      .then((mongoose) => {
        console.log('✅ MongoDB connected successfully');
        return mongoose;
      })
      .catch(async (error) => {
        cached.promise = null;
        if (retryCount < maxRetries) {
          console.warn(`⚠️ MongoDB connection failed. Retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 2000));
          return connectDB(retryCount + 1);
        }
        console.error('❌ MongoDB Connection Error:', error.message);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;

