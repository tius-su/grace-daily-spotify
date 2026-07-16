import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
initializeApp({ credential: cert(JSON.parse(readFileSync("scripts/serviceAccountKey.json", "utf8"))) });
const db = getFirestore();
const snapshot = await db.collection("ensiklopedia_cache").limit(10).get();
snapshot.forEach(doc => console.log(doc.id, doc.data().illustrationUrl));
