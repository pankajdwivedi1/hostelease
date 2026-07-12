import * as admin from "firebase-admin";

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE?.includes('build');

if (!admin.apps.length) {
  if (isBuildPhase && (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL)) {
    console.warn("⚠️ Warning: Missing Firebase Admin variables during build. Skipping initialization.");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n").replace(/^"|"$/g, ""),
      }),
    });
  }
}

export const adminAuth = new Proxy({} as any, {
  get(target, prop) {
    try {
      return Reflect.get(admin.auth(), prop);
    } catch (e) {
      if (isBuildPhase) {
        return () => {};
      }
      throw e;
    }
  }
});

export default admin;


