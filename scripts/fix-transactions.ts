
import { createClient } from '@supabase/supabase-js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Load ENV
const env: Record<string, string> = {};
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)?\s*$/);
        if (match) env[match[1]] = (match[2] || '').replace(/^['"]|['"]$/g, '');
    });
} catch (e) { };

const MONGO_URL = env.MONGODB_URL || process.env.MONGODB_URL;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!MONGO_URL || !SUPABASE_URL || !SUPABASE_KEY) process.exit(1);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function fixTransactions() {
    console.log("🛠️ Fixing Transactions Migration...");
    await mongoose.connect(MONGO_URL as string);

    // Dynamic access
    const collection = mongoose.connection.db.collection('transactions');
    const docs = await collection.find({}).toArray();
    console.log(`Found ${docs.length} transactions.`);

    if (docs.length === 0) process.exit(0);

    const mapped = docs.map(doc => ({
        _id: doc._id?.toString(),
        student_id: doc.studentId?.toString(),
        registration_id: doc.registrationId,
        utr_number: doc.utrNumber,
        amount: doc.amount,
        payment_source: doc.paymentSource,
        screenshot: doc.screenshot,
        status: doc.status,
        admin_remarks: doc.adminRemarks,
        verified_at: doc.verifiedAt,
        reconciled_via_csv: doc.reconciledViaCSV,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }));

    // Insert with upsert on _id (PK)
    const { error } = await supabase.from('transactions').upsert(mapped, { onConflict: '_id' });

    if (error) console.error("❌ Error:", error.message);
    else console.log("✅ Transactions migrated successfully.");

    process.exit(0);
}

fixTransactions();
