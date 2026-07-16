import { getAdminDb, reportDbFailure, withDbTimeout } from "./firebase-admin";
import { fetchCollectionFromRest, fetchDocFromRest } from "./firestore-rest";
import { getStorageSource, getActiveStorageConfig } from "./storage-config";
import { logQuery } from "./network-debug";
import { logFirestoreRead } from "./firestore-monitor";
import { s3Client, R2_BUCKET_NAME } from "./r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import zlib from "zlib";

// General download helper for R2 backup files (avoids circular dependency on backup-r2-service)
async function downloadFromR2Local(fileName: string): Promise<string | null> {
  if (!R2_BUCKET_NAME) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName.startsWith("encyclopedia/") || fileName.startsWith("articles/") || fileName.startsWith("devotions/") || fileName.startsWith("songs/") || fileName.startsWith("shared-pages/")
        ? fileName
        : `backup/${fileName}`,
    });

    const response = await s3Client.send(command);
    const body = response.Body;
    if (!body) return null;

    const buffer = Buffer.from(await body.transformToByteArray());

    if (response.ContentEncoding === "gzip") {
      const decompressed = zlib.gunzipSync(buffer);
      return decompressed.toString("utf8");
    }

    return buffer.toString("utf8");
  } catch (err) {
    console.warn(`[db-fallback] R2 local download failed for ${fileName}`);
    return null;
  }
}

// Fetch helper from Firebase Admin SDK
// categoryFilter: opsional, untuk filter koleksi ensiklopedia_cache by kategori agar hemat reads
async function fetchCollectionFromFirebaseAdmin<T>(collectionName: string, categoryFilter?: string): Promise<T[] | null> {
  const adminDb = getAdminDb();
  if (!adminDb) return null;

  try {
    // Jika ada filter kategori, gunakan where clause untuk hemat reads
    // Tanpa filter: baca semua 440+ dokumen; dengan filter: hanya ~30-40 dokumen
    const db = adminDb as any;
    let query = db.collection(collectionName);
    if (categoryFilter) {
      query = query.where("kategori", "==", categoryFilter);
    }

    const snap = await withDbTimeout(query.get(), 2000) as any;
    const docCount = (snap.docs?.length) || 0;
    await logFirestoreRead(docCount || 1); // Log read usage

    if (snap.docs && snap.docs.length > 0) {
      return snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
    }
  } catch (e) {
    console.warn(`[db-fallback] Firebase Admin SDK failed for ${collectionName}${categoryFilter ? `/${categoryFilter}` : ""}:`, e);
    reportDbFailure();
  }
  return null;
}

// Fetch helper from Firebase REST API
async function fetchCollectionFromREST<T>(collectionName: string): Promise<T[] | null> {
  try {
    const restData = await fetchCollectionFromRest(collectionName);
    if (restData && restData.length > 0) {
      await logFirestoreRead(restData.length);
      return restData as T[];
    }
  } catch (e) {
    console.warn(`[db-fallback] REST failed for collection ${collectionName}:`, e);
  }
  return null;
}

// General server-side fallback runner for collections
export async function getCollectionWithFallback<T>(
  collectionName: string,
  r2FileName: string,
  staticFallback: T[] = []
): Promise<T[]> {
  const start = Date.now();
  const config = await getActiveStorageConfig();
  const source = getStorageSource(collectionName, r2FileName, config);

  const fetchFromR2 = async (): Promise<T[] | null> => {
    try {
      const r2DataStr = await downloadFromR2Local(r2FileName);
      if (r2DataStr) {
        const parsed = JSON.parse(r2DataStr);
        if (Array.isArray(parsed)) {
          return parsed as T[];
        }
      }
    } catch (e) {
      console.warn(`[db-fallback] R2 failed for ${r2FileName}:`, e);
    }
    return null;
  };

  // Ekstrak kategori dari r2FileName untuk filter Firebase query (hemat reads)
  // Contoh: "tokoh.json" → "tokoh", "teologi-2.json" → "teologi-2"
  const categoryFilter = collectionName === "ensiklopedia_cache" && r2FileName
    ? r2FileName.replace(/\.json$/i, "")
    : undefined;

  const fetchFromFirebase = async (): Promise<T[] | null> => {
    // 1. Try Firebase Admin (dengan category filter jika tersedia)
    const adminData = await fetchCollectionFromFirebaseAdmin<T>(collectionName, categoryFilter);
    if (adminData) return adminData;

    // 2. Try REST
    const restData = await fetchCollectionFromREST<T>(collectionName);
    if (restData) return restData;

    return null;
  };

  let data: T[] | null = null;
  let chosenSourceLabel: "R2" | "Firebase SDK" | "Firebase REST" | "Static Fallback" = "R2";
  let cacheStatus: "HIT" | "MISS" = "MISS";

  if (source === "r2") {
    // Try R2 first
    data = await fetchFromR2();
    if (data) {
      chosenSourceLabel = "R2";
      cacheStatus = "HIT"; // Consider R2 fetch a cache hit for the purpose of the dashboard
    } else {
      // Fallback to Firebase
      data = await fetchFromFirebase();
      chosenSourceLabel = "Firebase SDK";
    }
  } else {
    // Try Firebase first
    data = await fetchFromFirebase();
    if (data) {
      chosenSourceLabel = "Firebase SDK";
    } else {
      // Fallback to R2
      data = await fetchFromR2();
      if (data) {
        chosenSourceLabel = "R2";
        cacheStatus = "HIT";
      }
    }
  }

  // Fallback to static data if both fail
  if (!data) {
    data = staticFallback;
    chosenSourceLabel = "Static Fallback";
  }

  const duration = Date.now() - start;
  logQuery(
    r2FileName.replace(".json", ""),
    chosenSourceLabel,
    chosenSourceLabel === "R2" ? `r2://backup/${r2FileName}` : `firestore://${collectionName}`,
    duration,
    cacheStatus
  );

  return data;
}

