require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function checkStudents() {
    try {
        const url = process.env.MONGODB_URL;
        if (!url) {
            console.error('❌ ERROR: MONGODB_URL not found in .env.local');
            process.exit(1);
        }
        await mongoose.connect(url);
        const Student = mongoose.model('Student', new mongoose.Schema({
            name: String,
            hostelName: String,
            attendanceMode: String
        }));
        const Hostel = mongoose.model('Hostel', new mongoose.Schema({
            name: String,
            attendanceMode: String
        }));

        const overridingStudents = await Student.find({ attendanceMode: { $exists: true, $ne: 'default' } }, 'name hostelName attendanceMode');
        const hostels = await Hostel.find({}, 'name attendanceMode');

        console.log(JSON.stringify({ hostels, overridingStudents }, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkStudents();
