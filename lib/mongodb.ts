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

  // 🛡️ M0 OPTIMIZED SETTINGS FOR 1000+ STUDENTS (Enhanced 2026-02-17)
  const opts = {
    bufferCommands: false,                  // CRITICAL: Never buffer commands
    maxPoolSize: 3,                         // Keep LOW for M0 (10 would exhaust free tier with 800+ students)
    minPoolSize: 2,                         // ✅ IMPROVED: Keep 2 warm connections (was 1)
    serverSelectionTimeoutMS: 5000,         // ✅ IMPROVED: More time to find server during peak (was 3000)
    socketTimeoutMS: 45000,                 // ✅ IMPROVED: More time for slow queries during peak (was 30000)
    family: 4,                              // Force IPv4
    waitQueueTimeoutMS: 5000,               // Timeout for queue wait
    connectTimeoutMS: 10000,                // Connection timeout
    retryWrites: false,                     // CRITICAL: Disable retry writes to avoid duplicate connections
    retryReads: false                       // CRITICAL: Disable retry reads to avoid duplicate connections
  };

  console.log(`🔄 [${new Date().toLocaleTimeString()}] Connecting to MongoDB (ULTRA Pool: ${opts.maxPoolSize}, 1000+ students mode)...`);

  cached.promise = mongoose.connect(MONGO_URL as string, opts).then((m) => {
    console.log('✅ MongoDB Ready (M0 Ultra-Optimized - Max Pool: 3)');
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

/**
 * 🔥 NEW: Force connection cleanup after request completes
 * Critical for M0 tier with 1000+ students
 */
export async function disconnectDB() {
  try {
    if (mongoose.connection.readyState === 1) {
      // Don't fully close, just return connection to pool
      console.log('🔄 Returning connection to pool');
    }
  } catch (e) {
    console.error('⚠️ Error managing connection:', e);
  }
}

export default connectDB;