// Fetch single document helper from Firebase Admin SDK
async function fetchDocFromFirebaseAdmin<T>(collectionName: string, docId: string): Promise<T | null> {
  const adminDb = getAdminDb();
  if (!adminDb) return null;

  try {
    const snap = await withDbTimeout(adminDb.collection(collectionName).doc(docId).get(), 2000);
    await logFirestoreRead(1); // Log read usage

    if (snap.exists) {
      return { id: snap.id, ...snap.data() } as any;
    }
  } catch (e) {
    console.warn(`[db-fallback] Firebase Admin SDK failed for doc ${collectionName}/${docId}:`, e);
    reportDbFailure();
  }
  return null;
}

// Fetch single document helper from Firebase REST API
async function fetchDocFromREST<T>(collectionName: string, docId: string): Promise<T | null> {
  try {
    const restData = await fetchDocFromRest(collectionName, docId);
    if (restData) {
      await logFirestoreRead(1);
      return restData as T;
    }
  } catch (e) {
    console.warn(`[db-fallback] REST failed for doc ${collectionName}/${docId}:`, e);
  }
  return null;
}

// General server-side fallback runner for a single document
export async function getDocWithFallback<T>(
  collectionName: string,
  docId: string,
  r2FileName: string,
  staticFallback: T | null = null
): Promise<T | null> {
  const start = Date.now();
  const config = await getActiveStorageConfig();
  const source = getStorageSource(collectionName, r2FileName, config);

  const fetchFromR2 = async (): Promise<T | null> => {
    try {
      // For R2, try loading from individual file first
      // E.g. encyclopedia key: encyclopedia/tokoh/paulus.json
      let customKey = "";
      if (collectionName === "ensiklopedia_cache") {
        const cat = r2FileName.replace(".json", "");
        const slug = docId.startsWith(`${cat}-`) ? docId.substring(cat.length + 1) : docId;
        customKey = `encyclopedia/${cat}/${slug}.json`;
      } else if (collectionName === "blog_posts") {
        customKey = `articles/${docId}.json`;
      } else if (collectionName === "daily_devotions" || collectionName === "daily_devotion") {
        customKey = `devotions/${docId}.json`;
      } else if (collectionName === "share_pages") {
        customKey = `shared-pages/${docId}.json`;
      } else if (collectionName === "bible_ai_pages") {
        customKey = `bible_ai_pages/${docId}.json`;
      }

      if (customKey) {
        const docStr = await downloadFromR2Local(customKey);
        if (docStr) {
          return JSON.parse(docStr) as T;
        }
      }

      // Fallback to downloading the entire collection from R2
      const r2DataStr = await downloadFromR2Local(r2FileName);
      if (r2DataStr) {
        const parsed = JSON.parse(r2DataStr);
        if (Array.isArray(parsed)) {
          const doc = parsed.find((d: any) => d.id === docId || d.slug === docId || d.dateId === docId);
          if (doc) return doc as T;
        } else if (parsed && typeof parsed === "object") {
          if (parsed.id === docId || parsed.slug === docId || parsed.dateId === docId) return parsed as T;
        }
      }
    } catch (e) {
      console.warn(`[db-fallback] R2 failed for doc ${collectionName}/${docId}:`, e);
    }
    return null;
  };

  const fetchFromFirebase = async (): Promise<T | null> => {
    // 1. Try Firebase Admin
    const adminData = await fetchDocFromFirebaseAdmin<T>(collectionName, docId);
    if (adminData) return adminData;

    // 2. Try REST
    const restData = await fetchDocFromREST<T>(collectionName, docId);
    if (restData) return restData;

    return null;
  };

  let data: T | null = null;
  let chosenSourceLabel: "R2" | "Firebase SDK" | "Firebase REST" | "Static Fallback" = "R2";
  let cacheStatus: "HIT" | "MISS" = "MISS";

  if (source === "r2") {
    data = await fetchFromR2();
    if (data) {
      chosenSourceLabel = "R2";
      cacheStatus = "HIT";
    } else {
      data = await fetchFromFirebase();
      chosenSourceLabel = "Firebase SDK";
    }
  } else {
    data = await fetchFromFirebase();
    if (data) {
      chosenSourceLabel = "Firebase SDK";
    } else {
      data = await fetchFromR2();
      if (data) {
        chosenSourceLabel = "R2";
        cacheStatus = "HIT";
      }
    }
  }

  if (!data) {
    data = staticFallback;
    chosenSourceLabel = "Static Fallback";
  }

  const duration = Date.now() - start;
  logQuery(
    collectionName === "ensiklopedia_cache" ? r2FileName.replace(".json", "") : collectionName,
    chosenSourceLabel,
    chosenSourceLabel === "R2" ? `r2://${collectionName}/${docId}` : `firestore://${collectionName}/${docId}`,
    duration,
    cacheStatus
  );

  return data;
}
