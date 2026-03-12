// src/config/firebase.ts
import { initializeApp, getApps } from "firebase/app";
// @ts-expect-error: Firebase types issue with getReactNativePersistence
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCNLR_JXHlN-dK4669vYsvQcm1uhHKfjzQ",
  authDomain: "delyges-app.firebaseapp.com",
  projectId: "delyges-app",
  storageBucket: "delyges-app.firebasestorage.app",
  messagingSenderId: "893947341201", 
  appId: "1:893947341201:android:22bd5342c3ce6f01489230"
};

console.log("🔥 Firebase initialisation...");

// éviter double initialisation
const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

// Auth avec persistance
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Firestore
export const db = getFirestore(app);

export default app;
