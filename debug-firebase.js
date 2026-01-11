// Debug Firebase Environment Variables
console.log('=== Firebase Config Debug ===');
console.log('API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set ✓' : 'Missing ✗');
console.log('Auth Domain:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log('Expected Auth Domain: hostelease-81056.firebaseapp.com');
console.log('Expected Project ID: hostelease-81056');
