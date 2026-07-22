#!/usr/bin/env node
/**
 * Script: check-demo-devotions.mjs
 * 
 * Mencari dokumen daily_devotions yang berisi teks demo/error lama.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dir, "..");
const rawContent = readFileSync(join(rootDir, ".env.vercel.local"), "utf8");

function extractEnvJson(content, varName) {
  const lineMatch = content.match(new RegExp(`^${varName}=(.+)$`, "m"));
  if (!lineMatch) return null;
  let raw = lineMatch[1].trim();
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  raw = raw.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  return raw;
}

const serviceAccountRaw = extractEnvJson(rawContent, "FIREBASE_SERVICE_ACCOUNT_JSON");
let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountRaw);
} catch(e) {
  try {
    const reescaped = serviceAccountRaw.replace(
      /"private_key":\s*"([\s\S]+?)(?=",\s*"client_email)"/,
      (match, keyContent) => `"private_key": "${keyContent.replace(/\n/g, "\\n")}"`
    );
    serviceAccount = JSON.parse(reescaped);
  } catch(e2) {
    console.error("Failed to parse service account:", e.message);
    process.exit(1);
  }
}

const { createSign } = await import("crypto");
const PROJECT_ID = serviceAccount.project_id;

function base64UrlEncode(str) {
  return Buffer.from(str).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore",
  }));
  const sigInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(sigInput);
  const sig = sign.sign(serviceAccount.private_key, "base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const jwt = `${sigInput}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  return data.access_token;
}

const token = await getAccessToken();

const allDocs = [];
let pageToken = null;
do {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/daily_devotions?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.documents) allDocs.push(...data.documents);
  pageToken = data.nextPageToken || null;
} while (pageToken);

const DEMO_MARKERS = ["Mode demo aktif", "DEEPSEEK_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY_BACKUP2", "provider: demo"];

console.log(`\n📊 Total dokumen: ${allDocs.length}`);
console.log("\n🔍 Mencari dokumen dengan konten demo/error lama...\n");

const demoDocs = allDocs.filter((doc) => {
  const id = doc.name.split("/").pop();
  const provider = doc.fields?.provider?.stringValue || "";
  const title = doc.fields?.title?.stringValue || "";
  const body = doc.fields?.body?.stringValue || "";
  const prayer = doc.fields?.prayer?.stringValue || "";
  const status = doc.fields?.status?.stringValue || "";

  if (provider === "demo" || status === "demo") return true;
  const checkStr = (s) => DEMO_MARKERS.some(m => s.includes(m));
  return checkStr(title) || checkStr(body) || checkStr(prayer);
});

if (demoDocs.length === 0) {
  console.log("✅ Tidak ada dokumen demo/error. Semua bersih!\n");
} else {
  console.log(`⚠️  Ditemukan ${demoDocs.length} dokumen dengan konten demo:\n`);
  demoDocs.forEach((doc) => {
    const id = doc.name.split("/").pop();
    const provider = doc.fields?.provider?.stringValue || "?";
    const status = doc.fields?.status?.stringValue || "?";
    const title = doc.fields?.title?.stringValue || "(no title)";
    console.log(`   - ${id} | provider: ${provider} | status: ${status}`);
    console.log(`     judul: "${title.substring(0, 80)}"`);
  });
  console.log(`\n💡 Jalankan: node scripts/fix-sore-devotion.mjs --delete (untuk slot sore -15)`);
  console.log(`   Atau hapus manual dari Firestore console.\n`);
}
