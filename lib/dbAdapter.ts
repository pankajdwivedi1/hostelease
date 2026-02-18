
import { supabase } from '@/lib/supabase';
import connectDB from '@/lib/mongodb';
import { headers } from 'next/headers'; // To check for secret header

// Note: We might need to ensure mongoose models are imported correctly

/**
 * DATABASE "BRIDGE" ADAPTER
 * -------------------------
 * This file serves as the single source of truth for all database operations.
 * It checks the 'NEXT_PUBLIC_DB_SOURCE' environment variable OR a secret header
 * to decide whether to route the request to MongoDB or Supabase.
 */

// Reads from .env.local: 'MONGODB' or 'SUPABASE'
const GLOBAL_DB_SOURCE = process.env.NEXT_PUBLIC_DB_SOURCE || 'MONGODB';

// Cache for DB Source Setting
let cachedDbSource: string | null = null;
let lastDbSourceCheck = 0;
const SOURCE_CACHE_TTL = 30000; // 30 seconds

// Helper to determine Source PER REQUEST
// This allows you to test Supabase without switching for everyone
const getDbSource = async () => {
    try {
        const headersList = await headers();
        const forceSupabase = headersList.get('x-force-db') === 'supabase';
        if (forceSupabase) return 'SUPABASE';
    } catch (e) {
        // headers() only works in server components/actions
    }

    // Check Cache first
    if (cachedDbSource && (Date.now() - lastDbSourceCheck < SOURCE_CACHE_TTL)) {
        return cachedDbSource;
    }

    // Check AdminSettings in MongoDB
    try {
        await connectDB();
        // Dynamic import to avoid circular dependency issues at top level if any schema refs dbAdapter (unlikely but safe)
        const AdminSettings = (await import('@/models/AdminSettings')).default;
        const settings = await AdminSettings.findOne().select('activeDatabaseSource').lean();

        if (settings?.activeDatabaseSource) {
            cachedDbSource = settings.activeDatabaseSource;
            lastDbSourceCheck = Date.now();
            return settings.activeDatabaseSource;
        }
    } catch (error) {
        console.warn("⚠️ Failed to fetch DB Source from AdminSettings, falling back to ENV:", error);
    }

    return GLOBAL_DB_SOURCE;
};

export const db = {
    // Returns which database is currently active
    getSource: getDbSource,

    /**
     * STUDENT OPERATIONS
     */
    students: {
        // Get a single student by ID
        getById: async (id: string, useSupabaseOverride = false) => {
            const source = useSupabaseOverride ? 'SUPABASE' : await getDbSource();

            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('_id', id)
                    .single();

                if (error) {
                    console.error("Supabase Error:", error);
                    return null;
                }
                return data;

            } else {
                // MongoDB Query
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                try {
                    const student = await StudentModel.findById(id).lean();
                    return student ? JSON.parse(JSON.stringify(student)) : null;
                } catch (e) {
                    console.error("MongoDB Error:", e);
                    return null;
                }
            }
        },

        // Example: Create a new student
        create: async (studentData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('students')
                    .insert([studentData])
                    .select();

                if (error) throw error;
                return data?.[0];

            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const newStudent = await StudentModel.create(studentData);
                return JSON.parse(JSON.stringify(newStudent));
            }
        },

        // 🔥 Used for the Secret Test Page
        getAll: async (limit = 50, useSupabase = false) => {
            if (useSupabase) {
                const { data, error } = await supabase.from('students').select('*').limit(limit);
                if (error) throw error;
                return data;
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const students = await StudentModel.find({}).limit(limit).lean();
                return JSON.parse(JSON.stringify(students));
            }
        }
    },

    /**
     * ATTENDANCE OPERATIONS
     */
    attendance: {
        mark: async (attendanceData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                // Map camelCase (API) to snake_case (Supabase)
                const supabaseData = {
                    student_id: attendanceData.studentId,
                    firebase_uid: attendanceData.firebaseUID,
                    name: attendanceData.name,
                    hostel_name: attendanceData.hostelName,
                    room_number: attendanceData.roomNumber,
                    date: attendanceData.date,
                    ist_time: attendanceData.istTime,
                    ist_date: attendanceData.istDate,
                    location: attendanceData.location,
                    device_id: attendanceData.deviceId,
                    status: attendanceData.status,
                    face_match_percentage: attendanceData.faceMatchPercentage,
                    face_match_status: attendanceData.faceMatchStatus,
                    flagged_photo_url: attendanceData.flaggedPhotoUrl,
                    needs_review: attendanceData.needsReview,
                    is_test: attendanceData.isTest,
                    timestamp: attendanceData.timestamp ? new Date(attendanceData.timestamp).toISOString() : new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from('attendance')
                    .insert([supabaseData])
                    .select();
                if (error) throw error;
                return data?.[0];
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const record = await AttendanceModel.create(attendanceData);
                return JSON.parse(JSON.stringify(record));
            }
        }
    }
};
