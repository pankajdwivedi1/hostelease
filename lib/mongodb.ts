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

async function connectDB(retryCount = 0) {
  const maxRetries = 3;
  const now = Date.now();

  // Check if we have a valid connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Prevent multiple simultaneous connection attempts
  if (cached.promise && (now - cached.lastConnectAttempt) < 20000) {
    try {
      return await cached.promise;
    } catch (e) {
      // If the cached promise failed, continue to create a new one
      cached.promise = null;
    }
  }

  // If connection is in a bad state, clean it up
  if (mongoose.connection.readyState === 3 || mongoose.connection.readyState === 2) {
    try {
      await mongoose.connection.close();
    } catch (e) {
      // Ignore close errors
    }
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    cached.lastConnectAttempt = now;

    // ⚡ CRITICAL: Environment-aware pool size for M0 tier (500 connection limit)
    // Development: maxPoolSize=1 to prevent connection leaks during hot-reload
    // Production: maxPoolSize=5 to handle concurrent students (714 students, 9:30-10:30 PM)
    const isProduction = process.env.NODE_ENV === 'production' ||
      process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV === 'production';


    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 30000, // Keep increased timeout
      connectTimeoutMS: 30000,         // Keep increased timeout
      socketTimeoutMS: 45000,
      family: 4, // ⚡ CRITICAL: Forces IPv4 to fix querySrv ETIMEOUT

      // ⚡ ADAPTIVE: Different pool sizes for dev vs production
      maxPoolSize: isProduction ? 5 : 1, // Prod: 5 for concurrency, Dev: 1 to prevent leaks
      minPoolSize: 0, // No minimum to allow full cleanup
      maxIdleTimeMS: isProduction ? 15000 : 10000, // Prod: 15s balance, Dev: 10s aggressive cleanup

      retryWrites: true,
      retryReads: true,
    };

    console.log(`🔄 Attempting MongoDB connection (isProduction: ${isProduction}, maxPoolSize: ${opts.maxPoolSize})...`);

    cached.promise = mongoose.connect(MONGO_URL as string, opts)
      .then((mongooseInstance) => {
        const poolSize = mongoose.connection.getClient().options?.maxPoolSize || 'unknown';
        console.log(`✅ MongoDB connected successfully (pool: ${poolSize})`);

        // Track active connections
        mongoose.connection.getClient().on('connectionCreated', () => {
          console.log('➕ New MongoDB connection created');
        });

        mongoose.connection.getClient().on('connectionClosed', () => {
          console.log('➖ MongoDB connection closed');
        });

        // Set up error handlers
        mongoose.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err);
          cached.conn = null;
        });

        mongoose.connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected');
          cached.conn = null;
        });

        return mongooseInstance;
      })
      .catch(async (error) => {
        cached.promise = null;
        cached.lastConnectAttempt = 0;

        // ⚡ LOG ERROR IMMEDIATELY to see what's wrong
        console.error(`❌ Connection attempt ${retryCount + 1} failed:`, error.message);
        if (error.stack) console.error('Stack:', error.stack.split('\n').slice(0, 3).join('\n'));

        // Check if this is a DNS timeout error
        const isDNSError = error.message?.includes('querySrv ETIMEOUT') ||
          error.message?.includes('ETIMEOUT') ||
          error.message?.includes('querySrv');

        if (retryCount < maxRetries && isDNSError) {
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, retryCount + 1) * 1000;
          console.warn(`⚠️ MongoDB DNS timeout. Retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          return connectDB(retryCount + 1);
        } else if (retryCount < maxRetries) {
          console.warn(`⚠️ MongoDB connection failed. Retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 3000));
          return connectDB(retryCount + 1);
        }

        console.error('❌ MongoDB Connection Error (All retries exhausted):', error.message);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    cached.conn = null;
    cached.lastConnectAttempt = 0;
    throw e;
  }

  return cached.conn;
}

export default connectDB;


