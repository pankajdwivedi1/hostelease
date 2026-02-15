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

  // 🛡️ M0 PRODUCTION OPTIMIZED SETTINGS
  const opts = {
    bufferCommands: false,
    maxPoolSize: isProduction ? 5 : 2,      // Low pool size for M0 (Limit is 500)
    minPoolSize: 1,                        // Maintain at least 1 connection
    serverSelectionTimeoutMS: 5000,        // Fail fast if DB is down
    socketTimeoutMS: 45000,                // Close idle sockets
    family: 4                              // Force IPv4 if needed
  };

  console.log(`🔄 [${new Date().toLocaleTimeString()}] Connecting to MongoDB (Pool: ${opts.maxPoolSize})...`);

  cached.promise = mongoose.connect(MONGO_URL as string, opts).then((m) => {
    console.log('✅ MongoDB Ready (Optimized Pool)');
    return m;
  });

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('❌ MongoDB Connection Error:', e);
    throw e;
  }

  return cached.conn;
}

export default connectDB;


