import mongoose from "mongoose";

const MONGO_URL = process.env.MONGODB_URL;

if (!MONGO_URL) {
  throw new Error("Please add MONGODB_URL to your .env.local file");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null, lastConnectAttempt: 0 };
}

// ⚡ CRITICAL: Aggressive cleanup for M0 tier to prevent connection exhaustion
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed due to app termination');
    } catch (e) {
      // Ignore
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    try {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed due to app termination');
    } catch (e) {
      // Ignore
    }
    process.exit(0);
  });
}

// ⚡ OPTIMIZED: Modern connection pooling for Next.js to prevent "buffering timed out" errors
async function connectDB() {
  // Check if we already have a connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If a connection is already in progress, wait for it
  if (cached.promise) {
    try {
      await cached.promise;
      if (mongoose.connection.readyState === 1) {
        cached.conn = mongoose;
        return cached.conn;
      }
    } catch (e) {
      cached.promise = null; // Reset if it failed
    }
  }

  // If we get here, we need to create a new connection
  const isProduction = process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV === 'production';

  const opts = {
    bufferCommands: false, // ⚡ CRITICAL: Disable buffering to find errors fast
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    family: 4,

    // ⚡ CONCURRENCY: Higher pool for dev to handle polling
    maxPoolSize: isProduction ? 10 : 10,
    minPoolSize: 2,
    maxIdleTimeMS: 10000,

    retryWrites: true,
    retryReads: true,
  };

  console.log(`🔄 New MongoDB connection (pool: ${opts.maxPoolSize})...`);
  cached.promise = mongoose.connect(MONGO_URL as string, opts).then((m) => {
    console.log('✅ MongoDB Ready');
    return m;
  });

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;


