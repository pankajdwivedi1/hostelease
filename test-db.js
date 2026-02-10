const mongoose = require('mongoose');

async function test() {
    const MONGO_URL = "mongodb+srv://pankaj:pankajdwivedi81@cluster0.pqvmg4l.mongodb.net/?retryWrites=true&w=majority";
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
        console.log('Disconnected');
    } catch (error) {
        console.error('Connection failed:', error.message);
    }
}

test();
