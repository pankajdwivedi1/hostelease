require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function checkConnection() {
    const url = process.env.MONGODB_URL;
    if (!url) {
        console.error('❌ ERROR: MONGODB_URL not found in .env.local');
        process.exit(1);
    }
    console.log("Connecting...");

    try {
        await mongoose.connect(url, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log("✅ SUCCESS: Connected to MongoDB");
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections found:", collections.map(c => c.name));
        process.exit(0);
    } catch (e) {
        console.error("❌ FAILURE: Could not connect to MongoDB");
        console.error(e.message);
        process.exit(1);
    }
}

checkConnection();
