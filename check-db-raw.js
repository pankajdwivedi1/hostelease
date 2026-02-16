require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkSettings() {
    const url = process.env.MONGODB_URL;
    if (!url) {
        console.error('❌ ERROR: MONGODB_URL not found in .env.local');
        process.exit(1);
    }
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db('test'); // Check if it's 'test' or something else. Common default.
        // Let's list collections first to be sure
        const collections = await db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));

        // Try to find in 'adminsettings'
        const settings = await db.collection('adminsettings').findOne({});
        console.log("Current Admin Settings in DB:", JSON.stringify(settings, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkSettings();
