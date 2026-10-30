const mongoose = require('mongoose');

async function test() {
    const MONGO_URL = process.env.MONGODB_URL || process.env.DATABASE_URL;
    if (!MONGO_URL) {
        console.error('Set MONGODB_URL or DATABASE_URL in the environment before running this script.');
        process.exit(1);
    }
    console.log('Connecting...');
    try {
        await mongoose.connect(MONGO_URL, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log('Connected!');

        const dbName = mongoose.connection.db.databaseName;
        console.log('Connected to DB:', dbName);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        await mongoose.disconnect();
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

test();
