const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Read .env.local file
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
let MONGODB_URL = '';

for (const line of envLines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('MONGODB_URL=')) {
        MONGODB_URL = trimmedLine.substring('MONGODB_URL='.length).trim();
        // Remove quotes if present
        if (MONGODB_URL.startsWith('"') && MONGODB_URL.endsWith('"')) {
            MONGODB_URL = MONGODB_URL.slice(1, -1);
        }
        if (MONGODB_URL.startsWith("'") && MONGODB_URL.endsWith("'")) {
            MONGODB_URL = MONGODB_URL.slice(1, -1);
        }
        break;
    }
}

if (!MONGODB_URL) {
    console.error('❌ MONGODB_URL not found in .env.local');
    process.exit(1);
}

const attendanceSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    name: String,
    hostelName: String,
    roomNumber: String,
    date: String,
    istTime: String,
    location: {
        lat: Number,
        lng: Number,
        accuracy: Number
    },
    deviceId: String,
    status: String,
    faceMatchPercentage: Number,
    faceMatchStatus: String,
    needsReview: Boolean
}, { timestamps: true });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

async function checkTodayAttendance() {
    try {
        await mongoose.connect(MONGODB_URL, {
            bufferCommands: false,
            maxPoolSize: 3
        });

        console.log('✅ Connected to MongoDB\n');

        // Get today's date in IST format (YYYY-MM-DD)
        const today = new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).split('/').reverse().join('-');

        console.log(`📅 Checking attendance for date: ${today}\n`);

        // Count total attendance for today
        const count = await Attendance.countDocuments({ date: today });
        console.log(`📊 Total attendance records found: ${count}`);

        if (count > 0) {
            // Get all attendance records for today
            const records = await Attendance.find({ date: today })
                .select('name hostelName roomNumber istTime status')
                .sort({ istTime: 1 })
                .lean();

            console.log('\n📋 Today\'s Attendance Records:\n');
            records.forEach((record, index) => {
                console.log(`${index + 1}. ${record.name} | ${record.hostelName} | Room: ${record.roomNumber} | Time: ${record.istTime}`);
            });

            // Group by hostel
            const byHostel = {};
            records.forEach(r => {
                if (!byHostel[r.hostelName]) {
                    byHostel[r.hostelName] = 0;
                }
                byHostel[r.hostelName]++;
            });

            console.log('\n🏢 Breakdown by Hostel:\n');
            Object.entries(byHostel).forEach(([hostel, count]) => {
                console.log(`   ${hostel}: ${count} students`);
            });
        } else {
            console.log('\n❌ NO ATTENDANCE RECORDS FOUND FOR TODAY');
            console.log('   This confirms that all "queued" attendance was lost.');
            console.log('   Students need to mark attendance again.');
        }

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkTodayAttendance();
