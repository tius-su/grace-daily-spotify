/**
 * Helper to fetch Firestore collections/documents using the public REST API.
 * This is used as a reliable fallback when the Firebase Admin SDK (getAdminDb())
 * returns null (e.g., in local development without service account keys).
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "renungan-life";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Helper to convert Firestore REST value to plain JS value
function parseRestValue(value: any): any {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return parseInt(value.integerValue, 10);
  if ("doubleValue" in value) return parseFloat(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) {
    return {
      toDate: () => new Date(value.timestampValue),
    };
  }
  if ("arrayValue" in value) {
    const values = value.arrayValue.values || [];
    return values.map((v: any) => parseRestValue(v));
  }
  if ("mapValue" in value) {
    const fields = value.mapValue.fields || {};
    const result: any = {};
    for (const [k, v] of Object.entries(fields)) {
      result[k] = parseRestValue(v);
    }
    return result;
  }
  return null;
}

// Convert REST document to standard JS object
function parseRestDoc(doc: any): any {
  const id = doc.name.split("/").pop();
  const fields = doc.fields || {};
  const result: any = { id };
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseRestValue(val);
  }
  return result;
}

/**
 * Fetch all documents in a collection via Firestore REST API
 */
export async function fetchCollectionFromRest(collectionName: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/${collectionName}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      throw new Error(`REST fetch failed with status ${res.status}`);
    }
    const data = await res.json();
    if (!data.documents) return [];
    return data.documents.map(parseRestDoc);
  } catch (e) {
    console.error(`[Firestore REST] Failed to fetch collection '${collectionName}':`, e);
    return [];
  }
}

/**
 * Fetch a single document by ID via Firestore REST API
 */
export async function fetchDocFromRest(collectionName: string, docId: string): Promise<any> {
  try {
    const res = await fetch(`${BASE_URL}/${collectionName}/${docId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`REST fetch failed with status ${res.status}`);
    }
    const doc = await res.json();
    return parseRestDoc(doc);
  } catch (e) {
    console.error(`[Firestore REST] Failed to fetch document '${collectionName}/${docId}':`, e);
    return null;
  }
}

/**
 * Query published blog posts from Firestore via REST API.
 * This runs structuredQuery to bypass security rules block on full list.
 */
export async function fetchPublishedBlogsFromRest(): Promise<any[]> {
  try {
    const url = `${BASE_URL}:runQuery`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "blog_posts" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "published" },
            },
          },
        },
      }),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`REST query failed with status ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    const docs = data
      .filter((item: any) => item.document)
      .map((item: any) => parseRestDoc(item.document));
      
    return docs;
  } catch (e) {
    console.error("[Firestore REST] Failed to query published blog posts:", e);
    return [];
  }
}

