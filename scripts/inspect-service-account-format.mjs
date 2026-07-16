import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.vercel.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.*)/);
  if (match) {
    let raw = match[1].trim();
    // Redact private key
    raw = raw.replace(/"private_key"\s*:\s*"[^"]*"/, '"private_key": "[REDACTED]"');
    raw = raw.replace(/\\"private_key\\"\s*:\s*\\"[^\\"]*\\"/, '\\"private_key\\": \\"[REDACTED]\\"');
    console.log("Length:", raw.length);
    console.log("Content:", raw);
  } else {
    console.log("FIREBASE_SERVICE_ACCOUNT_JSON not found in .env.vercel.local");
  }
} else {
  console.log(".env.vercel.local not found");
}
