#!/usr/bin/env node
/**
 * Script: fix-sore-devotion.mjs
 *
 * Menghapus dokumen daily_devotions dengan suffix -15 (slot sore)
 * menggunakan Firebase REST API dengan service account OAuth2 token.
 *
 * Jalankan (preview): node scripts/fix-sore-devotion.mjs
 * Jalankan (hapus):   node scripts/fix-sore-devotion.mjs --delete
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dir, "..");

// Load .env.vercel.local for service account
const envPath = join(rootDir, ".env.vercel.local");
const rawContent = readFileSync(envPath, "utf8");

// Extract FIREBASE_SERVICE_ACCOUNT_JSON value - handles escaped JSON format
function extractEnvJson(content, varName) {
  // The value is on one line: VARNAME="{\n  \"key\": \"value\", ...}\n"
  // We need to find the entire line and reconstruct the JSON
  const lineMatch = content.match(new RegExp(`^${varName}=(.+)$`, "m"));
  if (!lineMatch) return null;

  let raw = lineMatch[1].trim();

  // Remove surrounding outer quotes if present
  if (raw.startsWith('"') && raw.endsWith('"')) {
    raw = raw.slice(1, -1);
  }

  // The raw string has literal \\n for newlines and \" for quotes inside
  // Convert \\n -> real newlines and \" -> real quotes to get valid JSON
  const unescaped = raw
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"');

  return unescaped;
}

const serviceAccountRaw = extractEnvJson(rawContent, "FIREBASE_SERVICE_ACCOUNT_JSON");
if (!serviceAccountRaw) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON tidak ditemukan di .env.vercel.local");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountRaw);
} catch (e) {
  // Private key contains real newlines which break JSON parse.
  // Re-escape only the newlines INSIDE string values by serializing carefully.
  try {
    // Replace actual \n chars inside the JSON string value for private_key
    const reescaped = serviceAccountRaw.replace(
      /"private_key":\s*"([\s\S]+?)(?=",\s*"client_email)"/,
      (match, keyContent) => {
        const escaped = keyContent.replace(/\n/g, "\\n");
        return `"private_key": "${escaped}"`;
      }
    );
    serviceAccount = JSON.parse(reescaped);
  } catch (e2) {
    console.error("❌ Gagal parse service account JSON:", e.message);
    console.error("Raw snippet:", serviceAccountRaw.substring(0, 300));
    process.exit(1);
  }
}

const PROJECT_ID = serviceAccount.project_id;
const CLIENT_EMAIL = serviceAccount.client_email;
const PRIVATE_KEY = serviceAccount.private_key;

const shouldDelete = process.argv.includes("--delete");

// =====================
// JWT / OAuth2 helpers
// =====================

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function createSignedJwt() {
  const { createSign } = await import("crypto");

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      sub: CLIENT_EMAIL,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/datastore",
    })
  );

  const signingInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(PRIVATE_KEY, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${signingInput}.${signature}`;
}

async function getAccessToken() {
  const jwt = await createSignedJwt();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth2 token request failed: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

// =====================
// Firestore REST API
// =====================

async function firestoreGetAll(token, collectionId, pageToken = null) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Firestore GET failed: ${res.status}`);
  return res.json();
}

async function firestoreDelete(token, collectionId, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}/${docId}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore DELETE failed: ${res.status} - ${text.substring(0, 200)}`);
  }
}

function getStrField(fields, fieldName) {
  return fields?.[fieldName]?.stringValue || "?";
}

function getJakartaDateId() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `golden-${parts.year}-${parts.month}-${parts.day}-05`;
}

// =====================
// Main
// =====================

async function main() {
  console.log("\n🔑 Mendapatkan OAuth2 access token...");
  const token = await getAccessToken();
  console.log("✅ Token OK\n");

  console.log(`🔍 Memeriksa dokumen slot sore di Firestore (project: ${PROJECT_ID})...\n`);

  // Fetch all devotion docs
  const allDocs = [];
  let nextPageToken = null;
  do {
    const data = await firestoreGetAll(token, "daily_devotions", nextPageToken);
    if (data.documents) allDocs.push(...data.documents);
    nextPageToken = data.nextPageToken || null;
  } while (nextPageToken);

  console.log(`📊 Total dokumen daily_devotions: ${allDocs.length}`);

  const todayMorningId = getJakartaDateId();
  const soreDocs = allDocs.filter((doc) => {
    const id = doc.name.split("/").pop();
    return id.endsWith("-15");
  });
  const morningDoc = allDocs.find((doc) => doc.name.split("/").pop() === todayMorningId);

  console.log(`📅 ID renungan pagi hari ini: ${todayMorningId}`);
  if (morningDoc) {
    const provider = getStrField(morningDoc.fields, "provider");
    const status = getStrField(morningDoc.fields, "status");
    const title = getStrField(morningDoc.fields, "title");
    console.log(`✅ Dokumen pagi ADA — provider: ${provider}, status: ${status}`);
    if (title !== "?") console.log(`   Judul: "${title.substring(0, 80)}"`);
  } else {
    console.log(`⚠️  Dokumen pagi ${todayMorningId} BELUM ADA di Firestore.`);
  }

  if (soreDocs.length === 0) {
    console.log("\n✅ Tidak ada dokumen slot sore (-15). Semuanya bersih!\n");
    return;
  }

  console.log(`\n⚠️  Ditemukan ${soreDocs.length} dokumen slot sore (-15):\n`);
  soreDocs.forEach((doc) => {
    const id = doc.name.split("/").pop();
    const provider = getStrField(doc.fields, "provider");
    const status = getStrField(doc.fields, "status");
    const title = getStrField(doc.fields, "title");
    console.log(`   - ${id} | provider: ${provider} | status: ${status}`);
    if (title !== "?" && title.length < 100) console.log(`     judul: "${title}"`);
  });

  if (!shouldDelete) {
    console.log("\n💡 Mode PREVIEW. Jalankan dengan --delete untuk menghapus:\n");
    console.log("   node scripts/fix-sore-devotion.mjs --delete\n");
    return;
  }

  console.log("\n🗑️  Menghapus dokumen slot sore...\n");
  let deleted = 0;
  let failed = 0;

  for (const doc of soreDocs) {
    const id = doc.name.split("/").pop();
    try {
      await firestoreDelete(token, "daily_devotions", id);
      console.log(`   ✅ Deleted: ${id}`);
      deleted++;
    } catch (err) {
      console.error(`   ❌ Gagal menghapus ${id}:`, err.message);
      failed++;
    }
  }

  console.log(`\n📋 Selesai: ${deleted} dihapus, ${failed} gagal.\n`);

  if (!morningDoc) {
    console.log("⚠️  PERHATIAN: Dokumen pagi hari ini belum ada!");
    console.log(`   Trigger cron: GET https://www.gracedaily.my.id/api/cron/daily-devotion\n`);
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
