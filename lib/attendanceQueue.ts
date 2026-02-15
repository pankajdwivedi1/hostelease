import Attendance from "@/models/Attendance";
import connectDB from "./mongodb";

/**
 * 🚀 PRODUCTION READY BULK QUEUE SYSTEM
 * Optimized for MongoDB Atlas M0 (Free Tier)
 * Batches multiple attendance records into a single write operation.
 */

interface AttendanceRecord {
    studentId: any;
    firebaseUID: string;
    name: string;
    hostelName: string;
    roomNumber: string;
    date: string;
    istTime: string;
    istDate: string;
    location: {
        lat: number;
        lng: number;
        accuracy: number;
    };
    deviceId: string;
    status: string;
    faceMatchPercentage?: number;
    faceMatchStatus?: string;
    flaggedPhotoUrl?: string;
    needsReview?: boolean;
    isTest?: boolean;
}

// Singleton state to persist in Node.js memory (Works well on VPS/Persistent Servers)
let queue: AttendanceRecord[] = [];
let isProcessing = false;
let lastFlush = Date.now();
const FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_BATCH_SIZE = 50;   // Force flush if we hit 50 records

/**
 * Adds a record to the queue
 */
export async function queueAttendance(record: AttendanceRecord) {
    queue.push(record);

    // Proactive flush if queue gets large
    if (queue.length >= MAX_BATCH_SIZE) {
        flushQueue();
    }
}

/**
 * Checks if a student is already in the queue for a specific date
 */
export function checkQueue(studentId: string, date: string): boolean {
    return queue.some(r => r.studentId.toString() === studentId.toString() && r.date === date);
}

/**
 * Returns current queue size for monitoring
 */
export function getQueueStatus() {
    return {
        size: queue.length,
        lastFlush: new Date(lastFlush).toLocaleTimeString(),
        isProcessing
    };
}

/**
 * Flushes the queue to MongoDB
 */
async function flushQueue() {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    const batch = [...queue];
    queue = []; // Clear queue immediately to avoid duplicates during processing

    try {
        await connectDB();
        // insertMany is much more efficient than multiple .create() calls
        await Attendance.insertMany(batch, { ordered: false });
        console.log(`✅ [Bulk Insert] Successfully marked ${batch.length} attendance records.`);
        lastFlush = Date.now();
    } catch (err: any) {
        console.error("❌ [Bulk Insert Error]:", err.message);
        // In case of error, we might want to log specifically which ones failed
        // But with ordered: false, successful ones are still inserted
    } finally {
        isProcessing = false;
    }
}

// Background interval for flushing (Only starts if in a proper Node environment)
if (typeof setInterval !== 'undefined') {
    setInterval(flushQueue, FLUSH_INTERVAL);
}

// Ensure queue is flushed before process exit
if (typeof process !== 'undefined') {
    process.on('SIGINT', async () => {
        await flushQueue();
        process.exit(0);
    });
}
