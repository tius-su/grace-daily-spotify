import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function serviceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e);
    }
  }

  if (file?.trim().startsWith("{")) {
    try {
      return JSON.parse(file);
    } catch (e) {
      console.error("[Firebase Admin] Failed to parse GOOGLE_APPLICATION_CREDENTIALS JSON string:", e);
    }
  }

  if (file) {
    try {
      const resolvedPath = path.isAbsolute(file) ? file : path.join(/*turbopackIgnore: true*/ process.cwd(), file);
      if (existsSync(resolvedPath)) {
        const content = readFileSync(resolvedPath, "utf8").trim();
        if (content) {
          return JSON.parse(content);
        }
      }
    } catch (e) {
      console.error("[Firebase Admin] Failed to read/parse GOOGLE_APPLICATION_CREDENTIALS file:", e);
    }
  }

  // Explicitly check and read the default key file using process.cwd().
  // This static reference forces Next.js NFT to bundle the serviceAccountKey.json file at build time.
  try {
    const defaultKeyPath = path.join(/*turbopackIgnore: true*/ process.cwd(), "scripts", "serviceAccountKey.json");
    if (existsSync(defaultKeyPath)) {
      const content = readFileSync(defaultKeyPath, "utf8").trim();
      if (content) {
        return JSON.parse(content);
      }
    }
  } catch (e) {
    console.error("[Firebase Admin] Failed to read/parse default serviceAccountKey.json:", e);
  }
}

let dbHealthy = true;
let cooldownUntil = 0;

export function reportDbFailure() {
  dbHealthy = false;
  cooldownUntil = Date.now() + 3 * 60 * 1000; // 3 minutes cooldown
  console.warn(`[Firebase Admin] Circuit breaker tripped! Database calls disabled for 3 minutes.`);
}

export function getAdminDb() {
  if (!dbHealthy && Date.now() < cooldownUntil) {
    return null;
  }
  
  if (!dbHealthy && Date.now() >= cooldownUntil) {
    dbHealthy = true;
  }

  const account = serviceAccount();

  if (!account) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(account),
    });
  }

  return getFirestore();
}

export function getAdminAuth() {
  const account = serviceAccount();

  if (!account) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(account),
    });
  }

  return getAuth();
}
