
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Load ENV manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)?\s*$/);
    if (match) env[match[1]] = (match[2] || '').replace(/^['"]|['"]$/g, '');
});

const MONGO_URL = env.MONGODB_URL;
if (!MONGO_URL) { console.error("Missing MONGODB_URL"); process.exit(1); }

async function checkCounts() {
    await mongoose.connect(MONGO_URL as string);
    console.log("✅ Connected to MongoDB");

    const models = [
        'AdminSettings',
        'Attendance',
        'FieldEnforcement',
        'GatePass',
        'GatePassToken',
        'Hostel',
        'Notification',
        'Permission',
        'Student',
        'StudentFieldProgress',
        'Transaction'
    ];

    console.log("📊 Checking Record Counts in MongoDB:");
    console.log("-------------------------------------");

    for (const modelName of models) {
        try {
            // Dynamic import/usage of model requires schema, but we can just use connection.db.collection
            const collectionName = mongoose.pluralize()(modelName) || modelName.toLowerCase() + 's';
            // Mongoose pluralizes, e.g. AdminSettings -> adminsettings? checking actual collection names might be safer
            // But let's try direct collection access via driver
        } catch (e) { }
    }

    // Direct collection list
    const collections = await mongoose.connection.db.listCollections().toArray();

    for (const col of collections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        if (count > 0) {
            console.log(`🔹 ${col.name}: ${count} records`);
        }
    }

    console.log("-------------------------------------");
    process.exit(0);
}

checkCounts().catch(console.error);
