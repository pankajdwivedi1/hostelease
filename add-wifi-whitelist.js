// Quick fix script to add WiFi whitelist to AdminSettings
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function addWifiWhitelist() {
    const uri = process.env.MONGODB_URL;

    if (!uri) {
        console.error('❌ MONGODB_URL not found in environment variables!');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        const adminsettings = db.collection('adminsettings');

        // Add wifiWhitelist to existing document or create if not exists
        const result = await adminsettings.updateOne(
            {}, // Match first document
            {
                $setOnInsert: {
                    wifiWhitelist: [
                        {
                            hostelName: "Gangotri hostel",
                            bssids: [
                                "64:29:43:bb:78:60", // OGH_F0_1 - 2.4GHz
                                "64:29:43:bb:78:68", // OGH_F0_1 - 5GHz
                                "64:29:43:bb:79:40", // OGH_F0_2 - 2.4GHz
                                "64:29:43:bb:79:48", // OGH_F0_2 - 5GHz
                                "64:29:43:bb:79:20", // OGH_F1_2 - 2.4GHz
                                "64:29:43:bb:79:a8", // OGH_F1_2 - 5GHz
                                "64:29:43:bb:78:b0", // OGH_F1_3 - 2.4GHz
                                "64:29:43:bb:78:b8", // OGH_F1_3 - 5GHz
                                "64:29:43:bb:6f:40", // OGH_F2_3 - 2.4GHz
                                "64:29:43:bb:6f:48", // OGH_F2_3 - 5GHz
                                "64:29:43:bb:79:58", // OGH_F2_4 - 5GHz
                                "64:29:43:bb:84:f0", // OGH_F3_3 - 2.4GHz
                                "64:29:43:bb:84:f8", // OGH_F3_3 - 5GHz
                                "64:29:43:bb:85:50", // OGH_F3_4 - 2.4GHz
                                "64:29:43:bb:85:58"  // OGH_F3_4 - 5GHz
                            ],
                            description: "Gangotri Hostel WiFi Routers (All Floors)"
                        }
                    ]
                }
            },
            { upsert: true }
        );

        console.log('✅ WiFi whitelist migration complete!');
        console.log('Result:', result);

        // Also set it if document exists but field is missing
        const updateResult = await adminsettings.updateMany(
            { wifiWhitelist: { $exists: false } },
            {
                $set: {
                    wifiWhitelist: [
                        {
                            hostelName: "Gangotri hostel",
                            bssids: [
                                "64:29:43:bb:78:60",
                                "64:29:43:bb:78:68",
                                "64:29:43:bb:79:40",
                                "64:29:43:bb:79:48",
                                "64:29:43:bb:79:20",
                                "64:29:43:bb:79:a8",
                                "64:29:43:bb:78:b0",
                                "64:29:43:bb:78:b8",
                                "64:29:43:bb:6f:40",
                                "64:29:43:bb:6f:48",
                                "64:29:43:bb:79:58",
                                "64:29:43:bb:84:f0",
                                "64:29:43:bb:84:f8",
                                "64:29:43:bb:85:50",
                                "64:29:43:bb:85:58"
                            ],
                            description: "Gangotri Hostel WiFi Routers (All Floors)"
                        }
                    ]
                }
            }
        );

        console.log('✅ Updated existing documents:', updateResult.modifiedCount);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
        console.log('✅ Connection closed');
    }
}

addWifiWhitelist();
