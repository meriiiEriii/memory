import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDAl43visRZqdut_pRvIZFM_R-WACCtJ9A",
  authDomain: "website-31fc8.firebaseapp.com",
  projectId: "website-31fc8",
  storageBucket: "website-31fc8.firebasestorage.app",
  messagingSenderId: "862634117481",
  appId: "1:862634117481:web:fbb3a72188a8a86783d5f8",
  measurementId: "G-ZJL4C2VGP4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export { auth };
