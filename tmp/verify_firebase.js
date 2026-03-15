const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
});

const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase Admin environment variables in .env.local');
    process.exit(1);
}

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }
    console.log('✅ Firebase Admin initialized successfully.');
    
    admin.auth().listUsers(1)
        .then(res => {
            console.log(`✅ Firebase Auth connection successful. Found ${res.users.length > 0 ? 'some' : 'no'} users.`);
        })
        .catch(err => {
            console.error('❌ Firebase Auth check failed:', err.message);
        });

} catch (err) {
    console.error('❌ Unexpected error during Firebase initialization:', err.message);
}
