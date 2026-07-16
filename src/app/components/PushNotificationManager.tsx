"use client";

import { useEffect, useState } from "react";
import { firebaseApp, db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const FALLBACK_FIREBASE_VAPID_KEY = "BAZgrFWk4W8wZvWeYan-WvJDfxu9OB3UKOn0K_VNHdZCCFYQwuxR3EQCyS82I0GHdG-6NB1NZMCowRPPSIlh4i4";
const VAPID_KEY = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || FALLBACK_FIREBASE_VAPID_KEY).trim();

const defaultPrefs = {
  devotion: true,
  article: true,
  reminder: true,
  update: true,
  general: true,
};

function hasValidVapidKey() {
  return /^[A-Za-z0-9_-]{80,120}$/.test(VAPID_KEY);
}

export function PushNotificationManager() {
  const [supported, setSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  async function getRegistrationToken() {
    if (!firebaseApp || !hasValidVapidKey()) {
      console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing or invalid.");
      return null;
    }

    const messaging = getMessaging(firebaseApp);
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    
    // Wait until the service worker is active to prevent "Subscription failed - no active Service Worker"
    if (!registration.active) {
      await new Promise<void>((resolve) => {
        const worker = registration.installing || registration.waiting;
        if (worker) {
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    }

    return getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  }

  async function ensureTokenRegistered(nextUserId?: string | null) {
    if (!supported || !firebaseApp || !db || Notification.permission !== "granted") return;

    try {
      const token = await getRegistrationToken();
      if (!token) return;

      const tokenRef = doc(db, "fcm_tokens", token);
      const tokenSnap = await getDoc(tokenRef);
      const existingPrefs = tokenSnap.data()?.preferences;
      const preferences = {
        devotion: existingPrefs?.devotion !== false,
        article: existingPrefs?.article !== false,
        reminder: existingPrefs?.reminder !== false,
        update: existingPrefs?.update !== false,
        general: existingPrefs?.general !== false,
      };

      await setDoc(tokenRef, {
        token,
        userId: nextUserId ?? auth?.currentUser?.uid ?? null,
        preferences: tokenSnap.exists() ? preferences : defaultPrefs,
        userAgent: navigator.userAgent,
        createdAt: tokenSnap.exists() ? tokenSnap.data().createdAt : new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      // Sinkronisasikan token ke koleksi pushSubscribers untuk notifikasi publik
      try {
        await fetch("/api/subscribe/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            devotionEnabled: preferences.devotion,
            articleEnabled: preferences.article,
          }),
        });
      } catch (err) {
        console.warn("[PushManager] Gagal mendaftarkan token ke pushSubscribers publik:", err);
      }
    } catch (error) {
      console.warn("Failed to register notification token:", error);
    }
  }

  async function requestPermissionAndRegister(nextUserId?: string | null) {
    if (!supported || !firebaseApp || !("Notification" in window)) return;

    try {
      const nextPermission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;

      setPermission(nextPermission);
      setIsEnabled(nextPermission === "granted");

      if (nextPermission === "granted") {
        await ensureTokenRegistered(nextUserId ?? userId);
      }
    } catch (error) {
      console.warn("Could not request notification permission:", error);
    }
  }

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "Notification" in window &&
      "PushManager" in window &&
      !!firebaseApp;

    setSupported(isSupported);

    if (isSupported) {
      setPermission(Notification.permission);
    }

    if (isSupported && Notification.permission === "granted") {
      setIsEnabled(true);
    }

    if (!auth) return;

    return onAuthStateChanged(auth, (user) => {
      const nextUserId = user?.uid ?? null;
      setUserId(nextUserId);
      if (Notification.permission === "granted") {
        void ensureTokenRegistered(nextUserId);
      }
    });
  }, []);

  useEffect(() => {
    if (isEnabled) {
      void ensureTokenRegistered(userId);
    }
  }, [isEnabled, userId, supported]);

  useEffect(() => {
    if (!supported || !firebaseApp || permission !== "default") return;

    const storageKey = "grace-daily-push-permission-attempted";
    const hasAttempted = window.localStorage.getItem(storageKey) === "1";

    const requestAutomatically = () => {
      window.localStorage.setItem(storageKey, "1");
      void requestPermissionAndRegister(userId);
    };

    const requestFromInteraction = () => {
      void requestPermissionAndRegister(userId);
    };

    const timer = !hasAttempted
      ? window.setTimeout(requestAutomatically, 1200)
      : null;

    window.addEventListener("click", requestFromInteraction, { once: true });
    window.addEventListener("keydown", requestFromInteraction, { once: true });
    window.addEventListener("touchstart", requestFromInteraction, { once: true });

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
      window.removeEventListener("click", requestFromInteraction);
      window.removeEventListener("keydown", requestFromInteraction);
      window.removeEventListener("touchstart", requestFromInteraction);
    };
  }, [permission, supported, userId]);

  useEffect(() => {
    if (!supported || !firebaseApp) return;

    try {
      const messaging = getMessaging(firebaseApp);
      return onMessage(messaging, (payload) => {
        if (payload.notification) {
          alert(`🔔 ${payload.notification.title}\n\n${payload.notification.body}`);
        }
      });
    } catch (error) {
      console.warn("Could not register onMessage handler:", error);
    }
  }, [supported]);

  return null;
}
