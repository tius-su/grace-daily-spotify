import { s3Client, R2_BUCKET_NAME } from "./r2";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

let readsToday = 0;
let writesToday = 0;
let lastResetDate = "";
let loaded = false;
let savingPromise: Promise<void> | null = null;
let lastSaveTime = 0;
const DEBOUNCE_MS = 10000; // Save at most once every 10 seconds

function getJakartaDateStr(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

async function checkResetAndLoad() {
  const today = getJakartaDateStr();
  if (today !== lastResetDate) {
    readsToday = 0;
    writesToday = 0;
    lastResetDate = today;
    loaded = false; // Need to reload for new date
  }

  if (!loaded) {
    loaded = true;
    if (R2_BUCKET_NAME) {
      try {
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: "firestore-usage.json",
        });
        const response = await s3Client.send(command);
        const body = response.Body;
        if (body) {
          const content = await body.transformToString();
          const parsed = JSON.parse(content);
          if (parsed.date === today) {
            readsToday = parsed.reads || 0;
            writesToday = parsed.writes || 0;
          }
        }
      } catch (err: any) {
        // NoSuchKey is expected if it's the first operation of the day
        if (err.name !== "NoSuchKey" && err.Code !== "NoSuchKey") {
          console.warn("[FirestoreMonitor] Failed to load firestore usage from R2:", err);
        }
      }
    }
  }
}

async function saveToR2Internal() {
  if (!R2_BUCKET_NAME) return;
  const today = getJakartaDateStr();
  const payload = {
    date: today,
    reads: readsToday,
    writes: writesToday,
    updatedAt: new Date().toISOString(),
  };

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: "firestore-usage.json",
      Body: JSON.stringify(payload, null, 2),
      ContentType: "application/json",
    });
    await s3Client.send(command);
    lastSaveTime = Date.now();
  } catch (err) {
    console.error("[FirestoreMonitor] Failed to save firestore usage to R2:", err);
  }
}

function triggerSave() {
  const now = Date.now();
  if (savingPromise) return; // Already saving

  if (now - lastSaveTime >= DEBOUNCE_MS) {
    savingPromise = saveToR2Internal().finally(() => {
      savingPromise = null;
    });
  } else {
    // Schedule a delayed save
    const delay = DEBOUNCE_MS - (now - lastSaveTime);
    setTimeout(() => {
      if (!savingPromise) {
        savingPromise = saveToR2Internal().finally(() => {
          savingPromise = null;
        });
      }
    }, delay);
  }
}

export async function logFirestoreRead(count = 1) {
  await checkResetAndLoad();
  readsToday += count;
  triggerSave();
}

export async function logFirestoreWrite(count = 1) {
  await checkResetAndLoad();
  writesToday += count;
  triggerSave();
}

export async function getFirestoreUsage() {
  await checkResetAndLoad();
  const readQuota = 50000;
  const writeQuota = 20000;
  const readsWarning = readsToday > readQuota * 0.7; // > 35,000
  const writesWarning = writesToday > writeQuota * 0.7; // > 14,000

  return {
    date: lastResetDate,
    reads: readsToday,
    writes: writesToday,
    readQuota,
    writeQuota,
    readsWarning,
    writesWarning,
  };
}
