// 🛡️ MongoDB has been retired in favor of Railway PostgreSQL via Prisma ORM.
// This module provides safe no-op functions to prevent runtime errors.

export async function connectDB() {
    return null;
}

export async function disconnectDB() {
    return null;
}

export default connectDB;
