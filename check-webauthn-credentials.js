const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Read .env.local file
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
let MONGODB_URL = '';

for (const line of envLines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('MONGODB_URL=')) {
        MONGODB_URL = trimmedLine.substring('MONGODB_URL='.length).trim();
        // Remove quotes if present
        if (MONGODB_URL.startsWith('"') && MONGODB_URL.endsWith('"')) {
            MONGODB_URL = MONGODB_URL.slice(1, -1);
        }
        if (MONGODB_URL.startsWith("'") && MONGODB_URL.endsWith("'")) {
            MONGODB_URL = MONGODB_URL.slice(1, -1);
        }
        break;
    }
}

if (!MONGODB_URL) {
    console.error('❌ MONGODB_URL not found in .env.local');
    process.exit(1);
}

const studentSchema = new mongoose.Schema({
    name: String,
    email: String,
    deviceId: String,
    webAuthnCredentials: [{
        credentialID: String,
        publicKey: String,
        counter: Number,
        transports: [String],
        createdAt: Date
    }]
}, { timestamps: true });

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);

async function checkWebAuthnCredentials() {
    try {
        await mongoose.connect(MONGODB_URL, {
            bufferCommands: false,
            maxPoolSize: 3
        });

        console.log('✅ Connected to MongoDB\n');

        // Count students with webAuthnCredentials
        const withCreds = await Student.countDocuments({
            webAuthnCredentials: { $exists: true, $ne: [] }
        });

        const withoutCreds = await Student.countDocuments({
            $or: [
                { webAuthnCredentials: { $exists: false } },
                { webAuthnCredentials: [] }
            ]
        });

        const totalStudents = await Student.countDocuments();

        console.log('📊 WebAuthn Credentials Status:\n');
        console.log(`   Total Students: ${totalStudents}`);
        console.log(`   With WebAuthn: ${withCreds}`);
        console.log(`   Without WebAuthn: ${withoutCreds}`);

        if (withCreds > 0) {
            console.log('\n✅ webAuthnCredentials IS BEING SAVED TO MONGODB');

            // Show sample students with credentials
            const samples = await Student.find({
                webAuthnCredentials: { $exists: true, $ne: [] }
            })
                .select('name email deviceId webAuthnCredentials')
                .limit(5)
                .lean();

            console.log('\n📋 Sample Students with WebAuthn:\n');
            samples.forEach((student, index) => {
                console.log(`${index + 1}. ${student.name} (${student.email})`);
                console.log(`   Device ID: ${student.deviceId}`);
                console.log(`   WebAuthn Credentials: ${student.webAuthnCredentials.length}`);
                student.webAuthnCredentials.forEach((cred, i) => {
                    console.log(`      ${i + 1}. ID: ${cred.credentialID.substring(0, 20)}...`);
                    console.log(`         Registered: ${new Date(cred.createdAt).toLocaleString('en-IN')}`);
                    console.log(`         Transports: ${cred.transports?.join(', ') || 'N/A'}`);
                });
                console.log('');
            });
        } else {
            console.log('\n⚠️ NO STUDENTS HAVE WEBAUTHN CREDENTIALS YET');
            console.log('   This could mean:');
            console.log('   1. Students haven\'t registered biometrics yet');
            console.log('   2. The registration endpoint has an issue');
            console.log('   3. The field is defined but not being used');
        }

        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkWebAuthnCredentials();
