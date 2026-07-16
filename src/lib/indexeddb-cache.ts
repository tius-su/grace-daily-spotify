const DB_NAME = "grace-daily-cache-db";
const DB_VERSION = 1;
const STORE_NAME = "keyvalue-cache";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveToCache(key: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const entry = {
        data,
        timestamp: Date.now(),
      };
      const request = store.put(entry, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error("[IndexedDB Cache] Failed to save key:", key, e);
  }
}

export async function getFromCache(key: string): Promise<any | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data);
        } else {
          resolve(null);
        }
      };
    });
  } catch (e) {
    console.error("[IndexedDB Cache] Failed to get key:", key, e);
    return null;
  }
}

export async function clearOldCache(): Promise<void> {
  try {
    const db = await getDB();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const entry = cursor.value;
          if (entry && entry.timestamp && now - entry.timestamp > thirtyDaysMs) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  } catch (e) {
    console.error("[IndexedDB Cache] Failed to clear old cache:", e);
  }
}
