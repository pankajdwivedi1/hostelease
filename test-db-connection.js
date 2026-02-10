// Test if MongoDB connection works
const mongoose = require('mongoose');

async function testConnection() {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;

        if (!MONGODB_URI) {
            console.error("❌ MONGODB_URI is not set in environment variables");
            return;
        }

        console.log("🔄 Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("✅ MongoDB connected successfully!");

        // Try to query students
        const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
        const count = await Student.countDocuments();
        console.log(`✅ Found ${count} students in database`);

        // Try a simple find query
        const students = await Student.find({}).limit(1);
        console.log("✅ Sample student:", students[0] ? students[0].name : "No students found");

        await mongoose.disconnect();
        console.log("✅ Test completed successfully!");

    } catch (error) {
        console.error("❌ Test failed:");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
    }
}

testConnection();
