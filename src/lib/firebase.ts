import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Intercept console.error to print clear, styled, clickable index creation links in browser console (F12)
if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const errorStr = args.map(arg => {
      try {
        return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
      } catch {
        return String(arg);
      }
    }).join(" ");

    const match = errorStr.match(/(https:\/\/console\.firebase\.google\.com\/v1\/projects\/[^\s"'>\)]+)/);
    if (match) {
      const url = match[1];
      console.log(
        "%c[🔥 FIREBASE COMPOSITE INDEX REQUIRED]%c\n\nKlik link di bawah ini untuk membuat index otomatis:\n%c" + url + "\n\n",
        "color: #ff9f43; font-size: 13px; font-weight: bold; background: #2f3640; padding: 4px 8px; border-radius: 4px;",
        "color: #2f3640; font-size: 11px; font-weight: bold;",
        "color: #1e90ff; font-size: 11px; font-weight: bold; text-decoration: underline;"
      );
    }
    originalConsoleError.apply(console, args);
  };
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every(Boolean);
}

export const firebaseApp = hasFirebaseConfig()
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;

export function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("guestPremiumId");
  if (!id) {
    id = `GUEST-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("guestPremiumId", id);
  }
  return id;
}
