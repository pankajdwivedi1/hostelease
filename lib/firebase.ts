import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// const firebaseConfig = {
//   apiKey: "AIzaSyAXgWxbrEOfAOKBLZ7wvtR3L85YWfrcnIQ",
//   authDomain: "hostelease-95fd7.firebaseapp.com",
//   projectId: "hostelease-95fd7",
//   storageBucket: "hostelease-95fd7.firebasestorage.app",
//   messagingSenderId: "891111970186",
//   appId: "1:891111970186:web:7a74a1e93ce9aaa0eb2473",
//   measurementId: "G-81WCF68FHC"
// };

const firebaseConfig = {
  apiKey: "AIzaSyAjDz5gK92Bw-KJJRRSklL_1KrjjhMxQgk",
  authDomain: "hostelease-81056.firebaseapp.com",
  projectId: "hostelease-81056",
  storageBucket: "hostelease-81056.firebasestorage.app",
  messagingSenderId: "729813273338",
  appId: "1:729813273338:web:a751f3b8f57c27aeefd743",
  measurementId: "G-9PG8NMN3KN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

export { analytics };

