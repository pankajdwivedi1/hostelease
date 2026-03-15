const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Basic env loader replacement for dotenv
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
    });
}

const MONGO_URL = process.env.MONGODB_URL;

if (!MONGO_URL) {
    console.error('❌ Error: MONGODB_URL not found in .env.local');
    process.exit(1);
}

// Define schemas locally to avoid import issues in a standalone script
const TenantSchema = new mongoose.Schema({
    name: String,
    slug: String,
    isActive: Boolean,
    subscriptionStatus: String,
    adminEmail: String,
}, { timestamps: true });

const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URL);
        console.log('✅ Connected to MongoDB');

        // 1. Create the OIST Tenant
        const oistSlug = 'oist';
        let oistTenant = await Tenant.findOne({ slug: oistSlug });

        if (!oistTenant) {
            console.log(`📝 Creating new Tenant: Oriental Institute of Science and Technology (${oistSlug})...`);
            oistTenant = await Tenant.create({
                name: 'Oriental Institute of Science and Technology',
                slug: oistSlug,
                isActive: true,
                subscriptionStatus: 'active',
                adminEmail: 'pankajdwivedi81@gmail.com', // Using owner's email from settings
            });
            console.log(`✅ Tenant created with ID: ${oistTenant._id}`);
        } else {
            console.log(`ℹ️ Tenant '${oistSlug}' already exists with ID: ${oistTenant._id}`);
        }

        const tenantIdStr = oistTenant._id.toString();

        // 2. Update Student Records
        console.log('🔄 Updating Student records...');
        const studentResult = await mongoose.connection.db.collection('students').updateMany(
            { $or: [{ tenantId: 'default' }, { tenantId: { $exists: false } }] },
            { $set: { tenantId: tenantIdStr } }
        );
        console.log(`✅ Updated ${studentResult.modifiedCount} students.`);

        // 3. Update AdminSettings
        console.log('🔄 Updating AdminSettings...');
        const settingsResult = await mongoose.connection.db.collection('adminsettings').updateMany(
            { $or: [{ tenantId: 'default' }, { tenantId: { $exists: false } }] },
            { $set: { tenantId: tenantIdStr } }
        );
        console.log(`✅ Updated ${settingsResult.modifiedCount} settings documents.`);

        // 4. Update GatePass Records
        console.log('🔄 Updating GatePass records...');
        const gatePassResult = await mongoose.connection.db.collection('gatepasses').updateMany(
            { $or: [{ tenantId: 'default' }, { tenantId: { $exists: false } }] },
            { $set: { tenantId: tenantIdStr } }
        );
        console.log(`✅ Updated ${gatePassResult.modifiedCount} gatepass records.`);

        console.log('\n✨ MIGRATION COMPLETE! ✨');
        console.log(`All OIST data is now officially linked to Tenant: ${oistSlug} (${tenantIdStr})`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

migrate();
