import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// const firebaseConfig = {
//   apiKey: "AIzaSyAXgWxbrEOfAOKBLZ7wvtR3L85YWfrcnIQ",
//   authDomain: "hosteleaze-95fd7.firebaseapp.com",
//   projectId: "hosteleaze-95fd7",
//   storageBucket: "hosteleaze-95fd7.firebasestorage.app",
//   messagingSenderId: "891111970186",
//   appId: "1:891111970186:web:7a74a1e93ce9aaa0eb2473",
//   measurementId: "G-81WCF68FHC"
// };

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE?.includes('build');

let app;
if (isBuildPhase && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.warn("⚠️ Warning: Missing client-side Firebase variables during build. Skipping client initialization.");
  app = {} as any;
} else {
  app = initializeApp(firebaseConfig);
}

export const auth = new Proxy({} as any, {
  get(target, prop) {
    try {
      if (isBuildPhase && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        return () => {};
      }
      return Reflect.get(getAuth(app), prop);
    } catch (e) {
      if (isBuildPhase) {
        return () => {};
      }
      throw e;
    }
  }
});

export const googleProvider = new GoogleAuthProvider();

let analytics;
if (typeof window !== "undefined" && app && app.options) {
  analytics = getAnalytics(app);
}

export { analytics };


